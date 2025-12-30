// test_transacciones.js

// Importo las funciones que quiero probar desde mi controlador
// test_transacciones.js (Corregido)

// Uso el nombre correcto del archivo: 'inventario.controller.js'
const { procesarNuevaCompra, procesarNuevaVenta, calcularStockPorMovimientos } = require('./inventario.controller');
// --- Configuración de Pruebas ---
// ASEGÚRATE DE QUE ESTOS IDs EXISTEN EN TU BASE DE DATOS
const PRODUCTO_ID = 1; 
const PROVEEDOR_ID = 1;
const CLIENTE_ID = 1; 

async function ejecutarPruebas() {
    console.log("--- INICIANDO PRUEBAS DE INVENTARIO ---");

    // 1. CHEQUEAR STOCK ANTES DE EMPEZAR
    let stockInicial = await calcularStockPorMovimientos(PRODUCTO_ID);
    console.log(`\nStock Inicial del Producto ${PRODUCTO_ID}: ${stockInicial}`);

    // =================================================================
    // PRUEBA A: REGISTRAR COMPRA (Entrada de 10 unidades)
    // =================================================================
    console.log("\n--- EJECUTANDO COMPRA (ENTRADA DE 10 UNIDADES) ---");
    const compraExitosa = {
        datosCompra: {
            proveedorId: PROVEEDOR_ID, 
            numeroFactura: `C-${Date.now()}`, // Factura única
            totalNeto: 80.00,
            porcentajeDescuento: 0.00,
            montoDescuento: 0.00,
            costoAntesImpuesto: 80.00,
            impuestos: 4.00,
            totalBruto: 84.00,
            metodoPago: "Contado"
        },
        detallesProductos: [
            {
                productoId: PRODUCTO_ID,
                cantidad: 10, // <-- Cantidad a sumar
                costoUnitario: 8.00, 
                subtotal: 80.00
            }
        ]
    };

    const resultadoCompra = await procesarNuevaCompra(compraExitosa.datosCompra, compraExitosa.detallesProductos);
    
    if (resultadoCompra.success) {
        console.log(`✅ COMPRA EXITOSA. ID: ${resultadoCompra.id_compra}`);
    } else {
        console.error("❌ COMPRA FALLIDA:", resultadoCompra.error);
        return; // Detenemos si la compra falla
    }

    // 2. CHEQUEAR STOCK DESPUÉS DE LA COMPRA
    let stockDespuesCompra = await calcularStockPorMovimientos(PRODUCTO_ID);
    console.log(`Stock después de Compra: ${stockDespuesCompra} (Debería ser ${stockInicial + 10})`);


    // =================================================================
    // PRUEBA B: REGISTRAR VENTA (Salida de 3 unidades)
    // =================================================================
    console.log("\n--- EJECUTANDO VENTA (SALIDA DE 3 UNIDADES) ---");
    const ventaExitosa = {
        datosVenta: {
            clienteId: CLIENTE_ID, 
            numeroFactura: `V-${Date.now()}`, // Factura única
            totalNeto: 30.00,
            porcentajeDescuento: 0.00,
            montoDescuento: 0.00,
            totalAntesImpuesto: 30.00,
            impuestos: 4.50,
            totalBruto: 34.50,
            metodoPago: "Efectivo"
        },
        detallesProductos: [
            {
                productoId: PRODUCTO_ID,
                cantidad: 3, // <-- Cantidad a restar
                precioUnitario: 10.00,
                subtotal: 30.00
            }
        ]
    };

    const resultadoVenta = await procesarNuevaVenta(ventaExitosa.datosVenta, ventaExitosa.detallesProductos);

    if (resultadoVenta.success) {
        console.log(`✅ VENTA EXITOSA. ID: ${resultadoVenta.id_venta}`);
    } else {
        console.error("❌ VENTA FALLIDA:", resultadoVenta.error);
    }
    
    // 3. CHEQUEAR STOCK FINAL
    let stockFinal = await calcularStockPorMovimientos(PRODUCTO_ID);
    console.log(`Stock después de Venta: ${stockFinal} (Debería ser ${stockInicial + 10 - 3})`);

    console.log("\n--- PRUEBAS TERMINADAS ---");
}

ejecutarPruebas();

// IMPORTANTE: Asegúrate de detener este script después de que termine para liberar la conexión.