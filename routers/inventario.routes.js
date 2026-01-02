const express = require('express');
const router = express.Router();
const { requiereAuth, esGerente } = require('../middlewares/auth.middleware');
const jwt = require('jsonwebtoken');

// Importamos las funciones del controlador de inventario
const { 
    procesarNuevaCompra, 
    procesarNuevaVenta, 
    obtenerProductoPorId,
    obtenerTodosLosProductos,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
    procesarDevolucion,
    obtenerStockPorDepositos,
    procesarAjusteInventario, 
    trasladarMercancia,
    obtenerValoracionInventario,
    obtenerStockCritico,
    obtenerGananciasTienda,
    obtenerVentasPorVendedor,
    registrarUsuario,
    obtenerUsuarios,
    actualizarUsuario,
    obtenerLoMasVendido,
    loginUsuario,
    obtenerKardexProducto,
    obtenerReporteX,
    generarCierreZ,
    obtenerHistorialCierres,
    obtenerVentasMensuales,
    obtenerReporteTomaFisica,
    obtenerProductosMasVendidos,
    obtenerVentasPorMetodoPago,
    obtenerInventarioCritico
} = require('../inventario.controller');


// --- 1. AUTENTICACIÓN ---

router.post('/login', async (req, res, next) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'Usuario y contraseña son requeridos.' });
        }
        
        // El controlador ahora lanza un error si el login falla, que será capturado por el catch.
        const usuario = await loginUsuario(username, password);

        // Generamos el Token JWT
        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            mensaje: `¡Bienvenido ${usuario.nombre}!`,
            token: token,
            user: usuario // Se devuelve el usuario sin la contraseña
        });
    } catch (error) {
        // Pasamos el error al middleware de errores.
        // El status code se puede definir en el controlador (e.g., err.status = 401)
        next(error);
    }
});


// --- 2. PRODUCTOS (CRUD) ---

// Obtener todos los productos (lista principal)
router.get('/productos', requiereAuth, async (req, res, next) => {
    try {
        const productos = await obtenerTodosLosProductos();
        res.status(200).json(productos);
    } catch (error) { next(error); }
});

// Obtener un producto por su ID
router.get('/producto/:id', requiereAuth, async (req, res, next) => {
    try {
        const producto = await obtenerProductoPorId(req.params.id);
        res.status(200).json(producto);
    } catch (error) { next(error); }
});

// Crear un nuevo producto
router.post('/producto', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const nuevoProducto = await crearProducto(req.body);
        res.status(201).json({ success: true, producto: nuevoProducto });
    } catch (error) { next(error); }
});

// Actualizar un producto existente
router.put('/producto/:id', requiereAuth, esGerente, async (req, res, next) => {
    try {
        await actualizarProducto(req.params.id, req.body);
        res.json({ success: true, mensaje: "Producto actualizado correctamente" });
    } catch (error) { next(error); }
});

// Eliminar (o desactivar) un producto
router.delete('/producto/:id', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const resultado = await eliminarProducto(req.params.id);
        res.json(resultado);
    } catch (error) { next(error); }
});


// --- 3. MOVIMIENTOS DE INVENTARIO ---

// Registrar una nueva compra
router.post('/compra', requiereAuth, esGerente, async (req, res, next) => { 
    try {
        const { datosCompra, detalle } = req.body; 
        const resultado = await procesarNuevaCompra(datosCompra, detalle);
        res.status(201).json({ success: true, compraId: resultado.id_compra });
    } catch (error) { next(error); }
});

// Registrar una nueva venta
router.post('/venta', requiereAuth, async (req, res, next) => {
    try {
        const { datosVenta, detalle } = req.body;
        const resultado = await procesarNuevaVenta(datosVenta, detalle);
        res.json({ success: true, ventaId: resultado.id_venta });
    } catch (error) { next(error); }
});

// Procesar una devolución de cliente
router.post('/devolucion', requiereAuth, async (req, res, next) => {
    try {
        // Aseguramos que el ID de usuario que hace la devolución quede registrado
        const datosDevolucion = { ...req.body, usuario_id: req.user.id };
        const resultado = await procesarDevolucion(datosDevolucion);
        res.json(resultado);
    } catch (error) { next(error); }
});

// Mover mercancía entre depósitos
router.post('/traslado', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const { id_producto, id_origen, id_destino, cantidad, comentario } = req.body;
        await trasladarMercancia(id_producto, id_origen, id_destino, cantidad, comentario);
        res.json({ success: true, mensaje: "Traslado exitoso" });
    } catch (error) { next(error); }
});

// Realizar un ajuste manual de inventario
router.post('/ajuste', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const resultado = await procesarAjusteInventario(req.body);
        res.json({ success: true, data: resultado });
    } catch (error) { next(error); }
});


// --- 4. REPORTES Y CONSULTAS DE INVENTARIO ---

// Ver el historial de un producto (Kardex)
router.get('/kardex/:id_producto', requiereAuth, async (req, res, next) => {
    try {
        const kardex = await obtenerKardexProducto(req.params.id_producto);
        res.json({ success: true, data: kardex });
    } catch (error) { next(error); }
});

// Ver el stock actual distribuido en los depósitos
router.get('/stock-depositos', requiereAuth, async (req, res, next) => {
    try {
        const stock = await obtenerStockPorDepositos();
        res.json({ success: true, data: stock });
    } catch (error) { next(error); }
});

// Ver productos con stock bajo o crítico
router.get('/stock-critico', requiereAuth, async (req, res, next) => {
    try {
        const reporte = await obtenerStockCritico();
        res.json({ success: true, data: reporte });
    } catch (error) { next(error); }
});

// Ver productos con stock bajo (según stock_minimo)
router.get('/inventario-critico', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const data = await obtenerInventarioCritico();
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

// Reporte para la toma física de inventario
router.get('/reporte-toma-fisica', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const { id_categoria } = req.query;
        const reporte = await obtenerReporteTomaFisica(id_categoria);
        res.json({ success: true, data: reporte });
    } catch (error) { next(error); }
});


// --- 5. REPORTES FINANCIEROS Y DE GESTIÓN ---

// Reporte X: Cierre parcial de caja
router.get('/reporte-x', requiereAuth, esGerente, obtenerReporteX);

// Reporte Z: Cierre definitivo de caja
router.post('/reporte-z', requiereAuth, esGerente, generarCierreZ);

// Historial de cierres Z
router.get('/historial-cierres', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const historial = await obtenerHistorialCierres(); 
        res.json({ success: true, datos: historial });
    } catch (error) { next(error); }
});

// Reporte de ganancias (con filtros por fecha)
router.get('/ganancias', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const data = await obtenerGananciasTienda(fechaInicio, fechaFin);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

// Reporte de ventas por vendedor (para comisiones)
router.get('/ventas-por-vendedor', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const { fechaInicio, fechaFin, porcentajeComision } = req.query;
        const data = await obtenerVentasPorVendedor(fechaInicio, fechaFin, porcentajeComision);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

// Reporte de ventas por método de pago
router.get('/ventas-metodo-pago', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const data = await obtenerVentasPorMetodoPago(fechaInicio, fechaFin);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});


// --- 6. REPORTES PARA DASHBOARD ---

// Productos más vendidos
router.get('/lo-mas-vendido', requiereAuth, async (req, res, next) => {
    try {
        const data = await obtenerLoMasVendido();
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

// Top 10 Productos más vendidos (con filtro de fecha)
router.get('/productos-mas-vendidos', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const data = await obtenerProductosMasVendidos(fechaInicio, fechaFin);
        res.json({ success: true, data });
    } catch (error) { next(error); }
});

// Datos para gráfico de ventas mensuales
router.get('/ventas-mensuales', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const data = await obtenerVentasMensuales();
        res.json({ success: true, data: data });
    } catch (error) { next(error); }
});

// Reporte de valoración total del inventario
router.get('/reporte-valoracion', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const valoracion = await obtenerValoracionInventario();
        const granTotal = valoracion.reduce((acc, cat) => acc + parseFloat(cat.inversion_total_costo || 0), 0);
        res.json({ success: true, gran_total_inventario: granTotal, data: valoracion });
    } catch (error) { next(error); }
});


// --- 7. GESTIÓN DE USUARIOS (Solo Gerentes) ---

// Registrar un nuevo usuario
router.post('/usuario', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const user = await registrarUsuario(req.body);
        res.status(201).json({ success: true, user });
    } catch (error) { next(error); }
});

// Obtener lista de todos los usuarios
router.get('/usuarios', requiereAuth, esGerente, async (req, res, next) => {
    try {
        const lista = await obtenerUsuarios();
        res.json({ success: true, data: lista });
    } catch (error) { next(error); }
});

// Actualizar un usuario
router.put('/usuario/:id', requiereAuth, esGerente, async (req, res, next) => {
    try {
        await actualizarUsuario(req.params.id, req.body);
        res.json({ success: true, message: 'Usuario actualizado' });
    } catch (error) { next(error); }
});

// Eliminar un usuario
router.delete('/usuario/:id', requiereAuth, esGerente, async (req, res, next) => {
    try {
        await eliminarUsuario(req.params.id);
        res.json({ success: true, message: 'Usuario eliminado' });
    } catch (error) { next(error); }
});


module.exports = router;
