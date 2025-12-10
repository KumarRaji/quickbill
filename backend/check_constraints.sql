-- Check foreign key constraints that might prevent party deletion
SELECT 
    TABLE_NAME,
    COLUMN_NAME,
    CONSTRAINT_NAME,
    REFERENCED_TABLE_NAME,
    REFERENCED_COLUMN_NAME
FROM 
    INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
WHERE 
    REFERENCED_TABLE_NAME = 'parties';

-- Check if there are any invoices or payments referencing parties
SELECT 'invoices' as table_name, COUNT(*) as count FROM invoices WHERE party_id IN (SELECT id FROM parties);
SELECT 'payments' as table_name, COUNT(*) as count FROM payments WHERE party_id IN (SELECT id FROM parties);