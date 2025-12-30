// Script para crear un usuario de prueba en la base de datos
// Uso: node crear_usuario.js

const bcrypt = require('bcrypt');
const pool = require('./db');

async function crearUsuario() {
    const connection = await pool.getConnection();
    
    try {
        console.log('🔐 Creando usuario de prueba...\n');
        
        // Datos del usuario (puedes modificar estos valores)
        const username = 'admin';
        const password = 'admin123'; // ⚠️ Cambia esta contraseña
        const nombre = 'Administrador';
        const rol = 'gerente'; // 'gerente' o 'vendedor'
        
        // Verificar si el usuario ya existe
        const [existe] = await connection.execute(
            'SELECT id FROM usuarios WHERE username = ?',
            [username]
        );
        
        if (existe.length > 0) {
            console.log(`⚠️  El usuario "${username}" ya existe.`);
            console.log('   Si quieres crear otro usuario, modifica el script.\n');
            return;
        }
        
        // Encriptar la contraseña
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);
        
        // Insertar el usuario
        const [resultado] = await connection.execute(
            `INSERT INTO usuarios (username, password, nombre, rol) 
             VALUES (?, ?, ?, ?)`,
            [username, hashedPassword, nombre, rol]
        );
        
        console.log('✅ Usuario creado exitosamente!');
        console.log('\n📋 Credenciales:');
        console.log(`   Username: ${username}`);
        console.log(`   Password: ${password}`);
        console.log(`   Nombre: ${nombre}`);
        console.log(`   Rol: ${rol}`);
        console.log(`   ID: ${resultado.insertId}`);
        console.log('\n💡 Guarda estas credenciales para hacer login en la API.\n');
        
    } catch (error) {
        console.error('❌ Error al crear usuario:', error.message);
    } finally {
        connection.release();
        process.exit(0);
    }
}

crearUsuario();

