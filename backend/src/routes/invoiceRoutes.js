// src/routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();

const invoiceController = require("../controllers/invoiceController");

// ✅ basic invoices
router.get("/", invoiceController.getInvoices);
router.get("/:id", invoiceController.getInvoiceById);
router.post("/", invoiceController.createInvoice);
router.patch("/:id", invoiceController.updateInvoice);
router.delete("/:id", invoiceController.deleteInvoice);

// ✅ add return routes ONLY if controller functions exist (prevents crash)
if (typeof invoiceController.applySaleReturn === "function") {
  router.post("/:id/sale-return", invoiceController.applySaleReturn);
} else {
  console.warn("⚠️ applySaleReturn is not exported from invoiceController.js");
}

if (typeof invoiceController.applyPurchaseReturn === "function") {
  router.post("/:id/purchase-return", invoiceController.applyPurchaseReturn);
} else {
  console.warn("⚠️ applyPurchaseReturn is not exported from invoiceController.js");
}

module.exports = router;
