const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/', stockController.getStock);
router.get('/test-schema', stockController.testSchema);
router.post('/test-insert', stockController.testInsert);
router.post('/fix-tax-rates', stockController.fixTaxRates);
router.post('/bulk-upload', stockController.bulkUpload);
router.post('/', stockController.addStock);
router.put('/:id', stockController.updateStock);
router.delete('/:id', stockController.deleteStock);
router.get('/:id', stockController.getStockItem);
router.get('/:id/tax-rate', stockController.getTaxRateFromPurchaseBill);
router.post('/:id/move-to-items', stockController.moveToItems);

module.exports = router;