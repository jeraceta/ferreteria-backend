/**
 * concurrency_test.js
 *
 * Usa el endpoint /api/inventario/login para obtener un token y luego
 * lanza varias peticiones POST concurrentes a /api/inventario/venta
 * para probar la protección contra condiciones de carrera (oversell).
 *
 * Configuración por variables de entorno (o editar directamente abajo):
 *  - SERVER_URL (default: http://localhost:3000)
 *  - TEST_USER
 *  - TEST_PASS
 *  - PRODUCT_ID
 *  - CONCURRENCY (número de peticiones concurrentes)
 *  - QUANTITY (cantidad por cada petición)
 *
 * Ejecutar:
 * node scripts/concurrency_test.js
 */

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const TEST_USER = process.env.TEST_USER || '';
const TEST_PASS = process.env.TEST_PASS || '';
const PRODUCT_ID = process.env.PRODUCT_ID || process.argv[2];
const CONCURRENCY = Number(process.env.CONCURRENCY) || Number(process.argv[3]) || 10;
const QUANTITY = Number(process.env.QUANTITY) || Number(process.argv[4]) || 1;

// If no token is provided via env, require TEST_USER/TEST_PASS to perform login
const HAS_TOKEN = Boolean(process.env.TEST_TOKEN || process.env.TOKEN);
if (!HAS_TOKEN && (!TEST_USER || !TEST_PASS)) {
  console.error('Define TEST_USER and TEST_PASS en variables de entorno antes de ejecutar, o establece TEST_TOKEN/TOKEN.');
  console.error('Ejemplo (PowerShell): $env:TEST_USER="demo"; $env:TEST_PASS="secret"; node scripts/concurrency_test.js 5 10 1');
  console.error('O usando token: $env:TEST_TOKEN="<token>"; node scripts/concurrency_test.js 5 10 1');
  process.exit(1);
}

if (!PRODUCT_ID) {
  console.error('Pasa PRODUCT_ID como primer argumento o define env PRODUCT_ID.');
  console.error('Ejemplo: node scripts/concurrency_test.js 5 10 1  # where 5 is product id');
  process.exit(1);
}

const fs = require('fs');
const fetchJson = (url, opts) => fetch(url, opts).then(async r => {
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
});

async function main() {
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Product: ${PRODUCT_ID}  Concurrency: ${CONCURRENCY}  Quantity: ${QUANTITY}`);

  // 1) Login (unless a token is provided via env)
  let token = process.env.TEST_TOKEN || process.env.TOKEN;
  if (!token) {
    const loginRes = await fetchJson(`${SERVER_URL}/api/inventario/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: TEST_USER, password: TEST_PASS })
    });

    if (loginRes.status !== 200) {
      console.error('Login failed:', loginRes);
      process.exit(1);
    }

    token = loginRes.body.token;
    console.log('Login OK. Token obtained.');
  } else {
    console.log('Using provided token from env.');
  }

  // 2) Prepare concurrent requests
  const payload = {
    datosVenta: { usuarioId: 1, clienteId: 1, subtotal: 0, impuesto: 0, total: 0 },
    detalle: [ { productoId: Number(PRODUCT_ID), cantidad: QUANTITY, precioUnitario: 1 } ]
  };

  // Fire concurrent requests
  const promises = Array.from({ length: CONCURRENCY }).map((_, i) =>
    fetchJson(`${SERVER_URL}/api/inventario/venta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(payload)
    }).then(res => ({ index: i + 1, res }))
  );

  console.log('Sending concurrent requests...');
  const results = await Promise.all(promises);

  // 3) Output results and build report
  results.forEach(r => {
    console.log(`Request #${r.index} -> status=${r.res.status} body=${JSON.stringify(r.res.body)}`);
  });

  // 4) Fetch product stock after test (from /api/inventario/productos)
  const prodList = await fetchJson(`${SERVER_URL}/api/inventario/productos`);
  let finalProduct = null;
  if (prodList.status === 200 && Array.isArray(prodList.body)) {
    finalProduct = prodList.body.find(x => Number(x.id) === Number(PRODUCT_ID)) || null;
    console.log('Post-test product entry:', finalProduct || 'Not found in /productos');
  } else {
    console.log('Could not fetch product list:', prodList);
  }

  const total = results.length;
  const successes = results.filter(r => r.res.status >= 200 && r.res.status < 300);
  const failures = results.filter(r => r.res.status >= 400);
  const successVentaIds = successes.map(s => s.res.body && s.res.body.ventaId).filter(Boolean);

  const report = {
    server: SERVER_URL,
    productId: Number(PRODUCT_ID),
    concurrency: CONCURRENCY,
    quantity: QUANTITY,
    totalRequests: total,
    successCount: successes.length,
    failureCount: failures.length,
    successVentaIds,
    failures: failures.map(f => ({ index: f.index, status: f.res.status, body: f.res.body })),
    finalProduct
  };

  const outPath = './scripts/concurrency_report.json';
  try {
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log('Report written to', outPath);
  } catch (e) {
    console.error('Failed to write report:', e);
  }
}

main().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
