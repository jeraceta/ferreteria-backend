const express = require('express');
const cors = require('cors');
const path = require('path');

// Cargar variables de entorno primero para asegurar disponibilidad de claves API y base de datos
require('dotenv').config();

// 1. IMPORTACIÓN DE RUTAS
// Asegúrate de que estos archivos existan en la carpeta ./routers/
const inventarioRoutes = require('./routers/inventario.routes'); 
const clientesRoutes = require('./routers/clientes.routes');
const ventasRoutes = require('./routers/ventas.routes');
const comprasRoutes = require('./routers/compras.routes');

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// 2. MIDDLEWARES GLOBALES
app.use(cors()); // Permite peticiones desde el Frontend (React, Vue, etc.)
app.use(express.json()); // Permite que el servidor entienda JSON en el cuerpo (body) de las peticiones
app.use(express.urlencoded({ extended: true })); // Permite procesar datos de formularios

// 3. RUTAS DE LA API
// Se montan todas las rutas bajo el prefijo /api para mantener el orden
app.use('/api/inventario', inventarioRoutes); 
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/compras', comprasRoutes);

// Ruta de prueba base para verificar que el servidor está encendido
app.get('/', (req, res) => {
  res.status(200).json({
    mensaje: 'Servidor de la Ferretería Activo.',
    version: '1.0.0',
    status: 'OK',
    fecha_servidor: new Date().toLocaleString()
  });
});

// 4. MANEJO DE RUTAS NO ENCONTRADAS (404)
// Si la petición no coincide con ninguna ruta anterior, cae aquí
app.use((req, res, next) => {
  const error = new Error('Ruta no encontrada');
  error.status = 404;
  next(error);
});

// 5. MANEJADOR DE ERRORES GLOBAL (Error Handler)
// Importante: Debe ir después de todas las rutas
const errorHandler = require('./middlewares/error.middleware');
app.use(errorHandler);

// 6. INICIAR EL SERVIDOR
app.listen(port, () => {
  console.log('---------------------------------------------------------');
  console.log(`🚀 SERVIDOR ESCUCHANDO EN: http://localhost:${port}`);
  console.log(`📁 Rutas de Inventario: http://localhost:${port}/api/inventario`);
  console.log('---------------------------------------------------------');
});