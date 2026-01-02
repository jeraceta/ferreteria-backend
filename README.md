
# 🛠️ Ferretería API - Backend Gestión de Inventario

Guía técnica para la configuración, desarrollo y despliegue local del servidor.

## 📋 Requisitos
- **Node.js**: v16 o superior (recomendado).
- **MySQL**: v8.0 o superior.

## ⚙️ Instalación y Configuración

1. **Instalar dependencias:**
   ```bash
   npm install
   Configurar variables de entorno: Crea el archivo .env basándote en el ejemplo. IMPORTANTE: No compartas ni subas este archivo al repositorio.
Copy-Item .env.example .env

Completar datos en .env: Asegúrate de configurar DB_PASSWORD y un JWT_SECRET robusto para la seguridad de los tokens.
Comando,Descripción
npm run dev,Inicia el servidor con Nodemon (auto-reload al guardar cambios).
npm start,Inicia el servidor en modo producción.
🧪 Pruebas y Diagnóstico
Si has realizado cambios en la base de datos o en la lógica de transacciones (como el Kardex), puedes ejecutar los scripts de prueba manuales incluidos:
# Prueba básica de conexión y endpoints
node test_api_simple.js

# Prueba de integridad en ventas y stock
node test_transacciones.js

🛣️ Estructura de la API (Endpoints principales)
Auth: POST /api/inventario/login

Productos: GET/POST/PUT/DELETE /api/inventario/producto

Kardex: GET /api/inventario/kardex/:id

Reportes Gerenciales:

/api/inventario/reporte-valoracion

/api/inventario/reporte-ganancias

🛡️ Notas de Seguridad
El archivo .env está excluido por .gitignore para proteger credenciales.

Las rutas sensibles requieren el middleware esGerente (validación de rol en JWT).

Todas las operaciones críticas de stock utilizan Transacciones SQL para evitar inconsistencias.

Mantenimiento y desarrollo v1.0 - 2025

