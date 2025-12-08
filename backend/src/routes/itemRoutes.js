// src/routes/itemRoutes.js
const express = require('express');
const router = express.Router();
const {
  getItems,
  createItem,
  updateItem,
  deleteItem,
  adjustStock,
} = require('../controllers/itemController');

router.get('/', getItems);
router.post('/', createItem);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);
router.patch('/:id/stock', adjustStock);

module.exports = router;
