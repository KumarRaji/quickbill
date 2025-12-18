-- Add MRP column to invoice_items table
ALTER TABLE invoice_items ADD COLUMN mrp DECIMAL(10,2) DEFAULT 0 AFTER quantity;
