-- Update the party with ID 1 to be "Walk-in Customer" instead of "arun"
UPDATE parties SET name = 'Walk-in Customer' WHERE id = 1;

-- Or if you want to keep "arun" and create a new walk-in customer:
-- INSERT INTO parties (name, phone, gstin, balance, address) VALUES ('Walk-in Customer', NULL, NULL, 0, NULL);
-- Then update CASH_PARTY_ID in invoiceController.js to the new ID