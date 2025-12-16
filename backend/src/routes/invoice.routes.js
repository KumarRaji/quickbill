const express = require("express");
const router = express.Router();
const InvoiceModel = require("../models/InvoiceModel");

// GET all
router.get("/invoices", async (req, res) => {
  try {
    const invoices = await InvoiceModel.getAll();
    res.json(invoices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load invoices" });
  }
});

// GET by id
router.get("/invoices/:id", async (req, res) => {
  try {
    const invoice = await InvoiceModel.getById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load invoice" });
  }
});

// ✅ PATCH update
router.patch("/invoices/:id", async (req, res) => {
  try {
    const updated = await InvoiceModel.updateById(req.params.id, req.body);
    if (!updated) return res.status(404).json({ message: "Invoice not found" });
    res.json(updated);
  } catch (err) {
    console.error("PATCH /invoices/:id error:", err);
    res.status(500).json({ message: "Failed to update invoice" });
  }
});

// DELETE
router.delete("/invoices/:id", async (req, res) => {
  try {
    const deleted = await InvoiceModel.deleteById(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Invoice not found" });
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete invoice" });
  }
});

module.exports = router;
