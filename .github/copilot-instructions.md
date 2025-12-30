## Purpose
Provide concise, runnable guidance so an AI coding agent can be productive immediately in this repository.

## Big picture
- App type: Small Express.js API serving endpoints under `/api/*` (see [index.js](index.js)).
- Routing layer: routers live in `routers/` and mount under `/api/inventario`, `/api/clientes`, `/api/ventas`, `/api/compras`.
- Business logic: Controllers are plain JS modules in repository root (e.g. `inventario.controller.js`, `ventas.controller.js`). Routers call these controller functions directly.
- DB layer: `db.js` creates a `mysql2/promise` pool; `database.js` provides a thin `query` helper and exposes `pool` for transaction flows.

## Key files to inspect
- [index.js](index.js) — app bootstrap and route mounting.
- [db.js](db.js) and [database.js](database.js) — connection pooling and helper patterns.
- [inventario.controller.js](inventario.controller.js) — canonical examples of transactions, stock handling, and queries.
- `routers/*.js` (e.g. [routers/inventario.routes.js](routers/inventario.routes.js)) — how controllers are imported and how HTTP errors are reported.

## Patterns & conventions (do NOT break these)
- Use `async/await` with `mysql2/promise` APIs.
- Single-shot queries: prefer `database.js` helper (`database.query(sql, params)`) or `pool.execute(...)` for simple reads/writes.
- Transactions: obtain a dedicated connection and use it for all statements in the transaction. Pattern:

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(sql1, params1);
    await conn.execute(sql2, params2);
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

- Important: use `connection.execute(...)` (not `pool.execute`) inside transactions so statements run on the same connection.
- Controllers should throw on business errors; routers catch exceptions and map to HTTP responses with JSON `{ error, detalle }` (see `routers/*.js`).

## Domain-specific conventions
- Inventory model: prefer `stock_depositos` over updating `productos.stock` directly. `inventario.controller.js` is the authoritative example.
- Movement history: inventory changes must append rows to `movimientos_inventario` within the same transaction that updates stock.
- `id_deposito` semantics used across the codebase: 1 = principal, 2 = damaged, 3 = inmovilizado. Keep these IDs consistent when writing migrations or stock movements.

## Start / dev workflows
- Install dependencies: `npm install`.
- Run in development with auto-reload: `npm run dev` (uses `nodemon`).
- Run normally: `npm start` (node index.js). The server listens on port 3000 by default (see [index.js](index.js)).
- There are no automated tests configured; test scripts like `test_api_simple.js` and `test_transacciones.js` exist as ad-hoc runners — run them with `node`.

## Common change tasks — how-to
- Add endpoint: create a route entry in `routers/`, import the corresponding controller function (root-level controller file), and keep controllers focused on DB/business logic only.
- Add transactional flow: copy the pattern from `inventario.controller.js` (getConnection → beginTransaction → multiple `connection.execute` calls → commit/rollback → release).
- Query helper: use `database.query(sql, params)` for single-shot reads that don't need explicit connection management.

## Examples (prompts you can use)
- "Add POST /api/inventario/ajuste that calls a new `procesarAjusteInventario` in `inventario.controller.js` and follows the transaction pattern."
- "Refactor stock updates to always write to `stock_depositos` and append `movimientos_inventario` within one transaction (use `inventario.controller.js` as reference)."

## Notes & gotchas
- There are two stock styles in the codebase (direct `productos.stock` updates vs `stock_depositos`). Prefer `stock_depositos` for correctness; rely on `inventario.controller.js` for examples.
- Error messages are user-facing; preserve or map them when refactoring so clients keep consistent behavior.
- DB credentials are stored in `db.js` in plaintext. For production, this should move to environment variables (out of scope for quick changes here).

If anything is unclear or you want additional examples (cURL samples, minimal integration test, or a small endpoint scaffold), tell me which area to expand.
## Purpose
Provide concise, runnable guidance so an AI coding agent can be productive immediately in this repository.

## Big picture
- **App type:** Small Express.js API (single-process) serving endpoints under `/api/*` defined in `index.js`.
- **Routing layer:** Routers live in `routers/` and mount under `/api/inventario`, `/api/clientes`, `/api/ventas`, `/api/compras`.
- **Business logic:** Controllers are plain JS modules in the repo root (e.g. `inventario.controller.js`, `ventas.controller.js`) that export async functions used directly by routers.
- **DB layer:** `db.js` exports a `mysql2/promise` pool. `database.js` is a thin helper exposing `query` and `pool` for transaction usage.

## Key files to inspect
- [index.js](index.js) — app bootstrap and route mounting.
- [db.js](db.js) and [database.js](database.js) — connection pooling and helper patterns.
- [inventario.controller.js](inventario.controller.js) — canonical examples of transactions, stock handling, and queries.
- `routers/*.js` (e.g. [routers/inventario.routes.js](routers/inventario.routes.js)) — how controllers are imported and how HTTP errors are reported.

## Patterns & conventions (do not break these)
- Use async/await with `mysql2/promise` APIs. For single queries prefer `pool.execute(...)` (see `database.js`).
- For multi-step DB operations use a connection obtained via `const conn = await pool.getConnection()`; then `await conn.beginTransaction()` → `commit()` / `rollback()` and always `conn.release()` in `finally` (see `inventario.controller.js`).
- Transactions must use `connection.execute(...)` (not `pool.execute`) so all statements run on the same connection.
- Controllers throw on business errors; routers catch and map to HTTP responses (status and `{ error, detalle }` JSON).
- Stock model: stock is kept in `stock_depositos` and `id_deposito` values are meaningful (1 = principal, 2 = damaged, 3 = inmovilizado). Update and movement history are recorded in `movimientos_inventario`.

## Start / dev workflows
- To run in development with auto-reload: `npm run dev` (nodemon).
- To run normally: `npm start` (node index.js). The server listens on port 3000 by default (see `index.js`).
- There are no automated tests included; changes should be validated by running the server and using the API endpoints.

## Security & secrets
- DB credentials live in `db.js` in plaintext. For production, replace with environment variables and do not commit secrets.

## Common change tasks — quick how-tos
- Add endpoint: create a route file entry under `routers/`, import the corresponding controller function, and keep controllers focused on DB/business logic only.
- Add transactional flow: copy the pattern from `inventario.controller.js` (getConnection → beginTransaction → multiple `connection.execute` calls → commit/rollback → release).
- Query helper: use `database.js.query(sql, params)` for single-shot reads that don't need explicit connection management.

## Example prompt snippets for an AI agent
- "Add POST /api/inventario/ajuste endpoint that calls a new `procesarAjusteInventario` controller function following existing transaction pattern in `inventario.controller.js`."
- "Refactor stock updates to always write to `stock_depositos` and append the same movement row to `movimientos_inventario` using a single transaction (see existing examples)."

## Notes & gotchas
- There are two controller styles present (some controllers update `productos.stock`, others use `stock_depositos`). Favor `stock_depositos` for correctness — `inventario.controller.js` is the authoritative implementation.
- Error messages are user-facing; preserve or map them when refactoring so clients keep consistent behavior.

If anything here is unclear or you want more examples (open API tests, sample cURL calls, or a small integration test), tell me which area to expand.
