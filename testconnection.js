// testconnection.js (Modificado para diagnóstico)

const { pool } = require('./database'); // Asumo que database.js exporta el pool

async function checkDatabaseStatus() {
    let connection;
    try {
        console.log("Intentando obtener una conexión a la base de datos 'ferreteria'...");
        
        // Esto intentará conectarse a la DB especificada en db.js
        connection = await pool.getConnection(); 
        
        // Si la conexión es exitosa, verificamos qué tablas existen
        const [rows] = await connection.execute('SHOW TABLES'); 
        
        console.log("✅ CONEXIÓN EXITOSA con la base de datos 'ferreteria'!");
        console.log("\n--- Tablas encontradas en la base de datos ---");
        
        if (rows.length === 0) {
            console.log("⚠️ La base de datos existe, pero está VACÍA. Debemos crear las tablas.");
        } else {
            console.log(`Tablas encontradas: ${rows.length}`);
            // Muestra los nombres de las tablas para confirmación
            rows.forEach(row => console.log(`- ${Object.values(row)[0]}`));
        }

    } catch (error) {
        console.error("\n-----------------------------------------");
        console.error("❌ ERROR CRÍTICO DE CONEXIÓN O BASE DE DATOS:");
        
        if (error.code === 'ER_BAD_DB_ERROR') {
            // Este error ocurre si la base de datos 'ferreteria' no existe
            console.error(`¡La base de datos 'ferreteria' NO EXISTE! Debemos crearla.`);
           } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
               // Este error ocurre si la contraseña o usuario son incorrectos
               console.error(`Acceso denegado. Revise las credenciales de conexión (archivo .env o db.js).`);
        } else {
            console.error(`Error inesperado: ${error.message}`);
        }
    } finally {
        // Aseguramos que la conexión se libere
        if (connection) {
            connection.release();
        }
    }
}

checkDatabaseStatus();