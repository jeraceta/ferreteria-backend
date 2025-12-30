const pool = require('./db'); // Asegúrate de que la ruta a tu archivo de conexión sea correcta

async function crearCliente(datos) {
    const { tipo_documento, rif_cedula, razon_social, direccion_fiscal, telefono, email, tipo_contribuyente } = datos;
    const [result] = await pool.execute(
        `INSERT INTO clientes (tipo_documento, rif_cedula, razon_social, direccion_fiscal, telefono, email, tipo_contribuyente) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [tipo_documento, rif_cedula, razon_social, direccion_fiscal, telefono, email, tipo_contribuyente || 'ORDINARIO']
    );
    return { id: result.insertId, ...datos };
}

async function obtenerClientes() {
    const [rows] = await pool.execute("SELECT * FROM clientes ORDER BY razon_social ASC");
    return rows;
}

module.exports = {
    crearCliente,
    obtenerClientes
};