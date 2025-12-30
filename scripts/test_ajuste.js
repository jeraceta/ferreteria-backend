const { procesarAjusteInventario } = require('../inventario.controller');

(async () => {
  try {
    console.log('Iniciando prueba de ajuste...');

    const resultado = await procesarAjusteInventario({
      usuarioId: 1,
      motivo: 'Prueba automatizada desde script',
      permitirStockNegativo: false,
      detalles: [
        { productoId: 1, id_deposito: 1, cantidad: -1, tipo: 'SALIDA' },
        { productoId: 2, id_deposito: 1, cantidad: 3, tipo: 'ENTRADA' }
      ]
    });

    console.log('Resultado:', resultado);
    process.exit(0);
  } catch (err) {
    console.error('Error durante la prueba de ajuste:');
    if (err && err.message) console.error(err.message);
    else console.error(err);
    process.exit(1);
  }
})();