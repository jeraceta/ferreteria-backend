// Script para probar los endpoints de la API
// Uso: node test_api.js

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let authToken = null;

// Función auxiliar para hacer peticiones HTTP
function hacerPeticion(opciones, datos = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(opciones, (res) => {
            let data = '';
            
            res.on('data', (chunk) => {
                data += chunk;
            });
            
            res.on('end', () => {
                try {
                    const jsonData = JSON.parse(data);
                    resolve({ status: res.statusCode, data: jsonData });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        
        req.on('error', (error) => {
            reject(error);
        });
        
        if (datos) {
            req.write(JSON.stringify(datos));
        }
        
        req.end();
    });
}

// Función para hacer login
async function login(username, password) {
    console.log('\n🔐 Intentando hacer login...');
    
    const opciones = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/inventario/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    try {
        const resultado = await hacerPeticion(opciones, { username, password });
        
        if (resultado.status === 200 && resultado.data.token) {
            authToken = resultado.data.token;
            console.log('✅ Login exitoso!');
            console.log(`   Usuario: ${resultado.data.user.nombre}`);
            console.log(`   Rol: ${resultado.data.user.rol}`);
            console.log(`   Token: ${authToken.substring(0, 20)}...`);
            return true;
        } else {
            console.log('❌ Error en login:', resultado.data);
            return false;
        }
    } catch (error) {
        console.log('❌ Error de conexión:', error.message);
        console.log('   ¿Está el servidor corriendo? Ejecuta: npm start');
        return false;
    }
}

// Función para obtener productos
async function obtenerProductos() {
    console.log('\n📦 Obteniendo lista de productos...');
    
    const opciones = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/inventario/productos',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    };
    
    try {
        const resultado = await hacerPeticion(opciones);
        
        if (resultado.status === 200) {
            console.log(`✅ Productos obtenidos: ${resultado.data.length} productos`);
            if (resultado.data.length > 0) {
                console.log('\n   Primeros productos:');
                resultado.data.slice(0, 3).forEach((p, i) => {
                    console.log(`   ${i + 1}. ${p.nombre} (ID: ${p.id}) - Stock: ${p.stock}`);
                });
            }
            return resultado.data;
        } else {
            console.log('❌ Error:', resultado.data);
            return null;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return null;
    }
}

// Función para obtener Kardex de un producto
async function obtenerKardex(idProducto) {
    console.log(`\n📊 Obteniendo Kardex del producto ID ${idProducto}...`);
    
    if (!authToken) {
        console.log('❌ Necesitas hacer login primero');
        return;
    }
    
    const opciones = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/inventario/kardex/${idProducto}`,
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    try {
        const resultado = await hacerPeticion(opciones);
        
        if (resultado.status === 200) {
            console.log('✅ Kardex obtenido exitosamente!');
            console.log(`\n   Producto: ${resultado.data.data.producto.nombre}`);
            console.log(`   Código: ${resultado.data.data.producto.codigo}`);
            console.log(`   Stock actual: ${resultado.data.data.stock_actual}`);
            console.log(`   Total movimientos: ${resultado.data.data.total_movimientos}`);
            
            if (resultado.data.data.movimientos.length > 0) {
                console.log('\n   Últimos movimientos:');
                resultado.data.data.movimientos.slice(0, 5).forEach((mov, i) => {
                    const fecha = new Date(mov.fecha_movimiento).toLocaleString();
                    const tipo = mov.tipo_operacion === 'ENTRADA' ? '➕' : '➖';
                    console.log(`   ${i + 1}. ${tipo} ${mov.tipo_movimiento} - ${mov.cantidad} unidades`);
                    console.log(`      Fecha: ${fecha}`);
                    console.log(`      ${mov.descripcion || mov.comentario}`);
                });
            }
            return resultado.data;
        } else {
            console.log('❌ Error:', resultado.data);
            return null;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return null;
    }
}

// Función para obtener stock crítico
async function obtenerStockCritico() {
    console.log('\n⚠️  Obteniendo productos con stock crítico...');
    
    if (!authToken) {
        console.log('❌ Necesitas hacer login primero');
        return;
    }
    
    const opciones = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/inventario/stock-critico',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    try {
        const resultado = await hacerPeticion(opciones);
        
        if (resultado.status === 200) {
            console.log(`✅ Stock crítico: ${resultado.data.count} productos`);
            if (resultado.data.data.length > 0) {
                resultado.data.data.forEach((p, i) => {
                    console.log(`   ${i + 1}. ${p.nombre} - Stock: ${p.stock}`);
                });
            } else {
                console.log('   ✅ No hay productos con stock crítico');
            }
            return resultado.data;
        } else {
            console.log('❌ Error:', resultado.data);
            return null;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return null;
    }
}

// Función para obtener clientes
async function obtenerClientes() {
    console.log('\n👥 Obteniendo lista de clientes...');
    
    if (!authToken) {
        console.log('❌ Necesitas hacer login primero');
        return;
    }
    
    const opciones = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/clientes',
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`
        }
    };
    
    try {
        const resultado = await hacerPeticion(opciones);
        
        if (resultado.status === 200) {
            console.log(`✅ Clientes obtenidos: ${resultado.data.length} clientes`);
            if (resultado.data.length > 0) {
                resultado.data.slice(0, 3).forEach((c, i) => {
                    console.log(`   ${i + 1}. ${c.razon_social || c.nombre} (ID: ${c.id})`);
                });
            }
            return resultado.data;
        } else {
            console.log('❌ Error:', resultado.data);
            return null;
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
        return null;
    }
}

// Función principal para ejecutar todas las pruebas
async function ejecutarPruebas() {
    console.log('═══════════════════════════════════════════════════');
    console.log('🧪 PRUEBAS DE LA API - SISTEMA DE FERRETERÍA');
    console.log('═══════════════════════════════════════════════════');
    
    // 1. Login
    const loginExitoso = await login('admin', 'tu_contraseña'); // ⚠️ Cambia estos valores
    
    if (!loginExitoso) {
        console.log('\n⚠️  No se pudo hacer login. Verifica:');
        console.log('   1. Que el servidor esté corriendo (npm start)');
        console.log('   2. Que tengas un usuario creado en la base de datos');
        console.log('   3. Que el username y password sean correctos');
        console.log('\n💡 Puedes crear un usuario ejecutando: node crear_usuario.js');
        return;
    }
    
    // 2. Obtener productos (no requiere auth)
    await obtenerProductos();
    
    // 3. Obtener stock crítico
    await obtenerStockCritico();
    
    // 4. Obtener clientes
    await obtenerClientes();
    
    // 5. Obtener Kardex del primer producto (si existe)
    const productos = await obtenerProductos();
    if (productos && productos.length > 0) {
        await obtenerKardex(productos[0].id);
    }
    
    console.log('\n═══════════════════════════════════════════════════');
    console.log('✅ Pruebas completadas!');
    console.log('═══════════════════════════════════════════════════\n');
}

// Ejecutar pruebas
ejecutarPruebas().catch(console.error);

