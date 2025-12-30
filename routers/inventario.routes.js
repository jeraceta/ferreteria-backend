const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { requiereAuth, esGerente } = require('../middlewares/auth.middleware');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const { 
    procesarNuevaCompra, 
    procesarNuevaVenta, 
    obtenerProductoPorId,
    obtenerTodosLosProductos,
    crearProducto,
    procesarDevolucion,
    obtenerStockPorDepositos,
    actualizarProducto,
    procesarAjusteInventario, 
    trasladarMercancia,
    obtenerValoracionInventario,
    obtenerStockCritico,
    obtenerGananciasHoy,
    obtenerVentasPorVendedor,
    registrarUsuario,
    obtenerUsuarios,
    actualizarUsuario,
    eliminarUsuario, 
    obtenerLoMasVendido,
    loginUsuario,
    obtenerKardexProducto
} = require('../inventario.controller');

// --- 1. REPORTES Y CONSULTAS ---

router.get('/stock-critico', requiereAuth, async (req, res) => {
    try {
        const reporte = await obtenerStockCritico();
        res.json({ success: true, count: reporte.length, data: reporte });
    } catch (error) {
        next(error);
    }
});

router.get('/reporte-ganancias', esGerente, async (req, res) => {
    try {
        const ganancias = await obtenerGananciasHoy();
        res.json({ success: true, fecha_reporte: new Date().toISOString().split('T')[0], data: ganancias });
    } catch (error) {
        next(error);
    }
});

router.get('/reporte-comisiones', esGerente, async (req, res) => {
    try {
        const { inicio, fin, porcentaje } = req.query;
        if (!inicio || !fin || !porcentaje) {
            return res.status(400).json({ error: "Faltan parámetros: inicio, fin y porcentaje son obligatorios." });
        }
        const ventasVendedores = await obtenerVentasPorVendedor(inicio, fin);
        const reporteFinal = ventasVendedores.map(v => ({
            ...v,
            porcentaje_aplicado: `${porcentaje}%`,
            comision_ganada: (v.total_ventas_brutas * (porcentaje / 100)).toFixed(2)
        }));
        res.json({ success: true, periodo: { desde: inicio, hasta: fin }, data: reporteFinal });
    } catch (error) {
        next(error);
    }
});

// --- 2. OPERACIONES DE PRODUCTOS ---
router.get('/productos', async (req, res) => {
    try {
        const productos = await obtenerTodosLosProductos();
        res.status(200).json(productos);
    } catch (error) {
        next(error);
    }
});

// Obtener Kardex (historial de movimientos) de un producto específico
router.get('/kardex/:id_producto', requiereAuth, async (req, res) => {
    try {
        const idProducto = parseInt(req.params.id_producto);
        if (isNaN(idProducto)) {
            return res.status(400).json({ error: 'ID de producto inválido' });
        }
        const kardex = await obtenerKardexProducto(idProducto);
        res.json({ success: true, data: kardex });
    } catch (error) {
        next(error);
    }
});

router.post('/producto', requiereAuth, async (req, res) => {
    try {
        const nuevoProducto = await crearProducto(req.body);
        res.status(201).json({ mensaje: 'Producto creado con éxito', producto: nuevoProducto });
    } catch (error) {
        next(error);
    }
});

// --- 3. MOVIMIENTOS ---
// Las compras solo pueden ser realizadas por gerentes
router.post('/compra', esGerente, async (req, res) => {
    // Note: kept as-is for backward compatibility; prefer /api/compras route for validated flow
    try {
        const { datosCompra, detalle } = req.body; 
        const resultado = await procesarNuevaCompra(datosCompra, detalle);
        res.status(201).json({ mensaje: 'Compra procesada', compraId: resultado.id_compra });
    } catch (error) {
        next(error);
    }
});

// Las ventas pueden ser realizadas por cualquier usuario autenticado
router.post('/venta',
    requiereAuth,
    body('datosVenta').exists().withMessage('datosVenta es requerido'),
    body('detalle').isArray().withMessage('detalle debe ser un arreglo'),
    async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next({ status: 400, message: 'Validación fallida', detail: errors.array() });

        const { datosVenta, detalle } = req.body;
        const resultado = await procesarNuevaVenta(datosVenta, detalle);
        res.json({ success: true, ventaId: resultado.id_venta });
    } catch (error) {
        next(error);
    }
});

// AJUSTE DE INVENTARIO (conteo físico) - Solo Gerentes
router.post('/ajuste',
    esGerente,
    body('detalles').isArray().withMessage('detalles debe ser un arreglo'),
    async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next({ status: 400, message: 'Validación fallida', detail: errors.array() });

        const resultado = await procesarAjusteInventario(req.body);
        res.status(200).json({ success: true, detallesProcesados: resultado.detallesProcesados });
    } catch (error) {
        next(error);
    }
});
// REGISTRAR NUEVO USUARIO (Solo Gerencia)
router.post('/usuarios',
    esGerente,
    body('username').isString().notEmpty(),
    body('password').isString().isLength({ min: 6 }).withMessage('password mínimo 6 caracteres'),
    body('nombre').isString().notEmpty(),
    async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next({ status: 400, message: 'Validación fallida', detail: errors.array() });

        const nuevoUsuario = await registrarUsuario(req.body);
        res.status(201).json({ 
            success: true, 
            mensaje: "Usuario creado exitosamente", 
            data: nuevoUsuario 
        });
    } catch (error) {
        // Manejo por si el nombre de usuario ya existe (columna UNIQUE)
        if (error.code === 'ER_DUP_ENTRY') {
            return next({ status: 400, message: "El nombre de usuario ya existe" });
        }
        next(error);
    }
});

// 1. VER LISTADO DE VENDEDORES
router.get('/usuarios', esGerente, async (req, res) => {
    try {
        const lista = await obtenerUsuarios();
        res.json({ success: true, data: lista });
    } catch (error) {
        next(error);
    }
});

// 2. MODIFICAR USUARIO 
router.put('/usuarios/:id', esGerente, async (req, res) => {
    try {
        const editado = await actualizarUsuario(req.params.id, req.body);
        if (editado) {
            res.json({ success: true, mensaje: "Usuario actualizado correctamente" });
        } else {
            res.status(404).json({ error: "Usuario no encontrado" });
        }
    } catch (error) {
        next(error);
    }
});

// 3. ELIMINAR USUARIO
router.delete('/usuarios/:id', esGerente, async (req, res) => {
    try {
        const eliminado = await eliminarUsuario(req.params.id);
        if (eliminado) {
            res.json({ success: true, mensaje: "Usuario eliminado" });
        } else {
            res.status(404).json({ error: "Usuario no encontrado" });
        }
    } catch (error) {
        next(error);
    }
});
// REPORTE: TOP 5 PRODUCTOS MÁS VENDIDOS
router.get('/reporte-top-productos', esGerente, async (req, res, next) => {
    try {
        const top = await obtenerLoMasVendido();
        res.json({ 
            success: true, 
            mensaje: "Top 5 productos más vendidos",
            data: top 
        });
    } catch (error) {
        next(error);
    }
});
// ENDPOINT DE LOGIN
router.post('/login',
    body('username').isString().notEmpty(),
    body('password').isString().notEmpty(),
    async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return res.status(400).json({ success: false, error: 'Validación fallida', detalle: errors.array() });

        const { username, password } = req.body;
        const usuario = await loginUsuario(username, password);

        // 🔑 CREAR EL TOKEN (El "Gafete")
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            return res.status(500).json({ success: false, error: 'JWT secret not configured on server' });
        }

        const token = jwt.sign(
            { id: usuario.id, rol: usuario.rol },
            jwtSecret,
            { expiresIn: '12h' }
        );

        res.json({
            success: true,
            mensaje: `¡Bienvenido(a) ${usuario.nombre}!`,
            token: token,
            user: usuario
        });
    } catch (error) {
        res.status(401).json({ success: false, error: error.message });
    }
});
module.exports = router;