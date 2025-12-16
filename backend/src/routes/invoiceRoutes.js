// src/routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();

// ✅ import controller
const invoiceController = require("../controllers/invoiceController");

// routes
router.get("/", invoiceController.getInvoices);
router.get("/:id", invoiceController.getInvoiceById);
router.post("/", invoiceController.createInvoice);

// ✅ UPDATE invoice
router.patch("/:id", invoiceController.updateInvoice);

// ✅ DELETE invoice
router.delete("/:id", invoiceController.deleteInvoice);

// ✅ sale return route
router.post("/:id/sale-return", invoiceController.applySaleReturn);

// ✅ purchase return route
router.post("/:id/purchase-return", invoiceController.applyPurchaseReturn);

module.exports = router;
