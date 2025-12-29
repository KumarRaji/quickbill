// src/routes/purchaseBillRoutes.js
const express = require("express");
const router = express.Router();

const purchaseBillController = require("../controllers/purchaseBillController");

router.get("/", purchaseBillController.getPurchaseBills);
router.post("/", purchaseBillController.createPurchaseBill);
router.patch("/:id", purchaseBillController.updatePurchaseBill);

module.exports = router;
