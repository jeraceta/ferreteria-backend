// database.js
const pool = require('./db'); // Importa el pool de db.js

// Función de consulta simple (para SELECT sin transacciones)
const query = async (sql, values = []) => {
    try {
        // Ejecución segura de consultas. Devuelve solo las filas.
        const [rows] = await pool.execute(sql, values); 
        return rows;
    } catch (error) {
        throw error;
    }
};

// Exportamos la función de consulta simple y el pool para las transacciones
module.exports = { 
    query,
    pool // Este pool se usa para obtener una conexión específica para transacciones.
};