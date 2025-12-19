# Database Migration Notes

## Table Rename: invoices → sale_invoices & purchase_invoices

The `invoices` table has been split into two separate tables:
- `sale_invoices` - for SALE and RETURN transactions
- `purchase_invoices` - for PURCHASE and PURCHASE_RETURN transactions

### Updated Files:
1. `backend/quickbill.sql` - Schema updated with new table structure
2. `backend/src/controllers/invoiceController.js` - Partially updated (SALE operations only)

### Remaining Work:
The `invoiceController.js` currently handles SALE invoices correctly with `sale_invoices` table.

However, the PURCHASE operations (applyPurchaseReturn function) still reference the old `invoices` table and need updating to use `purchase_invoices` and `purchase_invoice_items`.

### Migration SQL:
```sql
-- Migrate sale invoices
INSERT INTO sale_invoices (id, party_id, invoice_no, type, total_amount, invoice_date, notes, created_at, payment_mode, original_invoice_id, is_closed)
SELECT id, party_id, invoice_no, type, total_amount, invoice_date, notes, created_at, payment_mode, original_invoice_id, is_closed 
FROM invoices WHERE type IN ('SALE', 'RETURN');

-- Migrate purchase invoices (note: party_id becomes supplier_id, no type column)
INSERT INTO purchase_invoices (id, supplier_id, invoice_no, total_amount, invoice_date, notes, created_at, payment_mode, original_purchase_invoice_id, is_closed)
SELECT id, party_id, invoice_no, total_amount, invoice_date, notes, created_at, payment_mode, original_invoice_id, is_closed 
FROM invoices WHERE type IN ('PURCHASE', 'PURCHASE_RETURN');

-- Migrate invoice items
INSERT INTO sale_invoice_items 
SELECT ii.* FROM invoice_items ii 
JOIN invoices i ON ii.invoice_id = i.id 
WHERE i.type IN ('SALE', 'RETURN');

INSERT INTO purchase_invoice_items 
SELECT ii.* FROM invoice_items ii 
JOIN invoices i ON ii.invoice_id = i.id 
WHERE i.type IN ('PURCHASE', 'PURCHASE_RETURN');

-- Drop old tables after verification
-- DROP TABLE invoice_items;
-- DROP TABLE invoices;
```

### Note:
The current `invoiceController.js` is a unified controller handling both SALE and PURCHASE invoices. Consider splitting into:
- `saleInvoiceController.js` - handles sale_invoices
- `purchaseInvoiceController.js` - handles purchase_invoices (currently in purchaseBillController.js)
