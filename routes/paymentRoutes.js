const express = require('express');
const router = express.Router();
const { createCheckoutSession, verifyCheckoutSession } = require('../controllers/paymentController');

router.post('/create-checkout-session', createCheckoutSession);
router.get('/verify-session/:sessionId', verifyCheckoutSession);

module.exports = router;