const pool = require('./db');
const bcrypt = require('bcrypt');

// 1. OBTENER PRODUCTO POR ID
async function obtenerProductoPorId(idProducto) {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(
            `SELECT p.*, 
             (SELECT cantidad FROM stock_depositos WHERE id_producto = p.id AND id_deposito = 1) as stock_principal,
             (SELECT cantidad FROM stock_depositos WHERE id_producto = p.id AND id_deposito = 2) as stock_dañado,
             (SELECT cantidad FROM stock_depositos WHERE id_producto = p.id AND id_deposito = 3) as stock_inmovilizado
             FROM productos p WHERE p.id = ?`,
            [idProducto]
        );
        if (rows.length === 0) throw new Error(`Producto ${idProducto} no encontrado.`);
        return rows[0];
    } finally {
        connection.release();
    }
}

// 2. OBTENER TODOS LOS PRODUCTOS
async function obtenerTodosLosProductos() {
    const connection = await pool.getConnection();
    try {
        const [rows] = await connection.execute(`
            SELECT p.id, p.codigo, p.nombre, p.precio_venta, p.precio_costo, sd.cantidad as stock
            FROM productos p
            JOIN stock_depositos sd ON p.id = sd.id_producto
            WHERE sd.id_deposito = 1
        `);
        return rows;
    } finally {
        connection.release();
    }
}

// 3. CREAR PRODUCTO
async function crearProducto(datos) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const [resProd] = await connection.execute(
            `INSERT INTO productos (codigo, nombre, precio_venta, precio_costo) VALUES (?, ?, ?, ?)`,
            [datos.codigo, datos.nombre, datos.precio_venta || 0, datos.precio_costo || 0]
        );
        const nuevoId = resProd.insertId;

        const sqlStock = `INSERT INTO stock_depositos (id_producto, id_deposito, cantidad) VALUES (?, ?, ?)`;
        await connection.execute(sqlStock, [nuevoId, 1, datos.stock || 0]);
        await connection.execute(sqlStock, [nuevoId, 2, 0]);
        await connection.execute(sqlStock, [nuevoId, 3, 0]);

        await connection.commit();
        return { id: nuevoId, ...datos };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// 4. PROCESAR VENTA 
async function procesarNuevaVenta(datosVenta, detallesProductos) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        
        const dv = datosVenta || {}; 
        const items = detallesProductos || [];
        
        // Configuración: permitir stock negativo (por defecto: false)
        // Puedes cambiar esto según la política de tu ferretería
        const permitirStockNegativo = dv.permitirStockNegativo || false;

        // 🔍 NUEVA VALIDACIÓN: Verificar que el usuario/vendedor existe
        const [usuarioExiste] = await connection.execute(
            'SELECT id FROM usuarios WHERE id = ?',
            [dv.usuarioId || 1]
        );

        if (usuarioExiste.length === 0) {
            throw new Error(`El vendedor con ID ${dv.usuarioId || 1} no existe en el sistema.`);
        }

        // 🔍 Validar que el cliente existe
        const [clienteExiste] = await connection.execute(
            'SELECT id FROM clientes WHERE id = ?',
            [dv.clienteId || 1]
        );

        if (clienteExiste.length === 0) {
            const err = new Error(`El cliente con ID ${dv.clienteId || 1} no existe.`);
            err.status = 400;
            throw err;
        }

        // Registrar la cabecera de la venta
        const [ventaResult] = await connection.execute(
            `INSERT INTO ventas (id_cliente, id_usuario, subtotal, impuesto, total, tasa_bcv) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [dv.clienteId || 1, dv.usuarioId || 1, dv.subtotal || 0, dv.impuesto || 0, dv.total || 0, dv.tasaBcv || 0]
        );
        const id_venta = ventaResult.insertId; 

        for (const detalle of items) {
            // 🔍 VALIDACIÓN DE STOCK MEJORADA
            const [stockActual] = await connection.execute(
                'SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = 1 FOR UPDATE',
                [detalle.productoId]
            );

            const stockDisponible = stockActual[0]?.cantidad || 0;
            
            // Validar stock solo si NO se permite stock negativo
            if (!permitirStockNegativo && stockDisponible < detalle.cantidad) {
                // Obtener nombre del producto para mensaje de error más claro
                const [producto] = await connection.execute(
                    'SELECT nombre FROM productos WHERE id = ?',
                    [detalle.productoId]
                );
                const nombreProducto = producto[0]?.nombre || `ID ${detalle.productoId}`;
                const err = new Error(
                    `Stock insuficiente para "${nombreProducto}". ` +
                    `Disponible: ${stockDisponible}, Solicitado: ${detalle.cantidad}`
                );
                err.status = 400;
                throw err;
            }

            // Insertar detalle de venta
            await connection.execute(
                `INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`,
                [id_venta, detalle.productoId, detalle.cantidad, detalle.precioUnitario]
            );

            // Registrar movimiento de inventario
            const comentarioMovimiento = permitirStockNegativo && stockDisponible < detalle.cantidad 
                ? `Venta #${id_venta} (Stock negativo permitido)` 
                : `Venta #${id_venta}`;
            
            await connection.execute(
                `INSERT INTO movimientos_inventario (id_producto, id_deposito, tipo_movimiento, cantidad, referencia_id, referencia_tabla, comentario)
                 VALUES (?, 1, 'VENTA', ?, ?, 'ventas', ?)`,
                [detalle.productoId, (detalle.cantidad * -1), id_venta, comentarioMovimiento] 
            );

            // Actualizar stock real (puede quedar negativo si está permitido)
            await connection.execute(
                `UPDATE stock_depositos SET cantidad = cantidad - ? WHERE id_producto = ? AND id_deposito = 1`,
                [detalle.cantidad, detalle.productoId]
            );
        }

        await connection.commit(); 
        return { success: true, id_venta };
    } catch (error) {
        if (connection) await connection.rollback(); 
        throw error; 
    } finally {
        if (connection) connection.release();
    }
}
// 5. OBTENER STOCK CRÍTICO
async function obtenerStockCritico() {
    const [rows] = await pool.execute(`
        SELECT p.id, p.codigo, p.nombre, sd.cantidad as stock_actual,
        (5 - sd.cantidad) as unidades_faltantes,
        ((5 - sd.cantidad) * p.precio_costo) as inversion_reposicion
        FROM productos p
        JOIN stock_depositos sd ON p.id = sd.id_producto
        WHERE sd.id_deposito = 1 AND sd.cantidad <= 5
        ORDER BY sd.cantidad ASC
    `);
    return rows;
}

// 6. PROCESAR COMPRA
async function procesarNuevaCompra(datosCompra, detallesProductos) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const facturaReferencia = datosCompra.numeroFactura || `COMP-INT-${Date.now()}`;

        const [compraResult] = await connection.execute(
            `INSERT INTO compras (id_proveedor, total_bruto, metodo_pago, numero_factura_proveedor) 
             VALUES (?, ?, ?, ?)`,
            [datosCompra.proveedorId, datosCompra.total || 0, datosCompra.metodoPago || 'Efectivo', facturaReferencia]
        );
        const id_compra = compraResult.insertId;

        for (const det of detallesProductos) {
            const subtotalLinea = det.cantidad * det.costoUnitario;
            
            // Insertar detalle de compra
            await connection.execute(
                `INSERT INTO detalle_compra (id_compra, id_producto, cantidad, costo_unitario, subtotal) 
                 VALUES (?, ?, ?, ?, ?)`,
                [id_compra, det.productoId, det.cantidad, det.costoUnitario, subtotalLinea]
            );
            
            // 🔄 ACTUALIZAR PRECIO_COSTO automáticamente con el nuevo costo del proveedor
            // Esto permite que el sistema refleje cambios de precios del proveedor
            await connection.execute(
                `UPDATE productos SET precio_costo = ? WHERE id = ?`,
                [det.costoUnitario, det.productoId]
            );
            
            // Bloquear fila de stock y actualizar
            await connection.execute(
                'SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = 1 FOR UPDATE',
                [det.productoId]
            );
            await connection.execute(
                `UPDATE stock_depositos SET cantidad = cantidad + ? WHERE id_producto = ? AND id_deposito = 1`,
                [det.cantidad, det.productoId]
            );
            
            // Registrar movimiento de inventario
            await connection.execute(
                `INSERT INTO movimientos_inventario (id_producto, id_deposito, tipo_movimiento, cantidad, referencia_id, referencia_tabla, comentario)
                 VALUES (?, 1, 'COMPRA', ?, ?, 'compras', ?)`,
                [det.productoId, det.cantidad, id_compra, `Entrada por factura: ${facturaReferencia}. Costo actualizado a ${det.costoUnitario}`]
            );
        }
        await connection.commit();
        return { success: true, id_compra };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

// 7. GANANCIAS DEL DÍA
async function obtenerGananciasHoy() {
    const [rows] = await pool.execute(`
        SELECT COUNT(DISTINCT v.id) as total_ventas,
        IFNULL(SUM(dv.cantidad * dv.precio_unitario), 0) as ingresos_totales,
        IFNULL(SUM(dv.cantidad * p.precio_costo), 0) as costo_mercancia,
        IFNULL((SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * p.precio_costo)), 0) as utilidad_neta
        FROM ventas v
        JOIN detalle_ventas dv ON v.id = dv.id_venta
        JOIN productos p ON dv.id_producto = p.id
        WHERE DATE(v.fecha_venta) = CURDATE()
    `);
    return rows[0];
}

// 8. VENTAS POR VENDEDOR (COMISIONES)
async function obtenerVentasPorVendedor(fechaInicio, fechaFin) {
    const [rows] = await pool.execute(`
        SELECT u.id as usuario_id, u.nombre as vendedor,
        COUNT(v.id) as cantidad_ventas,
        IFNULL(SUM(v.total), 0) as total_ventas_brutas
        FROM usuarios u
        LEFT JOIN ventas v ON u.id = v.id_usuario 
            AND DATE(v.fecha_venta) BETWEEN ? AND ?
        GROUP BY u.id
    `, [fechaInicio, fechaFin]);
    return rows;
}
async function registrarUsuario(datos) {
    const connection = await pool.getConnection();
    try {
        // Encriptamos la clave (10 salt rounds es el estándar)
        const saltRounds = 10;
        const hashedPw = await bcrypt.hash(datos.password, saltRounds);

        const [res] = await connection.execute(
            `INSERT INTO usuarios (username, password, nombre, rol) VALUES (?, ?, ?, ?)`,
            [datos.username, hashedPw, datos.nombre, datos.rol || 'vendedor']
        );
        return { id: res.insertId, username: datos.username };
    } finally {
        connection.release();
    }
}
// En inventario.controller.js
// OBTENER TODOS LOS USUARIOS
async function obtenerUsuarios() {
    const [rows] = await pool.execute('SELECT id, username, nombre, rol, created_at FROM usuarios');
    return rows;
}

// ACTUALIZAR USUARIO (Cambiar nombre, rol, etc.)
async function actualizarUsuario(id, datos) {
    const [result] = await pool.execute(
        `UPDATE usuarios SET username = ?, nombre = ?, rol = ? WHERE id = ?`,
        [datos.username, datos.nombre, datos.rol, id]
    );
    return result.affectedRows > 0;
}

// ELIMINAR UN USUARIO
async function eliminarUsuario(id) {
    const [result] = await pool.execute('DELETE FROM usuarios WHERE id = ?', [id]);
    return result.affectedRows > 0;
}
// OBTENER PRODUCTOS MÁS VENDIDOS
async function obtenerLoMasVendido() {
    const [rows] = await pool.execute(`
        SELECT 
            p.nombre AS producto,
            SUM(dv.cantidad) AS unidades_vendidas,
            SUM(dv.cantidad * dv.precio_unitario) AS total_recaudado
        FROM detalle_ventas dv
        JOIN productos p ON dv.id_producto = p.id
        GROUP BY p.id
        ORDER BY total_recaudado DESC -- <--- Ahora ordenamos por DINERO
        LIMIT 5
    `);
    return rows;
}
// FUNCIÓN DE LOGIN
async function loginUsuario(username, password) {
    // 1. Buscamos al usuario por su username
    const [rows] = await pool.execute(
        'SELECT * FROM usuarios WHERE username = ?',
        [username]
    );

    if (rows.length === 0) {
        throw new Error("Usuario no encontrado.");
    }

    const usuario = rows[0];

    // 2. Comparamos la contraseña enviada con el hash de la DB
    const esValida = await bcrypt.compare(password, usuario.password);

    if (!esValida) {
        throw new Error("Contraseña incorrecta.");
    }

    // 3. Si todo está bien, retornamos los datos básicos del usuario
    // (No devolvemos la contraseña por seguridad)
    return {
        id: usuario.id,
        username: usuario.username,
        nombre: usuario.nombre,
        rol: usuario.rol
    };
}
// 8. OBTENER KARDEX (Historial de movimientos de un producto)
async function obtenerKardexProducto(idProducto) {
    const connection = await pool.getConnection();
    try {
        // Obtener información del producto
        const [producto] = await connection.execute(
            `SELECT id, codigo, nombre, precio_venta, precio_costo 
             FROM productos WHERE id = ?`,
            [idProducto]
        );

        if (producto.length === 0) {
            throw new Error(`Producto con ID ${idProducto} no encontrado.`);
        }

        // Obtener stock actual
        const [stockActual] = await connection.execute(
            `SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = 1`,
            [idProducto]
        );

        // Obtener todos los movimientos del producto ordenados por fecha
        const [movimientos] = await connection.execute(
            `SELECT 
                m.id,
                m.tipo_movimiento,
                m.cantidad,
                m.fecha_movimiento,
                m.referencia_id,
                m.referencia_tabla,
                m.comentario,
                CASE 
                    WHEN m.referencia_tabla = 'ventas' THEN 
                        (SELECT CONCAT('Venta #', v.id, ' - Cliente: ', c.razon_social) 
                         FROM ventas v 
                         LEFT JOIN clientes c ON v.id_cliente = c.id 
                         WHERE v.id = m.referencia_id)
                    WHEN m.referencia_tabla = 'compras' THEN 
                        (SELECT CONCAT('Compra #', c.id, ' - Proveedor: ', p.nombre) 
                         FROM compras c 
                         LEFT JOIN proveedores p ON c.id_proveedor = p.id 
                         WHERE c.id = m.referencia_id)
                    ELSE m.comentario
                END as descripcion,
                CASE 
                    WHEN m.tipo_movimiento = 'COMPRA' OR m.tipo_movimiento = 'AJUSTE_ENTRADA' THEN 'ENTRADA'
                    WHEN m.tipo_movimiento = 'VENTA' OR m.tipo_movimiento = 'AJUSTE_SALIDA' THEN 'SALIDA'
                END as tipo_operacion
            FROM movimientos_inventario m
            WHERE m.id_producto = ?
            ORDER BY m.fecha_movimiento DESC`,
            [idProducto]
        );

        // Calcular stock acumulado (Kardex)
        // Empezamos desde el stock actual y vamos hacia atrás en el tiempo
        let stockAcumulado = stockActual[0]?.cantidad || 0;
        const movimientosConStock = movimientos.map(mov => {
            // La cantidad en movimientos_inventario ya es positiva para entradas y negativa para salidas
            // Entonces para calcular el stock antes del movimiento, hacemos la operación inversa
            if (mov.cantidad > 0) {
                // Fue una entrada, entonces antes había menos
                stockAcumulado -= mov.cantidad;
            } else {
                // Fue una salida, entonces antes había más
                stockAcumulado += Math.abs(mov.cantidad);
            }
            return {
                ...mov,
                stock_antes: stockAcumulado,
                stock_despues: stockAcumulado + (mov.cantidad > 0 ? mov.cantidad : mov.cantidad)
            };
        }).reverse(); // Invertir para mostrar cronológicamente (más antiguo primero)

        return {
            producto: producto[0],
            stock_actual: stockActual[0]?.cantidad || 0,
            total_movimientos: movimientos.length,
            movimientos: movimientosConStock
        };
    } catch (error) {
        throw error;
    } finally {
        connection.release();
    }
}

// FUNCIONES DE APOYO RESTANTES
async function procesarDevolucion(datosDevolucion) { /* ... */ }
async function obtenerStockPorDepositos() { /* ... */ }
async function actualizarProducto(id, datos) { /* ... */ }
async function procesarAjusteInventario(datosAjuste) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        const usuarioId = datosAjuste?.usuarioId || null;
        const motivo = datosAjuste?.motivo || 'Ajuste manual';
        const permitirStockNegativo = datosAjuste?.permitirStockNegativo || false;
        const detalles = Array.isArray(datosAjuste?.detalles) ? datosAjuste.detalles : [];

        if (usuarioId) {
            const [usuario] = await connection.execute('SELECT id FROM usuarios WHERE id = ?', [usuarioId]);
            if (usuario.length === 0) {
                const err = new Error(`Usuario con ID ${usuarioId} no existe.`);
                err.status = 400;
                throw err;
            }
        }

        if (detalles.length === 0) {
            const err = new Error('No se proporcionaron detalles de ajuste.');
            err.status = 400;
            throw err;
        }

        for (const det of detalles) {
            const productoId = det.productoId;
            const id_deposito = det.id_deposito || 1;
            const cantidadRaw = Number(det.cantidad);
            if (!productoId || Number.isNaN(cantidadRaw)) {
                const err = new Error('Detalle inválido: se requiere productId y cantidad numérica.');
                err.status = 400;
                throw err;
            }

            const tipo = (det.tipo || (cantidadRaw >= 0 ? 'ENTRADA' : 'SALIDA')).toUpperCase();
            const cantidad = Math.abs(cantidadRaw);

            // Asegurarnos de que exista la fila de stock (bloqueada)
            const [stockRows] = await connection.execute(
                'SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = ? FOR UPDATE',
                [productoId, id_deposito]
            );

            if (stockRows.length === 0) {
                await connection.execute(
                    'INSERT INTO stock_depositos (id_producto, id_deposito, cantidad) VALUES (?, ?, ?)',
                    [productoId, id_deposito, 0]
                );
            }

            // Volver a leer el stock ahora que la fila existe y está bloqueada
            const [stockAfterEnsure] = await connection.execute(
                'SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = ? FOR UPDATE',
                [productoId, id_deposito]
            );
            let stockDisponible = stockAfterEnsure[0]?.cantidad || 0;

            let movimientoCantidad;
            if (tipo === 'SALIDA') {
                movimientoCantidad = -cantidad;
                if (!permitirStockNegativo && stockDisponible < cantidad) {
                    const [prod] = await connection.execute('SELECT nombre FROM productos WHERE id = ?', [productoId]);
                    const nombre = prod[0]?.nombre || `ID ${productoId}`;
                    const err = new Error(
                        `Stock insuficiente para "${nombre}". Disponible: ${stockDisponible}, Solicitado: ${cantidad}`
                    );
                    err.status = 400;
                    throw err;
                }

                await connection.execute(
                    'UPDATE stock_depositos SET cantidad = cantidad - ? WHERE id_producto = ? AND id_deposito = ?',
                    [cantidad, productoId, id_deposito]
                );
            } else {
                // ENTRADA
                movimientoCantidad = cantidad;
                await connection.execute(
                    'UPDATE stock_depositos SET cantidad = cantidad + ? WHERE id_producto = ? AND id_deposito = ?',
                    [cantidad, productoId, id_deposito]
                );
            }

            const comentario = `Ajuste: ${motivo}. Usuario: ${usuarioId || 'sistema'}`;

            await connection.execute(
                `INSERT INTO movimientos_inventario (id_producto, id_deposito, tipo_movimiento, cantidad, referencia_id, referencia_tabla, comentario)
                 VALUES (?, ?, 'AJUSTE', ?, NULL, 'ajustes', ?)`,
                [productoId, id_deposito, movimientoCantidad, comentario]
            );
        }

        await connection.commit();
        return { success: true, detallesProcesados: detalles.length };
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
}
async function trasladarMercancia(datos) { /* ... */ }
async function obtenerValoracionInventario() { /* ... */ }

module.exports = { 
    procesarNuevaVenta, procesarNuevaCompra, obtenerProductoPorId,
    obtenerTodosLosProductos, crearProducto, procesarDevolucion,
    obtenerStockPorDepositos, actualizarProducto, procesarAjusteInventario, 
    trasladarMercancia, obtenerValoracionInventario, obtenerStockCritico,
    obtenerGananciasHoy, obtenerVentasPorVendedor, registrarUsuario, obtenerUsuarios, 
    actualizarUsuario, eliminarUsuario, obtenerLoMasVendido, loginUsuario,
    obtenerKardexProducto

};