const express = require('express');
const router = express.Router();
const inventarioController = require('../inventario.controller');
const { procesarVenta } = require('../ventas.controller');
const { requiereAuth } = require('../middlewares/auth.middleware');
const { body, validationResult } = require('express-validator');

// Procesar venta requiere autenticación (cualquier usuario autenticado puede vender)
router.post('/facturar',
    requiereAuth,
    body('datosVenta').exists().withMessage('datosVenta es requerido'),
    body('detalle').isArray().withMessage('detalle debe ser un arreglo'),
    async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next({ status: 400, message: 'Validación fallida', detail: errors.array() });

        const { datosVenta, detalle } = req.body; 
        const resultado = await inventarioController.procesarNuevaVenta(datosVenta, detalle);

        res.status(201).json(resultado);
    } catch (error) {
        console.error("Error en ruta facturar:", error.message);
        next(error);
    }
});
module.exports = router;