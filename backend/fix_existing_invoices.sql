-- Check current party records
SELECT id, name FROM parties ORDER BY id;

-- Check invoices that are using party_id = 1 (which should be walk-in customers)
SELECT id, party_id, invoice_no, type, total_amount FROM invoices WHERE party_id = 1;

-- Update existing invoices that were created as "walk-in" to use the new Walk-in Customer ID
-- First, find the ID of your Walk-in Customer record
SELECT id FROM parties WHERE name = 'Walk-in Customer';

-- Update invoices to use the correct Walk-in Customer ID (replace 'NEW_WALK_IN_ID' with actual ID)
-- UPDATE invoices SET party_id = 'NEW_WALK_IN_ID' WHERE party_id = 1;

-- Alternative: If you want to keep "naveen" as party_id = 1, update CASH_PARTY_ID in backend
-- Or create a new Walk-in Customer and update the backend constant