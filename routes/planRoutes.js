const express = require('express');
const router = express.Router();
const { getPlans } = require('../controllers/superAdminController');

// Public route to get all plans
router.get('/', getPlans);

module.exports = router;
