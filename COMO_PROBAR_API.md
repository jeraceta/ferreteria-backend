# 🧪 Cómo Probar la API sin Thunder Client

Como Thunder Client no está disponible en la versión gratuita de Cursor, aquí tienes varias alternativas:

---

## 📋 **OPCIÓN 1: Scripts de Node.js (RECOMENDADO - Más Fácil)**

He creado scripts que puedes ejecutar directamente desde la terminal.

### **Paso 1: Crear un usuario de prueba**

```bash
cd Backend
node crear_usuario.js
```

Esto creará un usuario con:
- Username: `admin`
- Password: `admin123`
- Rol: `gerente`

⚠️ **Importante:** Modifica el script si quieres cambiar estos valores.

### **Paso 2: Probar los endpoints**

**Opción A: Script completo (prueba todo)**
```bash
node test_api.js
```

**Opción B: Script simple (pruebas individuales)**
```bash
# Ver ayuda
node test_api_simple.js help

# Hacer login
node test_api_simple.js login admin admin123

# Listar productos (no requiere login)
node test_api_simple.js productos

# Ver Kardex (necesita token del login)
node test_api_simple.js kardex 1 TOKEN_AQUI
```

---

## 📋 **OPCIÓN 2: Usar curl (Línea de comandos)**

Si tienes curl instalado (viene en Windows 10+):

### **1. Hacer Login:**
```bash
curl -X POST http://localhost:3000/api/inventario/login ^
  -H "Content-Type: application/json" ^
  -d "{\"username\":\"admin\",\"password\":\"admin123\"}"
```

Guarda el `token` de la respuesta.

### **2. Probar endpoints protegidos:**
```bash
# Reemplaza TU_TOKEN con el token que obtuviste
curl http://localhost:3000/api/inventario/stock-critico ^
  -H "Authorization: Bearer TU_TOKEN"
```

### **3. Ver Kardex:**
```bash
curl http://localhost:3000/api/inventario/kardex/1 ^
  -H "Authorization: Bearer TU_TOKEN"
```

---

## 📋 **OPCIÓN 3: Postman (Aplicación Externa)**

1. **Descargar Postman:**
   - Ve a: https://www.postman.com/downloads/
   - Es gratuito y muy popular

2. **Configurar peticiones:**
   - Crea una nueva petición
   - URL: `http://localhost:3000/api/inventario/login`
   - Método: `POST`
   - Body (raw JSON):
     ```json
     {
       "username": "admin",
       "password": "admin123"
     }
     ```

3. **Usar el token:**
   - Copia el token de la respuesta
   - En otras peticiones, agrega header:
     - Key: `Authorization`
     - Value: `Bearer TU_TOKEN_AQUI`

---

## 📋 **OPCIÓN 4: Insomnia (Alternativa a Postman)**

1. **Descargar Insomnia:**
   - https://insomnia.rest/download
   - También es gratuito

2. **Usar igual que Postman**

---

## 📋 **OPCIÓN 5: Crear una página HTML simple**

Puedo crear un archivo HTML con JavaScript que puedas abrir en tu navegador para probar la API. ¿Quieres que lo cree?

---

## 🚀 **QUICK START (Lo más rápido)**

1. **Asegúrate de que el servidor esté corriendo:**
   ```bash
   cd Backend
   npm start
   ```

2. **En otra terminal, crea un usuario:**
   ```bash
   cd Backend
   node crear_usuario.js
   ```

3. **Prueba todo:**
   ```bash
   node test_api.js
   ```

---

## ⚠️ **SOLUCIÓN DE PROBLEMAS**

### **Error: "Cannot connect"**
- Verifica que el servidor esté corriendo en el puerto 3000
- Ejecuta: `npm start` en la carpeta Backend

### **Error: "Usuario no existe"**
- Ejecuta: `node crear_usuario.js` para crear un usuario

### **Error: "Token inválido"**
- Haz login nuevamente para obtener un token fresco
- Los tokens expiran después de 12 horas

---

## 💡 **RECOMENDACIÓN**

Para empezar rápido, usa los **scripts de Node.js** (Opción 1). Son los más fáciles y no requieren instalar nada adicional.

¿Quieres que cree alguna otra herramienta de prueba o necesitas ayuda con algo específico?

