-- Complete QuickBill Database Schema (Corrected)
CREATE DATABASE IF NOT EXISTS quickbilldb
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE quickbilldb;

-- 1) USERS TABLE
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('SUPER_ADMIN', 'ADMIN', 'STAFF') NOT NULL DEFAULT 'STAFF',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO users (name, username, password_hash, role)
VALUES ('Super Admin', 'superadmin',
        '$2a$12$B.eyQ6.6qe.xlhUhytSkv.OeFaWs2VeRwRrYLhLgExokaElXhfGbq',
        'SUPER_ADMIN')
ON DUPLICATE KEY UPDATE username = username;

-- 2) PARTIES TABLE (Customers)
CREATE TABLE IF NOT EXISTS parties (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  gstin VARCHAR(20),
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  address VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 3) SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS suppliers (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(20),
  gstin VARCHAR(20),
  address VARCHAR(255),
  balance DECIMAL(18,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;


-- 4) ITEMS TABLE
CREATE TABLE IF NOT EXISTS items (
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
  mrp DECIMAL(10,2) NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_barcode (barcode),
  KEY idx_category (category),
  KEY idx_supplier (supplier_id),
  KEY idx_stock (stock),
  CONSTRAINT fk_items_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;


-- 5) STOCK TABLE
CREATE TABLE IF NOT EXISTS stock (
  id INT NOT NULL AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100) NULL,
  barcode VARCHAR(100) NULL,
  supplier_id INT UNSIGNED NULL,
  purchase_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  mrp DECIMAL(10,2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) NULL DEFAULT 'PCS',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_supplier (supplier_id),
  CONSTRAINT fk_stock_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;


-- 6) SALE INVOICES TABLE
CREATE TABLE IF NOT EXISTS sale_invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_id INT UNSIGNED NOT NULL,
  invoice_no VARCHAR(50) NOT NULL,
  type ENUM('SALE','RETURN','PURCHASE','PURCHASE_RETURN') NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_date DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_mode ENUM('CASH','ONLINE','CHEQUE','CREDIT') NOT NULL DEFAULT 'CASH',
  original_invoice_id INT UNSIGNED NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_sale_invoices_party (party_id),
  KEY idx_sale_original (original_invoice_id),
  CONSTRAINT fk_sale_invoices_party
    FOREIGN KEY (party_id) REFERENCES parties(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_sale_invoices_original
    FOREIGN KEY (original_invoice_id) REFERENCES sale_invoices(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;



-- 7) PURCHASE INVOICES TABLE
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  supplier_id INT UNSIGNED NOT NULL,
  invoice_no VARCHAR(50) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  invoice_date DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  payment_mode ENUM('CASH','ONLINE','CHEQUE','CREDIT') NOT NULL DEFAULT 'CASH',
  original_purchase_invoice_id INT UNSIGNED NULL,
  is_closed TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_purchase_invoices_supplier (supplier_id),
  KEY idx_purchase_original (original_purchase_invoice_id),
  CONSTRAINT fk_purchase_invoices_supplier
    FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT fk_purchase_invoices_original
    FOREIGN KEY (original_purchase_invoice_id) REFERENCES purchase_invoices(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL
) ENGINE=InnoDB;


-- 8) INVOICE ITEMS TABLE (linked to SALE invoices)
CREATE TABLE IF NOT EXISTS invoice_items (
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
  KEY idx_invoice_items_invoice (invoice_id),
  KEY idx_invoice_items_item (item_id),
  CONSTRAINT fk_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_invoice_items_item
    FOREIGN KEY (item_id) REFERENCES items(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;


-- 9) PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS payments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  party_id INT UNSIGNED NOT NULL,
  type ENUM('IN','OUT') NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_date DATETIME NOT NULL,
  mode VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payments_party (party_id),
  CONSTRAINT fk_payments_party
    FOREIGN KEY (party_id) REFERENCES parties(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;


-- 10) EXPENSES TABLE
CREATE TABLE IF NOT EXISTS expenses (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category VARCHAR(100),
  amount DECIMAL(12,2) NOT NULL,
  expense_date DATETIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;


-- 11) SALE RETURN AUDIT TABLE
CREATE TABLE IF NOT EXISTS sale_return_audit (
  id INT NOT NULL AUTO_INCREMENT,
  original_invoice_id INT NOT NULL,
  return_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reason VARCHAR(255) NULL,
  processed_by VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_original_invoice (original_invoice_id),
  KEY idx_return_invoice (return_invoice_id),
  KEY idx_item (item_id)
) ENGINE=InnoDB;


-- 12) PURCHASE RETURN AUDIT TABLE
CREATE TABLE IF NOT EXISTS purchase_return_audit (
  id INT NOT NULL AUTO_INCREMENT,
  original_invoice_id INT NOT NULL,
  return_invoice_id INT NOT NULL,
  item_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  reason VARCHAR(255) NULL,
  processed_by VARCHAR(80) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_original_invoice (original_invoice_id),
  KEY idx_return_invoice (return_invoice_id),
  KEY idx_item (item_id)
) ENGINE=InnoDB;

-- 13) sale_invoice_items TABLE
CREATE TABLE IF NOT EXISTS sale_invoice_items (
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
  KEY idx_sale_invoice_items_invoice (invoice_id),
  KEY idx_sale_invoice_items_item (item_id),
  CONSTRAINT fk_sale_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES sale_invoices(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_sale_invoice_items_item
    FOREIGN KEY (item_id) REFERENCES items(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;
-- 14) purchase_invoice_items TABLE
CREATE TABLE IF NOT EXISTS purchase_invoice_items (
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
  KEY idx_purchase_invoice_items_invoice (invoice_id),
  KEY idx_purchase_invoice_items_item (item_id),
  CONSTRAINT fk_purchase_invoice_items_invoice
    FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id)
    ON UPDATE CASCADE
    ON DELETE CASCADE,
  CONSTRAINT fk_purchase_invoice_items_item
    FOREIGN KEY (item_id) REFERENCES items(id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT
) ENGINE=InnoDB;





USE quickbilldb;

TRUNCATE TABLE expenses;



select * from users;
select * from parties;
select * from suppliers;
select * from items;
select * from stock;
select * from payments;
select * from expenses;
select * from sale_invoice_items;
select * from sale_invoices;
select * from purchase_invoices;
select * from sale_return_audit;
select * from purchase_return_audit;
select * from invoice_items;

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE sale_invoice_items;
TRUNCATE TABLE sale_invoices;

TRUNCATE TABLE items;

SET FOREIGN_KEY_CHECKS = 1;
TRUNCATE TABLE payments;