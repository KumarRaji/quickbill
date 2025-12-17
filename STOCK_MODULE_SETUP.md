# Stock Module Setup Instructions

## Database Setup

1. Run the SQL script to create the stock table:
```bash
mysql -u root -p quickbill < backend/create_stock_table.sql
```

Or manually execute in MySQL:
```sql
CREATE TABLE IF NOT EXISTS stock (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(100),
  barcode VARCHAR(100),
  supplier_id INT,
  purchase_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'PCS',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);
```

## Backend Setup

The backend is already configured with:
- Stock controller: `backend/src/controllers/stockController.js`
- Stock routes: `backend/src/routes/stock.routes.js`
- Routes registered in `server.js`

## Frontend Setup

1. The Stock Management page is created at: `quickbill/pages/StockManagement.tsx`
2. Stock service is added to: `quickbill/services/api.ts`
3. Route is added to App.tsx

## How to Access

Navigate to: `http://localhost:3000/stock-management`

Or add a menu item in your Layout component.

## Features

1. **Add Stock**: Add products to stock with supplier, purchase price, quantity
2. **Edit Stock**: Update stock details
3. **Delete Stock**: Remove stock items
4. **Move to Items**: Move stock to items master with selling price, MRP, and tax rate
5. **Search**: Search by name, code, or barcode

## Workflow

1. Add products to Stock Management (holding area)
2. When ready for sale, click "Move to Items" button
3. Set selling price, MRP, and tax rate
4. Product moves to Items Master and is available for sale
5. Original stock entry is deleted after successful move
