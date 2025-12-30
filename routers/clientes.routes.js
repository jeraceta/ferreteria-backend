const express = require('express');
const router = express.Router();
// Corregido: Sube un nivel (..) y busca directamente el controlador en la raíz
const { crearCliente, obtenerClientes } = require('../clientes.controller');
const { requiereAuth } = require('../middlewares/auth.middleware');

// Ruta para crear cliente (requiere autenticación)
router.post('/', requiereAuth, async (req, res) => {
    try {
        const nuevo = await crearCliente(req.body);
        res.status(201).json(nuevo);
    } catch (e) {
        next(e);
    }
});

// Ruta para ver todos los clientes (requiere autenticación)
router.get('/', requiereAuth, async (req, res) => {
    try {
        const lista = await obtenerClientes();
        res.status(200).json(lista);
    } catch (e) {
        next(e);
    }
});

module.exports = router;