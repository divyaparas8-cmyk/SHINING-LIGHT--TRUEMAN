const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// @desc    Create checkout session
// @route   POST /api/payment/create-checkout-session
// @access  Public
const createCheckoutSession = async (req, res) => {
    const { amount, planName, organizationName, adminEmail } = req.body;

    try {
            const frontendUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `${planName} Plan - ${organizationName}`,
                            description: `Registration payment for ${organizationName}`,
                        },
                        unit_amount: amount * 100, // Stripe expects amount in cents
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${frontendUrl}/register?session_id={CHECKOUT_SESSION_ID}&status=success`,
            cancel_url: `${frontendUrl}/register?status=cancelled`,
            customer_email: adminEmail,
            metadata: {
                organizationName,
                planName,
                adminEmail,
                amount: String(amount),
                planId: req.body.planId || ''
            },
        });

        res.status(200).json({
            success: true,
            sessionId: session.id,
            url: session.url,
        });
    } catch (error) {
        console.error('Checkout Session Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Verify checkout session
// @route   GET /api/payment/verify-session/:sessionId
// @access  Public
const verifyCheckoutSession = async (req, res) => {
    const { sessionId } = req.params;

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        res.status(200).json({
            success: true,
            session: {
                id: session.id,
                payment_status: session.payment_status,
                customer_email: session.customer_details?.email,
                amount_total: session.amount_total,
                currency: session.currency,
                metadata: session.metadata,
            },
        });
    } catch (error) {
        console.error('Session Verification Error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
    createCheckoutSession,
    verifyCheckoutSession,
};