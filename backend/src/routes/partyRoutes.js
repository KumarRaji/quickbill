// src/routes/partyRoutes.js
const express = require('express');
const router = express.Router();
const {
  getParties,
  createParty,
  updateParty,
  updateBalance,
} = require('../controllers/partyController');

router.get('/', getParties);
router.post('/', createParty);
router.put('/:id', updateParty);
router.patch('/:id/balance', updateBalance);

module.exports = router;
