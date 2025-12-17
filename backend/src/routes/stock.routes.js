const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

router.get('/', stockController.getStock);
router.post('/bulk-upload', stockController.bulkUpload);
router.post('/', stockController.addStock);
router.put('/:id', stockController.updateStock);
router.delete('/:id', stockController.deleteStock);
router.post('/:id/move-to-items', stockController.moveToItems);

module.exports = router;
