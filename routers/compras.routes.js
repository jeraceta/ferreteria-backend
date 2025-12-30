const express = require('express');
const router = express.Router();
// Importamos el controlador 
const inventarioController = require('../inventario.controller');
const { esGerente } = require('../middlewares/auth.middleware');
const { body, validationResult } = require('express-validator');

// Las compras solo pueden ser realizadas por gerentes
router.post('/comprar',
    esGerente,
    body('datosCompra').exists().withMessage('datosCompra es requerido'),
    body('detalle').isArray().withMessage('detalle debe ser un arreglo'),
    async (req, res, next) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) return next({ status: 400, message: 'Validación fallida', detail: errors.array() });

        const { datosCompra, detalle } = req.body;
        const resultado = await inventarioController.procesarNuevaCompra(datosCompra, detalle);

        res.status(201).json(resultado);
    } catch (error) {
        console.error("Error en compras:", error.message);
        next(error);
    }
});

module.exports = router;