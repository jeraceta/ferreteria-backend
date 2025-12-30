const pool = require('../db');

(async () => {
  try {
    const productoId = 1; // Martillo
    const deposito = 1; // principal
    const cantidad = 10; // unidades a establecer

    const [res] = await pool.execute(
      'UPDATE stock_depositos SET cantidad = ? WHERE id_producto = ? AND id_deposito = ?',
      [cantidad, productoId, deposito]
    );

    if (res.affectedRows === 0) {
      await pool.execute(
        'INSERT INTO stock_depositos (id_producto, id_deposito, cantidad) VALUES (?, ?, ?)',
        [productoId, deposito, cantidad]
      );
      console.log(`Fila insertada: producto ${productoId}, deposito ${deposito}, cantidad ${cantidad}`);
    } else {
      console.log(`Fila actualizada: producto ${productoId}, deposito ${deposito}, cantidad ${cantidad}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error al inyectar stock:', err.message || err);
    process.exit(1);
  }
})();