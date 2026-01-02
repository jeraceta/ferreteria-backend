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

async function crearProducto(datos) {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. VALIDACIÓN: Verificar si el código ya existe
        const [existe] = await connection.execute(
            'SELECT id FROM productos WHERE codigo = ?', 
            [datos.codigo]
        );

        if (existe.length > 0) {
            // Si el código existe, lanzamos error y el catch hará el rollback
            const err = new Error(`El código ${datos.codigo} ya está registrado.`);
            err.status = 400; 
            throw err;
        }

        // 2. INSERTAR CABECERA: Crear el producto
        const [resProd] = await connection.execute(
            `INSERT INTO productos (codigo, nombre, precio_venta, precio_costo) VALUES (?, ?, ?, ?)`,
            [datos.codigo, datos.nombre, datos.precio_venta || 0, datos.precio_costo || 0]
        );
        const nuevoId = resProd.insertId;

        // 3. INSERTAR STOCK: Inicializar los 3 depósitos para este nuevo producto
        const sqlStock = `INSERT INTO stock_depositos (id_producto, id_deposito, cantidad) VALUES (?, ?, ?)`;
        await connection.execute(sqlStock, [nuevoId, 1, datos.stock || 0]); // Principal
        await connection.execute(sqlStock, [nuevoId, 2, 0]);               // Dañado
        await connection.execute(sqlStock, [nuevoId, 3, 0]);               // Inmovilizado

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
        
        // 🔒 BLOQUEO DE SEGURIDAD: Verificar si ya se hizo el Cierre Z hoy
        const [cierreHoy] = await connection.execute(
            `SELECT id FROM cierres_diarios WHERE DATE(fecha_cierre) = CURDATE() LIMIT 1`
        );

        if (cierreHoy.length > 0) {
            const err = new Error("No se pueden registrar ventas: Ya se generó el Cierre Z de hoy.");
            err.status = 403; // Forbidden
            throw err;
        }

        const dv = datosVenta || {}; 
        const items = detallesProductos || [];
        
        const permitirStockNegativo = dv.permitirStockNegativo || false;

        // 🔍 VALIDACIÓN: Vendedor
        const [usuarioExiste] = await connection.execute(
            'SELECT id FROM usuarios WHERE id = ?',
            [dv.usuarioId || 1]
        );

        if (usuarioExiste.length === 0) {
            throw new Error(`El vendedor con ID ${dv.usuarioId || 1} no existe.`);
        }

        // 🔍 VALIDACIÓN: Cliente
        const [clienteExiste] = await connection.execute(
            'SELECT id FROM clientes WHERE id = ?',
            [dv.clienteId || 1]
        );

        if (clienteExiste.length === 0) {
            const err = new Error(`El cliente con ID ${dv.clienteId || 1} no existe.`);
            err.status = 400;
            throw err;
        }

        // Registrar la cabecera de la venta (nace como PENDIENTE por el DEFAULT de la DB)
        const [ventaResult] = await connection.execute(
            `INSERT INTO ventas (id_cliente, id_usuario, subtotal, impuesto, total, tasa_bcv, estado_cierre) 
             VALUES (?, ?, ?, ?, ?, ?, 'PENDIENTE')`,
            [dv.clienteId || 1, dv.usuarioId || 1, dv.subtotal || 0, dv.impuesto || 0, dv.total || 0, dv.tasaBcv || 0]
        );
        const id_venta = ventaResult.insertId; 

        for (const detalle of items) {
            // 🔍 VALIDACIÓN DE STOCK + BLOQUEO DE FILA
            const [stockActual] = await connection.execute(
                'SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = 1 FOR UPDATE',
                [detalle.productoId]
            );

            const stockDisponible = stockActual[0]?.cantidad || 0;
            
            if (!permitirStockNegativo && stockDisponible < detalle.cantidad) {
                const [producto] = await connection.execute(
                    'SELECT nombre FROM productos WHERE id = ?',
                    [detalle.productoId]
                );
                const nombreProducto = producto[0]?.nombre || `ID ${detalle.productoId}`;
                const err = new Error(`Stock insuficiente para "${nombreProducto}".`);
                err.status = 400;
                throw err;
            }

            // Insertar detalle
            await connection.execute(
                `INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario) VALUES (?, ?, ?, ?)`,
                [id_venta, detalle.productoId, detalle.cantidad, detalle.precioUnitario]
            );

            // Registrar movimiento
            const comentarioMovimiento = permitirStockNegativo && stockDisponible < detalle.cantidad 
                ? `Venta #${id_venta} (Stock negativo)` : `Venta #${id_venta}`;
            
            await connection.execute(
                `INSERT INTO movimientos_inventario (id_producto, id_deposito, tipo_movimiento, cantidad, referencia_id, referencia_tabla, comentario)
                 VALUES (?, 1, 'VENTA', ?, ?, 'ventas', ?)`,
                [detalle.productoId, (detalle.cantidad * -1), id_venta, comentarioMovimiento] 
            );

            // Actualizar stock
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

async function obtenerInventarioCritico() {
    const [rows] = await pool.execute(`
        SELECT 
            p.codigo,
            p.nombre,
            sd.cantidad AS stock_actual,
            p.stock_minimo
        FROM productos p
        JOIN stock_depositos sd ON p.id = sd.id_producto
        WHERE sd.id_deposito = 1 AND sd.cantidad <= p.stock_minimo
        ORDER BY stock_actual ASC
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

// 7. GANANCIAS DE LA TIENDA
async function obtenerGananciasTienda(fechaInicio, fechaFin) {
    let query = `
        SELECT COUNT(DISTINCT v.id) as total_ventas,
        IFNULL(SUM(dv.cantidad * dv.precio_unitario), 0) as ingresos_totales,
        IFNULL(SUM(dv.cantidad * p.precio_costo), 0) as costo_mercancia,
        IFNULL((SUM(dv.cantidad * dv.precio_unitario) - SUM(dv.cantidad * p.precio_costo)), 0) as utilidad_neta
        FROM ventas v
        JOIN detalle_ventas dv ON v.id = dv.id_venta
        JOIN productos p ON dv.id_producto = p.id`;

    const whereConditions = [];
    const params = [];

    if (fechaInicio && fechaFin) {
        whereConditions.push(`DATE(v.fecha_venta) BETWEEN ? AND ?`);
        params.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
        whereConditions.push(`DATE(v.fecha_venta) >= ?`);
        params.push(fechaInicio);
    } else if (fechaFin) {
        whereConditions.push(`DATE(v.fecha_venta) <= ?`);
        params.push(fechaFin);
    }

    if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const [rows] = await pool.execute(query, params);
    return rows[0];
}

// 8. VENTAS POR VENDEDOR (COMISIONES)
async function obtenerVentasPorVendedor(fechaInicio, fechaFin, porcentajeComision = 5) {
    // Asegurarse que el valor es un número, si no, usar el default.
    const comisionValue = parseFloat(porcentajeComision) || 5;
    const params = [comisionValue]; // El primer parámetro siempre es la comisión

    let query = `
        SELECT 
            u.id as usuario_id, 
            u.nombre as vendedor,
            COUNT(v.id) as cantidad_ventas,
            IFNULL(SUM(v.total), 0) as total_ventas_brutas,
            (IFNULL(SUM(v.total), 0) * ? / 100) as comision
        FROM usuarios u
        LEFT JOIN ventas v ON u.id = v.id_usuario`;

    if (fechaInicio && fechaFin) {
        query += ` AND DATE(v.fecha_venta) BETWEEN ? AND ?`;
        params.push(fechaInicio, fechaFin); // Los siguientes son las fechas
    }

    query += ` 
        GROUP BY u.id, u.nombre
        ORDER BY total_ventas_brutas DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
}

async function obtenerVentasPorMetodoPago(fechaInicio, fechaFin) {
    const params = [];
    let query = `
        SELECT
            metodo_pago,
            COUNT(id) AS cantidad_transacciones,
            IFNULL(SUM(total), 0) AS monto_total
        FROM ventas
    `;

    const whereConditions = [];
    if (fechaInicio && fechaFin) {
        whereConditions.push(`DATE(fecha_venta) BETWEEN ? AND ?`);
        params.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
        whereConditions.push(`DATE(fecha_venta) >= ?`);
        params.push(fechaInicio);
    } else if (fechaFin) {
        whereConditions.push(`DATE(fecha_venta) <= ?`);
        params.push(fechaFin);
    }

    if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += `
        GROUP BY metodo_pago
        ORDER BY monto_total DESC
    `;

    const [rows] = await pool.execute(query, params);
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
            (SELECT SUM(dv.cantidad) FROM detalle_ventas dv WHERE dv.id_producto = p.id) AS unidades_vendidas,
            (SELECT SUM(dv.cantidad * dv.precio_unitario) FROM detalle_ventas dv WHERE dv.id_producto = p.id) AS total_recaudado
        FROM productos p
        GROUP BY p.id
        ORDER BY total_recaudado DESC
        LIMIT 5
    `);
    return rows;
}

// OBTENER TOP 10 PRODUCTOS MÁS VENDIDOS POR RANGO DE FECHA
async function obtenerProductosMasVendidos(fechaInicio, fechaFin) {
    const params = [];
    let query = `
        SELECT
            p.nombre AS producto,
            p.codigo,
            SUM(dv.cantidad) AS cantidad_vendida,
            SUM(dv.cantidad * dv.precio_unitario) AS total_generado
        FROM detalle_ventas dv
        JOIN productos p ON dv.id_producto = p.id
        JOIN ventas v ON dv.id_venta = v.id
    `;

    const whereConditions = [];
    if (fechaInicio && fechaFin) {
        whereConditions.push(`DATE(v.fecha_venta) BETWEEN ? AND ?`);
        params.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
        whereConditions.push(`DATE(v.fecha_venta) >= ?`);
        params.push(fechaInicio);
    } else if (fechaFin) {
        whereConditions.push(`DATE(v.fecha_venta) <= ?`);
        params.push(fechaFin);
    }

    if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    query += `
        GROUP BY p.id, p.nombre, p.codigo
        ORDER BY cantidad_vendida DESC
        LIMIT 10
    `;

    const [rows] = await pool.execute(query, params);
    return rows;
}
// FUNCIÓN DE LOGIN
async function loginUsuario(username, password) {
    const [rows] = await pool.execute(
        `SELECT id, username, password, nombre, rol FROM usuarios WHERE username = ?`,
        [username]
    );

    if (rows.length === 0) {
        // Throwing an error is better for the route handler's try...catch block
        const err = new Error('Usuario no encontrado');
        err.status = 404;
        throw err;
    }

    const usuario = rows[0];

    // Verificar la contraseña
    const passwordMatch = await bcrypt.compare(password, usuario.password);

    if (!passwordMatch) {
        const err = new Error('Credenciales inválidas');
        err.status = 401;
        throw err;
    }

    // Return only non-sensitive data
    const { password: pw, ...user } = usuario;
    return user;
}
// 8. OBTENER KARDEX (Historial de movimientos de un producto)
async function obtenerKardexProducto(idProducto) {
    const connection = await pool.getConnection();
    try {
        const [producto] = await connection.execute(
            `SELECT id, codigo, nombre, precio_venta, precio_costo 
             FROM productos WHERE id = ?`,
            [idProducto]
        );

        if (producto.length === 0) {
            throw new Error('Producto no encontrado');
        }

        await connection.beginTransaction();

        const [stockActual] = await connection.execute(
            `SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = 1`,
            [idProducto]
        );

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
                    WHEN m.tipo_movimiento IN ('COMPRA', 'AJUSTE_ENTRADA', 'DEVOLUCION_CLIENTE') THEN 'ENTRADA'
                    WHEN m.tipo_movimiento IN ('VENTA', 'AJUSTE_SALIDA', 'DEVOLUCION_PROVEEDOR') THEN 'SALIDA'
                    ELSE 'AJUSTE'
                END as tipo_operacion
            FROM movimientos_inventario m
            WHERE m.id_producto = ?
            ORDER BY m.fecha_movimiento ASC`,
            [idProducto]
        );

        let stockAcumulado = 0;
        const movimientosConStock = movimientos.map(mov => {
            const stockAntes = stockAcumulado;
            stockAcumulado += parseFloat(mov.cantidad);
            return {
                ...mov,
                stock_antes: stockAntes,
                stock_despues: stockAcumulado
            };
        });

        await connection.commit();

        return {
            producto: producto[0],
            stock_actual: stockActual[0]?.cantidad || 0,
            total_movimientos: movimientos.length,
            movimientos: movimientosConStock.reverse()
        };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// FUNCIONES DE APOYO RESTANTES

async function procesarAjusteInventario(datos) {
    const { id_producto, id_deposito, cantidad_nueva, motivo, tipo_ajuste } = datos;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Obtener cantidad anterior
        const [actual] = await connection.execute(
            'SELECT cantidad FROM stock_depositos WHERE id_producto = ? AND id_deposito = ?',
            [id_producto, id_deposito]
        );
        const cantidadAnterior = actual[0]?.cantidad || 0;
        const diferencia = tipo_ajuste === 'ENTRADA' ? cantidad_nueva : (cantidad_nueva * -1);

        // 2. Actualizar stock
        await connection.execute(
            'UPDATE stock_depositos SET cantidad = cantidad + ? WHERE id_producto = ? AND id_deposito = ?',
            [diferencia, id_producto, id_deposito]
        );

        // 3. Registrar en Kardex
        await connection.execute(
            `INSERT INTO movimientos_inventario 
            (id_producto, tipo_movimiento, cantidad, comentario, referencia_tabla) 
            VALUES (?, ?, ?, ?, 'ajustes')`,
            [id_producto, `AJUSTE_${tipo_ajuste}`, diferencia, motivo]
        );

        await connection.commit();
        return { success: true };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
// --- FUNCION 1: REPORTE X (Solo lectura) ---
const obtenerReporteX = async (req, res) => {
    try {
        const [reporte] = await pool.query(`
            SELECT 
                IFNULL(SUM(v.total), 0) as ingresos_totales,
                IFNULL(SUM(dv.cantidad * p.precio_costo), 0) as costo_total_mercancia,
                (IFNULL(SUM(v.total), 0) - IFNULL(SUM(dv.cantidad * p.precio_costo), 0)) as ganancia_neta
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.id_venta
            JOIN productos p ON dv.id_producto = p.id
            WHERE v.estado_cierre = 'PENDIENTE' -- <--- Importante: solo lo no cerrado
        `);

        res.json({
            success: true,
            tipo: "REPORTE X",
            mensaje: "Lectura parcial de ventas acumuladas.",
            datos: reporte[0]
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};

// --- FUNCION 2: GENERAR CIERRE Z (Cierre definitivo) ---
const generarCierreZ = async (req, res) => {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();

        // 1. Obtener los totales actuales de las ventas PENDIENTES
        const [totales] = await connection.execute(`
            SELECT 
                IFNULL(SUM(v.total), 0) as ingresos_totales,
                IFNULL(SUM(dv.cantidad * p.precio_costo), 0) as costo_total_mercancia
            FROM ventas v
            JOIN detalle_ventas dv ON v.id = dv.id_venta
            JOIN productos p ON dv.id_producto = p.id
            WHERE v.estado_cierre = 'PENDIENTE'
            FOR UPDATE
        `);

        const ingresos = parseFloat(totales[0].ingresos_totales);
        const costos = parseFloat(totales[0].costo_total_mercancia);
        const utilidad = ingresos - costos;

        // Si no hay ventas, podemos decidir si cerrar en 0 o dar un error
        if (ingresos === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, error: "No hay ventas pendientes para realizar un cierre Z." });
        }

        // 2. Guardar en el historial de cierres
        // Usamos req.user.id (asegúrate que el middleware 'requiereAuth' esté funcionando)
        await connection.execute(
            `INSERT INTO cierres_diarios (ingresos_totales, costo_mercancia, utilidad_neta, usuario_id) 
             VALUES (?, ?, ?, ?)`,
            [ingresos, costos, utilidad, req.user.id]
        );

        // 3. Marcar todas las ventas como cerradas
        await connection.execute(`
            UPDATE ventas 
            SET estado_cierre = 'CERRADO' 
            WHERE estado_cierre = 'PENDIENTE'
        `);

      const utilidadFormateada = parseFloat(utilidad.toFixed(2));

        res.json({ 
            success: true, 
            mensaje: "Reporte Z generado con éxito. La caja ha sido cerrada.",
            cierre: {
                total_venta: ingresos,
                ganancia: utilidadFormateada // <--- Usamos la variable formateada aquí
            }
        });

    } catch (error) {
        if (connection) await connection.rollback();
        res.status(500).json({ success: false, error: error.message });
    } finally {
        if (connection) connection.release();
    }
};
// --- FUNCION: OBTENER HISTORIAL DE CIERRES ---
async function obtenerHistorialCierres() {
    const [rows] = await pool.execute(`
        SELECT 
            c.id, 
            c.fecha_cierre, 
            c.ingresos_totales, 
            c.costo_mercancia, 
            c.utilidad_neta, 
            u.nombre as gerente
        FROM cierres_diarios c
        JOIN usuarios u ON c.usuario_id = u.id
        ORDER BY c.fecha_cierre DESC
    `);
    return rows;
}
// --- NUEVO: REPORTE PARA INVENTARIO MANUAL (TOMA FÍSICA) ---
async function obtenerReporteTomaFisica(idCategoria = null) {
    let query = `
        SELECT p.id, p.codigo, p.nombre as producto, sd.cantidad as stock_sistema, '' as conteo_real
        FROM productos p
        JOIN stock_depositos sd ON p.id = sd.id_producto
        WHERE sd.id_deposito = 1
    `;
    const params = [];
    if (idCategoria) {
        query += ` AND p.id_categoria = ?`;
        params.push(idCategoria);
    }
    const [rows] = await pool.execute(query, params);
    return rows;
}

// --- NUEVO: DATOS PARA GRÁFICO ---
async function obtenerVentasMensuales() {
    const [rows] = await pool.execute(`
        SELECT DATE_FORMAT(fecha_venta, '%Y-%m') as mes, SUM(total) as total_ventas
        FROM ventas
        WHERE fecha_venta >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
        GROUP BY mes ORDER BY mes ASC
    `);
    return rows;
}
async function trasladarMercancia(idProducto, idOrigen, idDestino, cantidad, comentario = 'Traslado interno') {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Restar del origen
        const [restar] = await connection.execute(
            'UPDATE stock_depositos SET cantidad = cantidad - ? WHERE id_producto = ? AND id_deposito = ?',
            [cantidad, idProducto, idOrigen]
        );

        // 2. Sumar al destino
        const [sumar] = await connection.execute(
            'UPDATE stock_depositos SET cantidad = cantidad + ? WHERE id_producto = ? AND id_deposito = ?',
            [cantidad, idProducto, idDestino]
        );

        // 3. Registrar el movimiento en el historial (Kardex)
        await connection.execute(
            `INSERT INTO movimientos_inventario 
            (id_producto, tipo_movimiento, cantidad, comentario, referencia_tabla) 
            VALUES (?, 'TRASLADO', ?, ?, 'stock_depositos')`,
            [idProducto, 0, `${comentario}: Movidas ${cantidad} unidades del depósito ${idOrigen} al ${idDestino}`]
        );

        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
async function actualizarProducto(id, datos) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Validar que el código no lo tenga OTRO producto diferente al que estamos editando
        const [existe] = await connection.execute(
            'SELECT id FROM productos WHERE codigo = ? AND id != ?', 
            [datos.codigo, id]
        );

        if (existe.length > 0) {
            throw new Error(`El código ${datos.codigo} ya está siendo usado por otro producto.`);
        }

        const [res] = await connection.execute(
            `UPDATE productos 
             SET codigo = ?, nombre = ?, precio_venta = ?, precio_costo = ? 
             WHERE id = ?`,
            [datos.codigo, datos.nombre, datos.precio_venta, datos.precio_costo, id]
        );

        await connection.commit();
        return res.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
async function eliminarProducto(id) {
    // Primero verificamos si tiene movimientos para no romper la integridad
    const [movimientos] = await pool.execute(
        'SELECT id FROM movimientos_inventario WHERE id_producto = ? LIMIT 1', 
        [id]
    );

    if (movimientos.length > 0) {
        // Si tiene movimientos, solo lo desactivamos
        const [res] = await pool.execute('UPDATE productos SET estado = "INACTIVO" WHERE id = ?', [id]);
        return { success: true, message: "Producto desactivado (tenía historial)." };
    } else {
        // Si es nuevo y no tiene nada, se puede borrar
        await pool.execute('DELETE FROM stock_depositos WHERE id_producto = ?', [id]);
        await pool.execute('DELETE FROM productos WHERE id = ?', [id]);
        return { success: true, message: "Producto eliminado definitivamente." };
    }
}
async function procesarDevolucion(datosDevolucion) {
    const { id_venta, id_producto, cantidad, motivo, usuario_id } = datosDevolucion;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Verificar que la venta y el producto existan en el detalle
        const [detalle] = await connection.execute(
            'SELECT cantidad, precio_unitario FROM detalle_ventas WHERE id_venta = ? AND id_producto = ?',
            [id_venta, id_producto]
        );

        if (detalle.length === 0) {
            throw new Error("El producto no pertenece a la venta especificada.");
        }

        if (cantidad > detalle[0].cantidad) {
            throw new Error("La cantidad a devolver supera la cantidad vendida.");
        }

        // 2. Aumentar el stock en el depósito principal (id_deposito = 1)
        await connection.execute(
            'UPDATE stock_depositos SET cantidad = cantidad + ? WHERE id_producto = ? AND id_deposito = 1',
            [cantidad, id_producto]
        );

        // 3. Registrar el movimiento en el Kardex
        const comentario = `Devolución Venta #${id_venta}. Motivo: ${motivo}`;
        await connection.execute(
            `INSERT INTO movimientos_inventario (id_producto, id_deposito, tipo_movimiento, cantidad, referencia_id, referencia_tabla, comentario)
             VALUES (?, 1, 'DEVOLUCION_CLIENTE', ?, ?, 'ventas', ?)`,
            [id_producto, cantidad, id_venta, comentario]
        );

        // 4. (Opcional) Aquí podrías insertar una lógica para registrar el saldo a favor del cliente

        await connection.commit();
        return { success: true, mensaje: "Devolución procesada correctamente" };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}
async function obtenerStockPorDepositos() {
    const [rows] = await pool.execute(`
        SELECT 
            p.id, 
            p.codigo, 
            p.nombre as producto,
            SUM(CASE WHEN sd.id_deposito = 1 THEN sd.cantidad ELSE 0 END) as principal,
            SUM(CASE WHEN sd.id_deposito = 2 THEN sd.cantidad ELSE 0 END) as danado,
            SUM(CASE WHEN sd.id_deposito = 3 THEN sd.cantidad ELSE 0 END) as inmovilizado,
            SUM(sd.cantidad) as stock_total
        FROM productos p
        LEFT JOIN stock_depositos sd ON p.id = sd.id_producto
        GROUP BY p.id
    `);
    return rows;
}
async function obtenerValoracionInventario() {
    const [rows] = await pool.execute(`
        SELECT 
            c.nombre as categoria,
            COUNT(p.id) as cantidad_productos,
            SUM(sd.cantidad) as unidades_totales,
            SUM(sd.cantidad * p.precio_costo) as inversion_total_costo,
            SUM(sd.cantidad * p.precio_venta) as valor_potencial_venta
        FROM productos p
        INNER JOIN categorias c ON p.id_categoria = c.id
        INNER JOIN stock_depositos sd ON p.id = sd.id_producto
        WHERE sd.id_deposito = 1 -- Valoramos solo lo que está para la venta
        GROUP BY c.id
        ORDER BY inversion_total_costo DESC
    `);
    return rows;
}

module.exports = { 
    procesarNuevaVenta, procesarNuevaCompra, obtenerProductoPorId,
    obtenerTodosLosProductos, crearProducto, procesarDevolucion,
    obtenerStockPorDepositos, actualizarProducto, procesarAjusteInventario, 
    trasladarMercancia, obtenerValoracionInventario, obtenerStockCritico,
    obtenerGananciasTienda, obtenerVentasPorVendedor, registrarUsuario, obtenerUsuarios, 
    actualizarUsuario, eliminarUsuario, obtenerLoMasVendido, loginUsuario,
    obtenerKardexProducto, generarCierreZ, obtenerReporteX, obtenerHistorialCierres,
    obtenerReporteTomaFisica, obtenerVentasMensuales, obtenerProductosMasVendidos,
    obtenerVentasPorMetodoPago, obtenerInventarioCritico
};