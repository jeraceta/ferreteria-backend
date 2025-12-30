// Script SIMPLE para probar endpoints individuales
// Uso: node test_api_simple.js [comando] [parametros]

const http = require('http');

const BASE_URL = 'localhost:3000';

// Función simple para hacer peticiones
function request(path, method = 'GET', data = null, token = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: { 'Content-Type': 'application/json' }
        };
        
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(body) });
                } catch (e) {
                    resolve({ status: res.statusCode, data: body });
                }
            });
        });
        
        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

// Comandos disponibles
const comandos = {
    async login(username = 'admin', password = 'admin123') {
        console.log(`\n🔐 Login: ${username}...`);
        const res = await request('/api/inventario/login', 'POST', { username, password });
        if (res.status === 200) {
            console.log('✅ Login exitoso!');
            console.log(`Token: ${res.data.token.substring(0, 30)}...`);
            return res.data.token;
        } else {
            console.log('❌ Error:', res.data);
            return null;
        }
    },
    
    async productos() {
        console.log('\n📦 Obteniendo productos...');
        const res = await request('/api/inventario/productos');
        if (res.status === 200) {
            console.log(`✅ ${res.data.length} productos encontrados`);
            res.data.slice(0, 3).forEach(p => {
                console.log(`   - ${p.nombre} (ID: ${p.id}, Stock: ${p.stock})`);
            });
        } else {
            console.log('❌ Error:', res.data);
        }
    },
    
    async kardex(idProducto, token) {
        if (!token) {
            console.log('❌ Necesitas hacer login primero');
            return;
        }
        console.log(`\n📊 Kardex del producto ${idProducto}...`);
        const res = await request(`/api/inventario/kardex/${idProducto}`, 'GET', null, token);
        if (res.status === 200) {
            const k = res.data.data;
            console.log(`✅ Producto: ${k.producto.nombre}`);
            console.log(`   Stock actual: ${k.stock_actual}`);
            console.log(`   Movimientos: ${k.total_movimientos}`);
        } else {
            console.log('❌ Error:', res.data);
        }
    },
    
    async stockCritico(token) {
        if (!token) {
            console.log('❌ Necesitas hacer login primero');
            return;
        }
        console.log('\n⚠️  Stock crítico...');
        const res = await request('/api/inventario/stock-critico', 'GET', null, token);
        if (res.status === 200) {
            console.log(`✅ ${res.data.count} productos con stock crítico`);
            res.data.data.forEach(p => {
                console.log(`   - ${p.nombre}: ${p.stock} unidades`);
            });
        } else {
            console.log('❌ Error:', res.data);
        }
    }
};

// Ejecutar comando
const comando = process.argv[2];
const args = process.argv.slice(3);

if (!comando || comando === 'help') {
    console.log('\n📖 Uso: node test_api_simple.js [comando] [argumentos]\n');
    console.log('Comandos disponibles:');
    console.log('  login [username] [password]  - Hacer login');
    console.log('  productos                      - Listar productos');
    console.log('  kardex [id] [token]           - Ver Kardex (necesita token)');
    console.log('  stockCritico [token]          - Ver stock crítico (necesita token)\n');
    console.log('Ejemplos:');
    console.log('  node test_api_simple.js login admin admin123');
    console.log('  node test_api_simple.js productos');
    console.log('  node test_api_simple.js kardex 1 TOKEN_AQUI\n');
} else if (comandos[comando]) {
    comandos[comando](...args).catch(console.error);
} else {
    console.log(`❌ Comando "${comando}" no encontrado. Usa "help" para ver comandos disponibles.`);
}

