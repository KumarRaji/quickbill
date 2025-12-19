-- Complete QuickBill Database Schema with All Updates
CREATE DATABASE IF NOT EXISTS quickbilldb;
USE quickbilldb;

-- USERS TABLE
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SUPER_ADMIN', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

INSERT INTO users (name, username, password_hash, role) VALUES
('Super Admin', 'superadmin', '$2a$10$rZ5YhJKvXqKqJqKqJqKqJuN5YhJKvXqKqJqKqJqKqJqKqJqKqJqKq', 'SUPER_ADMIN');

-- PARTIES TABLE (Customers)
CREATE TABLE parties (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  gstin VARCHAR(20),
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
-- Insert default parties
INSERT INTO parties (id, name, phone, gstin, address, balance) VALUES
(1, 'Walkin-Customer', '1234567890', '', '', 0);

-- SUPPLIERS TABLE
CREATE TABLE suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  gstin VARCHAR(20),
  address VARCHAR(255),
  balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- ITEMS TABLE
CREATE TABLE items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NULL,
  supplier_id INT UNSIGNED NULL,
  code VARCHAR(50) NULL,
  barcode VARCHAR(50) NULL,
  selling_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock DECIMAL(10,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(10,2) NULL DEFAULT 5,
  expiry_date DATE NULL,
  unit VARCHAR(20) NOT NULL DEFAULT 'pcs',
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  mrp DECIMAL(10,2) NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_barcode (barcode),
  KEY idx_category (category),
  KEY idx_supplier (supplier_id),
  KEY idx_stock (stock)
);

-- STOCK TABLE
CREATE TABLE stock (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NULL,
  barcode VARCHAR(100) NULL,
  supplier_id INT NULL,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) NULL DEFAULT 'PCS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- INVOICES TABLE
CREATE TABLE invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_id INT UNSIGNED NOT NULL,
  invoice_no VARCHAR(50),
  type ENUM('SALE','RETURN','PURCHASE','PURCHASE_RETURN') NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  invoice_date DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  payment_mode ENUM('CASH','ONLINE','CHEQUE','CREDIT') NOT NULL DEFAULT 'CASH',
  original_invoice_id INT NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT fk_invoices_party FOREIGN KEY (party_id) REFERENCES parties(id),
  KEY idx_original_invoice (original_invoice_id)
);

-- INVOICE ITEMS TABLE
CREATE TABLE invoice_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  invoice_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  name VARCHAR(150),
  quantity DECIMAL(12,2) NOT NULL,
  mrp DECIMAL(10,2) NOT NULL DEFAULT 0,
  price DECIMAL(12,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_invoice_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  CONSTRAINT fk_invoice_items_item FOREIGN KEY (item_id) REFERENCES items(id)
);

-- PAYMENTS TABLE
CREATE TABLE payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_id INT UNSIGNED NOT NULL,
  type ENUM('IN','OUT') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATETIME NOT NULL,
  mode VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_payments_party FOREIGN KEY (party_id) REFERENCES parties(id)
);

-- EXPENSES TABLE
CREATE TABLE expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- SALE RETURN AUDIT TABLE
CREATE TABLE sale_return_audit (
  id INT NOT NULL AUTO_INCREMENT,
  original_invoice_id INT NOT NULL,
  return_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reason VARCHAR(255) NULL,
  processed_by VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_original_invoice (original_invoice_id),
  KEY idx_return_invoice (return_invoice_id),
  KEY idx_item (item_id)
);

-- PURCHASE RETURN AUDIT TABLE
CREATE TABLE purchase_return_audit (
  id INT NOT NULL AUTO_INCREMENT,
  original_invoice_id INT NOT NULL,
  return_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reason VARCHAR(255) NULL,
  processed_by VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_original_invoice (original_invoice_id),
  KEY idx_return_invoice (return_invoice_id),
  KEY idx_item (item_id)
);
