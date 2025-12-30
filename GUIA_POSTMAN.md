# 📮 Guía para Usar Postman con la API

## 🚀 **PASOS RÁPIDOS**

### **1. Instalar Postman**
- Descarga desde: https://www.postman.com/downloads/
- Es completamente gratuito
- Instálalo y ábrelo

### **2. Importar la Colección**
1. En Postman, haz clic en **"Import"** (arriba a la izquierda)
2. Selecciona el archivo: `Ferreteria_API.postman_collection.json`
3. Haz clic en **"Import"**

¡Listo! Ya tienes todos los endpoints organizados.

### **3. Configurar Variables de Entorno**
1. Haz clic en el icono de **"Environments"** (ojo) en la esquina superior derecha
2. Haz clic en **"+"** para crear un nuevo environment
3. Nómbralo: `Ferretería Local`
4. Agrega estas variables:
   - `base_url` = `http://localhost:3000`
   - `auth_token` = (déjalo vacío por ahora)
5. Guarda y selecciona este environment

### **4. Crear un Usuario (si no tienes uno)**
Antes de probar, necesitas un usuario. Ejecuta:
```bash
cd Backend
node crear_usuario.js
```

Esto creará:
- Username: `admin`
- Password: `admin123`

### **5. Hacer Login**
1. En Postman, ve a la carpeta **"🔐 Autenticación"**
2. Selecciona **"Login"**
3. Verifica que el body tenga:
   ```json
   {
       "username": "admin",
       "password": "admin123"
   }
   ```
4. Haz clic en **"Send"**
5. ✅ Si todo está bien, verás el token en la respuesta
6. **IMPORTANTE:** El token se guarda automáticamente en la variable `auth_token`

### **6. Probar Endpoints**
Ahora puedes probar cualquier endpoint. El token se usará automáticamente en los que requieren autenticación.

---

## 📋 **ENDPOINTS DISPONIBLES EN LA COLECCIÓN**

### **🔐 Autenticación**
- ✅ **Login** - Iniciar sesión (guarda el token automáticamente)

### **📦 Productos**
- ✅ **Listar Productos** - Ver todos los productos (público)
- ✅ **Crear Producto** - Agregar nuevo producto
- ✅ **Ver Kardex** - Historial de movimientos de un producto

### **👥 Clientes**
- ✅ **Listar Clientes** - Ver todos los clientes
- ✅ **Crear Cliente** - Agregar nuevo cliente

### **💰 Ventas**
- ✅ **Procesar Venta** - Facturar una venta

### **🛒 Compras**
- ✅ **Registrar Compra** - Registrar compra a proveedor (solo gerentes)

### **📊 Reportes**
- ✅ **Stock Crítico** - Productos con stock bajo
- ✅ **Reporte de Ganancias** - Ganancias del día (solo gerentes)
- ✅ **Top Productos Vendidos** - Top 5 productos (solo gerentes)

---

## 🎯 **CÓMO PROBAR LAS NUEVAS FUNCIONALIDADES**

### **1. Probar el Kardex (Historial de Movimientos)**
1. Ve a **"📦 Productos"** → **"Ver Kardex (Historial)"**
2. Cambia el parámetro `:id_producto` a un ID de producto que exista (ej: `1`)
3. Haz clic en **"Send"**
4. Verás el historial completo con:
   - Información del producto
   - Stock actual
   - Todos los movimientos (compras, ventas, ajustes)
   - Stock antes y después de cada movimiento

### **2. Probar Actualización Automática de Costo**
1. Ve a **"🛒 Compras"** → **"Registrar Compra"**
2. Modifica el `costo_unitario` en el detalle (ej: cambia de `20.00` a `25.00`)
3. Haz clic en **"Send"**
4. Luego verifica el producto:
   - Ve a **"📦 Productos"** → **"Listar Productos"**
   - Busca el producto que compraste
   - El `precio_costo` debería haberse actualizado automáticamente

### **3. Probar Validación de Stock**
1. Ve a **"💰 Ventas"** → **"Procesar Venta (Facturar)"**
2. **Prueba A - Sin stock negativo (debe fallar):**
   - Cambia `"permitirStockNegativo": false` (o elimina esa línea)
   - Aumenta la cantidad a un número mayor que el stock disponible
   - Haz clic en **"Send"**
   - ✅ Deberías ver un error: "Stock insuficiente para..."

3. **Prueba B - Con stock negativo (debe funcionar):**
   - Cambia `"permitirStockNegativo": true`
   - Mantén la cantidad mayor que el stock
   - Haz clic en **"Send"**
   - ✅ Debería procesar la venta aunque el stock quede negativo

---

## 💡 **CONSEJOS ÚTILES**

### **Ver el Token Guardado**
1. Haz clic en el icono de **"Environments"** (ojo)
2. Selecciona tu environment
3. Verás la variable `auth_token` con el valor actual

### **Cambiar el Token Manualmente**
Si el token expira (después de 12 horas):
1. Ve a **"🔐 Autenticación"** → **"Login"**
2. Haz clic en **"Send"**
3. El nuevo token se guardará automáticamente

### **Modificar Datos de Prueba**
Todos los endpoints tienen datos de ejemplo. Puedes modificarlos:
1. Selecciona el endpoint
2. Ve a la pestaña **"Body"**
3. Modifica los valores según necesites
4. Haz clic en **"Send"**

### **Ver Respuestas Formateadas**
Postman formatea automáticamente las respuestas JSON. Si no se ve bien:
1. Haz clic en **"Pretty"** arriba de la respuesta
2. O selecciona **"JSON"** en el menú desplegable

---

## ⚠️ **SOLUCIÓN DE PROBLEMAS**

### **Error: "Cannot connect"**
- Verifica que el servidor esté corriendo: `npm start` en la carpeta Backend
- Verifica que la URL sea: `http://localhost:3000`

### **Error: "401 Unauthorized" o "Token inválido"**
- Haz login nuevamente para obtener un token fresco
- Verifica que el environment esté seleccionado

### **Error: "403 Forbidden"**
- El endpoint requiere rol de GERENTE
- Asegúrate de hacer login con un usuario gerente

### **Error: "Usuario no existe"**
- Ejecuta: `node crear_usuario.js` para crear un usuario

---

## 🎓 **PRÓXIMOS PASOS**

Una vez que pruebes todo en Postman:
1. ✅ Verás cómo funcionan los endpoints
2. ✅ Entenderás la estructura de las respuestas
3. ✅ Podrás usar esta información para crear el Frontend

¿Necesitas ayuda con algo específico de Postman o quieres probar algún endpoint en particular?

