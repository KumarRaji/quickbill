const express = require('express');
const router = express.Router();
const { getPurchaseBills } = require('../controllers/purchaseBillController');

router.get('/', getPurchaseBills);

module.exports = router;
