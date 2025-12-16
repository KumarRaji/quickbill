const db = require("../config/db");

const toInt = (v, fallback) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// GET /api/suppliers?search=&page=&pageSize=
exports.listSuppliers = (req, res) => {
  const sql = `SELECT id, name, phone, gstin, address, balance FROM suppliers ORDER BY id DESC`;
  
  db.query(sql, (err, rows) => {
    if (err) return res.status(500).json({ message: "DB error", error: err.message });
    res.json(rows);
  });
};

// GET /api/suppliers/:id
exports.getSupplierById = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

  db.query(
    `SELECT id, name, phone, gstin, address, balance, created_at, updated_at FROM suppliers WHERE id=?`,
    [id],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "DB error", error: err.message });
      if (!rows || rows.length === 0) return res.status(404).json({ message: "Supplier not found" });
      res.json({ message: "Supplier", data: rows[0] });
    }
  );
};

// POST /api/suppliers
exports.createSupplier = (req, res) => {
  const { name, phone, gstin, address, balance } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ message: "name is required" });
  }

  const sql = `
    INSERT INTO suppliers (name, phone, gstin, address, balance)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      String(name).trim(),
      phone ? String(phone).trim() : null,
      gstin ? String(gstin).trim() : null,
      address ? String(address).trim() : null,
      Number(balance || 0),
    ],
    (err, result) => {
      if (err) {
        // handles UNIQUE gstin error nicely
        if (err.code === "ER_DUP_ENTRY") {
          return res.status(409).json({ message: "GSTIN already exists" });
        }
        return res.status(500).json({ message: "DB error", error: err.message });
      }

      res.status(201).json({
        message: "Supplier created",
        data: { id: result.insertId },
      });
    }
  );
};

// PATCH /api/suppliers/:id
exports.updateSupplier = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

  const allowed = ["name", "phone", "gstin", "address", "balance"];
  const sets = [];
  const values = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      sets.push(`${key}=?`);
      if (key === "balance") values.push(Number(req.body[key] || 0));
      else values.push(req.body[key] === "" ? null : String(req.body[key]).trim());
    }
  }

  if (sets.length === 0) return res.status(400).json({ message: "No fields to update" });

  const sql = `UPDATE suppliers SET ${sets.join(", ")} WHERE id=?`;

  db.query(sql, [...values, id], (err, result) => {
    if (err) {
      if (err.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message: "GSTIN already exists" });
      }
      return res.status(500).json({ message: "DB error", error: err.message });
    }

    if (!result.affectedRows) return res.status(404).json({ message: "Supplier not found" });

    res.json({ message: "Supplier updated" });
  });
};

// DELETE /api/suppliers/:id
exports.deleteSupplier = (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });

  db.query(`DELETE FROM suppliers WHERE id=?`, [id], (err, result) => {
    if (err) return res.status(500).json({ message: "DB error", error: err.message });
    if (!result.affectedRows) return res.status(404).json({ message: "Supplier not found" });

    res.json({ message: "Supplier deleted" });
  });
};
