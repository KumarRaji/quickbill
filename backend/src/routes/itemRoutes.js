// src/routes/itemRoutes.js
const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload');

const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  adjustStock,
  bulkUploadItems,
} = require('../controllers/itemController');

router.get('/', getItems);
router.post('/', createItem);

// ✅ Bulk upload (multipart/form-data, field name: file)
router.post('/bulk-upload', upload.single('file'), bulkUploadItems);

router.put('/:id', updateItem);
router.delete('/:id', deleteItem);
router.patch('/:id/stock', adjustStock);

module.exports = router;
