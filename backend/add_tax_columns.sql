-- Add tax_mode and gst_type columns to invoice tables

USE quickbilldb;

-- Add columns to sale_invoices table
ALTER TABLE sale_invoices 
ADD COLUMN tax_mode ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER payment_mode;

ALTER TABLE sale_invoices
ADD COLUMN gst_type ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER tax_mode;

-- Add columns to purchase_invoices table  
ALTER TABLE purchase_invoices
ADD COLUMN tax_mode ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER payment_mode;

ALTER TABLE purchase_invoices
ADD COLUMN gst_type ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER tax_mode;