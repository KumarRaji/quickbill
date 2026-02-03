const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

// Database configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'quickbilldb'
};

// Create connection
const connection = mysql.createConnection(dbConfig);

console.log('Running database migration to add tax columns...');

// Execute each ALTER statement separately
const statements = [
  "ALTER TABLE sale_invoices ADD COLUMN tax_mode ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER payment_mode",
  "ALTER TABLE sale_invoices ADD COLUMN gst_type ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER tax_mode",
  "ALTER TABLE purchase_invoices ADD COLUMN tax_mode ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER payment_mode",
  "ALTER TABLE purchase_invoices ADD COLUMN gst_type ENUM('IN_TAX', 'OUT_TAX') NOT NULL DEFAULT 'IN_TAX' AFTER tax_mode"
];

let completed = 0;
let hasError = false;

statements.forEach((sql, index) => {
  connection.execute(sql, (error, results) => {
    if (error) {
      if (error.code === 'ER_DUP_FIELDNAME') {
        console.log(`Column already exists for statement ${index + 1}, skipping...`);
      } else {
        console.error(`Statement ${index + 1} failed:`, error.message);
        hasError = true;
      }
    } else {
      console.log(`Statement ${index + 1} completed successfully`);
    }
    
    completed++;
    if (completed === statements.length) {
      if (!hasError) {
        console.log('Migration completed successfully!');
        console.log('Added tax_mode and gst_type columns to sale_invoices and purchase_invoices tables.');
      } else {
        console.log('Migration completed with some errors.');
      }
      connection.end();
    }
  });
});