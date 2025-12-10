-- Find which party you're trying to delete and what payments reference it
-- Replace 'PARTY_ID' with the actual ID of the party you want to delete

-- 1. Check what payments exist for this party
SELECT id, party_id, type, amount, payment_date, notes 
FROM payments 
WHERE party_id = 'PARTY_ID';

-- 2. Delete the payments for this party (BE CAREFUL - this will delete payment records)
-- DELETE FROM payments WHERE party_id = 'PARTY_ID';

-- 3. After deleting payments, you can delete the party
-- DELETE FROM parties WHERE id = 'PARTY_ID';

-- Alternative: If you want to keep payment records, you could reassign them to a different party
-- UPDATE payments SET party_id = 'NEW_PARTY_ID' WHERE party_id = 'OLD_PARTY_ID';