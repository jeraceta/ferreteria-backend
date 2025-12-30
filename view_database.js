// Script para ver el contenido de la base de datos
const { query } = require('./database');

async function verBaseDatos() {
    try {
        console.log('\n=== VISUALIZACIÓN DE BASE DE DATOS FERRETERIA ===\n');

        // Ver todas las tablas
        console.log('📋 TABLAS DISPONIBLES:');
        const tablas = await query('SHOW TABLES');
        console.log(tablas.map(t => Object.values(t)[0]).join(', '));
        console.log('\n');

        // Ver clientes
        console.log('👥 CLIENTES:');
        const clientes = await query('SELECT * FROM clientes');
        console.table(clientes);
        console.log('\n');

        // Ver productos
        console.log('📦 PRODUCTOS:');
        const productos = await query('SELECT * FROM productos');
        console.table(productos);
        console.log('\n');

        // Ver proveedores
        console.log('🏢 PROVEEDORES:');
        const proveedores = await query('SELECT * FROM proveedores');
        console.table(proveedores);
        console.log('\n');

        // Ver ventas
        console.log('💰 VENTAS:');
        const ventas = await query(`
            SELECT v.*, c.razon_social as cliente_nombre 
            FROM ventas v 
            LEFT JOIN clientes c ON v.id_cliente = c.id 
            ORDER BY v.fecha_venta DESC 
            LIMIT 10
        `);
        console.table(ventas);
        console.log('\n');

        // Ver compras
        console.log('🛒 COMPRAS:');
        const compras = await query(`
            SELECT c.*, p.nombre as proveedor_nombre 
            FROM compras c 
            LEFT JOIN proveedores p ON c.id_proveedor = p.id 
            ORDER BY c.fecha_compra DESC 
            LIMIT 10
        `);
        console.table(compras);
        console.log('\n');

        // Ver movimientos de inventario recientes
        console.log('📊 MOVIMIENTOS DE INVENTARIO (Últimos 10):');
        try {
            const movimientos = await query(`
                SELECT m.*, pr.nombre as producto_nombre 
                FROM movimientos_inventario m 
                LEFT JOIN productos pr ON m.id_producto = pr.id 
                ORDER BY m.fecha_movimiento DESC 
                LIMIT 10
            `);
            console.table(movimientos);
        } catch (err) {
            console.log('No hay movimientos o error:', err.message);
        }
        console.log('\n');

        // Ver usuarios
        console.log('👤 USUARIOS:');
        try {
            const usuarios = await query('SELECT id, username, nombre, rol, created_at FROM usuarios');
            console.table(usuarios);
        } catch (err) {
            console.log('No hay usuarios o error:', err.message);
        }
        console.log('\n');

        // Ver depósitos
        console.log('🏪 DEPÓSITOS:');
        try {
            const depositos = await query('SELECT * FROM depositos');
            console.table(depositos);
        } catch (err) {
            console.log('No hay depósitos o error:', err.message);
        }
        console.log('\n');

        // Estadísticas generales
        console.log('📈 ESTADÍSTICAS:');
        const stats = await query(`
            SELECT 
                (SELECT COUNT(*) FROM clientes) as total_clientes,
                (SELECT COUNT(*) FROM productos) as total_productos,
                (SELECT COUNT(*) FROM ventas) as total_ventas,
                (SELECT COUNT(*) FROM compras) as total_compras,
                (SELECT SUM(stock) FROM productos) as stock_total
        `);
        console.table(stats);
        console.log('\n');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error al consultar la base de datos:', error.message);
        process.exit(1);
    }
}

verBaseDatos();

