const pool = require('../config/db');

// GET /api/purchase-bills
exports.getPurchaseBills = (req, res) => {
  const sql = `
    SELECT 
      i.id,
      i.invoice_no as billNo,
      i.invoice_date as date,
      COALESCE(s.name, 'Cash Purchase') as supplier,
      i.total_amount as amount,
      i.payment_mode as status,
      i.party_id as supplierId
    FROM invoices i
    LEFT JOIN suppliers s ON i.party_id = s.id
    WHERE i.type = 'PURCHASE'
    ORDER BY i.id DESC
  `;

  pool.query(sql, (err, bills) => {
    if (err) {
      console.error('Error fetching purchase bills:', err);
      return res.status(500).json({ message: 'Failed to fetch purchase bills' });
    }

    if (bills.length === 0) {
      return res.json([]);
    }

    const billIds = bills.map(b => b.id);
    const itemsSql = `
      SELECT invoice_id, name, quantity 
      FROM invoice_items 
      WHERE invoice_id IN (?)
    `;

    pool.query(itemsSql, [billIds], (itemsErr, items) => {
      if (itemsErr) {
        console.error('Error fetching items:', itemsErr);
        return res.status(500).json({ message: 'Failed to fetch items' });
      }

      const itemsMap = {};
      items.forEach(item => {
        if (!itemsMap[item.invoice_id]) itemsMap[item.invoice_id] = [];
        itemsMap[item.invoice_id].push({
          name: item.name,
          quantity: item.quantity
        });
      });

      const response = bills.map(bill => ({
        id: bill.id.toString(),
        billNo: bill.billNo,
        date: bill.date,
        supplier: bill.supplier,
        items: itemsMap[bill.id] || [],
        amount: Number(bill.amount),
        status: bill.status === 'CASH' ? 'PAID' : 'UNPAID'
      }));

      res.json(response);
    });
  });
};
