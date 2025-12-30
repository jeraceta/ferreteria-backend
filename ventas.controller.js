const pool = require('./db');

async function procesarVenta(datosVenta, detalleProductos) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Validaciones previas y Cálculo de totales
        const tasaIVA = 0.16;
        let subtotal = 0;

        for (const item of detalleProductos) {
            // CONSULTAR STOCK ACTUAL Y NOMBRE antes de procesar (bloqueo FOR UPDATE)
            const [producto] = await connection.execute(
                'SELECT nombre, stock FROM productos WHERE id = ? FOR UPDATE',
                [item.id_producto]
            );

            if (producto.length === 0) {
                const err = new Error(`El producto con ID ${item.id_producto} no existe.`);
                err.status = 400;
                throw err;
            }

            const stockActual = producto[0].stock;

            // VALIDAR SI HAY STOCK SUFICIENTE
            if (stockActual < item.cantidad) {
                const err = new Error(`Stock insuficiente para "${producto[0].nombre}". Disponible: ${stockActual}, Solicitado: ${item.cantidad}`);
                err.status = 400;
                throw err;
            }

            subtotal += item.cantidad * item.precio_unitario;
        }

        const impuesto = subtotal * tasaIVA;
        const total = subtotal + impuesto;

        // 2. Insertar en la tabla 'ventas' (Cabecera)
    // Dentro de tu controlador de ventas
const [ventaResult] = await connection.execute( 
    `INSERT INTO ventas (id_cliente, id_usuario, subtotal, impuesto, total, tasa_bcv)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
        datosVenta.clienteId, 
        datosVenta.usuarioId, 
        datosVenta.subtotal, 
        datosVenta.impuesto, 
        datosVenta.total, 
        datosVenta.tasaBcv
    ]
);
        
        const idVenta = ventaResult.insertId;

        // 3. Insertar detalle y DESCONTAR stock definitivamente
        for (const item of detalleProductos) {
            // Insertar en detalle_ventas
            await connection.execute(
                `INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario) 
                 VALUES (?, ?, ?, ?)`,
                [idVenta, item.id_producto, item.cantidad, item.precio_unitario]
            );

            // Restar del inventario (ya validamos que sí hay disponible)
            await connection.execute(
                `UPDATE productos SET stock = stock - ? WHERE id = ?`,
                [item.cantidad, item.id_producto]
            );
        }

        await connection.commit();
        
        return { 
            id_venta: idVenta, 
            total_bolivares: total * datosVenta.tasa_bcv, 
            total_dolares: total,
            mensaje: "Venta procesada con éxito" 
        };

    } catch (error) {
        // Si algo falla o no hay stock, se deshacen todos los cambios
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { procesarVenta };