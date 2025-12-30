# Ferreteria - Backend

Pequeña guía para desarrollo local.

Requisitos
- Node.js (v16+ recommended)

Instalación
```bash
npm install
```

Variables de entorno
- Copia el ejemplo y completa valores reales (NO commitear `.env`):

Linux / macOS:
```bash
cp .env.example .env
```

Windows PowerShell:
```powershell
Copy-Item .env.example .env
```

Rellena en `.env` `DB_PASSWORD` y `JWT_SECRET` (usar un secreto fuerte).

Scripts útiles
- Desarrollo (auto-reload):
```bash
npm run dev
```
- Producción / iniciar:
```bash
npm start
```

Pruebas manuales
- Hay scripts ad-hoc: `test_api_simple.js`, `test_transacciones.js` — ejecutarlos con:
```bash
node test_api_simple.js
```

Notas de seguridad
- No guardar `.env` en el repositorio.
- Asegurar `JWT_SECRET` y credenciales de BD en el entorno de producción.
