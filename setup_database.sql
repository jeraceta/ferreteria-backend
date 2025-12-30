-- setup_database.sql

-- 1. CREAR Y USAR LA BASE DE DATOS
CREATE DATABASE IF NOT EXISTS ferreteria;
USE ferreteria;

-- 2. TABLA DE CLIENTES
-- Es necesaria para la llave foránea en 'ventas'
CREATE TABLE IF NOT EXISTS clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    identificacion VARCHAR(20) UNIQUE,
    direccion VARCHAR(255),
    telefono VARCHAR(20),
    email VARCHAR(100)
);

-- 3. TABLA DE PROVEEDORES
-- Es necesaria para la llave foránea en 'compras'
CREATE TABLE IF NOT EXISTS proveedores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    contacto VARCHAR(100),
    telefono VARCHAR(20),
    email VARCHAR(100)
);

-- 4. TABLA DE PRODUCTOS
-- Contiene el STOCK y el COSTO (se actualizan con las transacciones)
CREATE TABLE IF NOT EXISTS productos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    stock INT DEFAULT 0,
    precio_venta DECIMAL(10, 2) NOT NULL,
    precio_costo DECIMAL(10, 2) NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_modificacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 5. TABLA DE VENTAS (Cabecera de la factura)
CREATE TABLE IF NOT EXISTS ventas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_cliente INT NOT NULL,
    numero_factura VARCHAR(50) UNIQUE NOT NULL,
    fecha_venta TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_neto DECIMAL(10, 2),
    porcentaje_descuento DECIMAL(5, 2) DEFAULT 0.00,
    monto_descuento DECIMAL(10, 2) DEFAULT 0.00,
    total_antes_impuesto DECIMAL(10, 2),
    impuestos DECIMAL(10, 2),
    total_bruto DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(50),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id)
);

-- 6. TABLA DETALLE VENTA (Líneas de la factura)
CREATE TABLE IF NOT EXISTS detalle_venta (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_venta INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    precio_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (id_venta) REFERENCES ventas(id),
    FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- 7. TABLA DE COMPRAS (Cabecera de la factura de proveedor)
CREATE TABLE IF NOT EXISTS compras (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_proveedor INT NOT NULL,
    numero_factura_proveedor VARCHAR(50) UNIQUE NOT NULL,
    fecha_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    total_neto DECIMAL(10, 2),
    porcentaje_descuento DECIMAL(5, 2) DEFAULT 0.00,
    monto_descuento DECIMAL(10, 2) DEFAULT 0.00,
    costo_antes_impuesto DECIMAL(10, 2),
    impuestos_compra DECIMAL(10, 2),
    total_bruto DECIMAL(10, 2) NOT NULL,
    metodo_pago VARCHAR(50),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id)
);

-- 8. TABLA DETALLE COMPRA (Líneas de la factura del proveedor)
CREATE TABLE IF NOT EXISTS detalle_compra (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_compra INT NOT NULL,
    id_producto INT NOT NULL,
    cantidad INT NOT NULL,
    costo_unitario DECIMAL(10, 2) NOT NULL,
    subtotal DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (id_compra) REFERENCES compras(id),
    FOREIGN KEY (id_producto) REFERENCES productos(id)
);

-- 9. TABLA MOVIMIENTOS DE INVENTARIO (El historial de stock)
CREATE TABLE IF NOT EXISTS movimientos_inventario (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_producto INT NOT NULL,
    tipo_movimiento ENUM('COMPRA', 'VENTA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA') NOT NULL,
    cantidad INT NOT NULL, -- La cantidad es positiva para entradas, negativa para salidas
    id_cliente INT NULL, 
    id_proveedor INT NULL,
    referencia_id INT NOT NULL, -- ID de la venta/compra/ajuste
    referencia_tabla VARCHAR(50) NOT NULL, -- 'ventas' o 'compras' o 'ajustes'
    fecha_movimiento TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    comentario TEXT,
    FOREIGN KEY (id_producto) REFERENCES productos(id),
    FOREIGN KEY (id_cliente) REFERENCES clientes(id),
    FOREIGN KEY (id_proveedor) REFERENCES proveedores(id)
);

-- 10. INSERCIÓN DE DATOS INICIALES (Mínimo para que la prueba funcione)
-- Necesitamos 1 producto, 1 cliente y 1 proveedor para que las llaves foráneas no fallen.

INSERT INTO clientes (nombre, identificacion) VALUES ('Cliente Prueba Principal', 'V-12345678');
INSERT INTO proveedores (nombre, contacto) VALUES ('Proveedor Principal S.A.', 'Juan Pérez');
INSERT INTO productos (codigo, nombre, stock, precio_venta, precio_costo) 
VALUES ('CL-001', 'Clavos de 2 Pulgadas', 50, 2.50, 1.50);