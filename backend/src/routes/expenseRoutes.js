// src/routes/expenseRoutes.js
const express = require('express');
const router = express.Router();
const {
  getExpenses,
  createExpense,
} = require('../controllers/expenseController');

router.get('/', getExpenses);
router.post('/', createExpense);

module.exports = router;
