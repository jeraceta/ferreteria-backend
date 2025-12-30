const express = require('express');
const cors = require('cors');

// Cargar variables de entorno primero
require('dotenv').config();

// 1. IMPORTACIÓN DE RUTAS
const inventarioRoutes = require('./routers/inventario.routes'); 
const clientesRoutes = require('./routers/clientes.routes');
const ventasRoutes = require('./routers/ventas.routes');
const comprasRoutes = require('./routers/compras.routes');
const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

// 2. MIDDLEWARES
app.use(cors()); 
app.use(express.json()); 

// 3. RUTAS DE LA API
app.use('/api/inventario', inventarioRoutes); 
app.use('/api/clientes', clientesRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/compras', comprasRoutes);

// Global error handler (must be registered after routes)
const errorHandler = require('./middlewares/error.middleware');
app.use(errorHandler);

// Ruta de prueba base
app.get('/', (req, res) => {
  res.send('Servidor de la Ferretería Activo. ¡Conexión OK!');
});

// 4. INICIAR EL SERVIDOR
app.listen(port, () => {
  console.log(`🚀 Servidor Express.js escuchando en el puerto ${port}`);
  console.log(`Accede en: http://localhost:${port}`);
});