const User = require('../models/User');
const Organization = require('../models/Organization');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const Subscription = require('../models/Subscription');
const generateToken = require('../utils/generateToken');

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        return res
            .status(400)
            .json({ success: false, message: 'Please provide an email and password' });
    }

    try {
        // Check for user
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Check if account is active
        if (user.status === 'Inactive') {
            return res.status(403).json({
                success: false,
                message: 'Your account is inactive. Please contact your administrator.'
            });
        }

        // Check organization status if user is an admin
        if (user.role === 'admin' || user.role === 'staff' || user.role === 'student') {
            const org = await Organization.findById(user.organizationId);
            if (!org || org.status === 'Pending') {
                return res.status(403).json({
                    success: false,
                    message: 'Your organization registration is currently pending approval. Please check back later.'
                });
            }
            if (org.status === 'Suspended') {
                return res.status(403).json({
                    success: false,
                    message: 'Your organization access has been suspended. Please contact support.'
                });
            }
            if (org.status === 'Rejected') {
                return res.status(403).json({
                    success: false,
                    message: 'Your organization registration request was rejected. Access denied.'
                });
            }

            // Check for subscription expiration
            if (org.expireDate && new Date(org.expireDate) < new Date()) {
                return res.status(403).json({
                    success: false,
                    message: `Your subscription expired on ${new Date(org.expireDate).toLocaleDateString()}. Please contact SuperAdmin to renew.`
                });
            }
        }

        // Check if password matches
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // Create token
        const token = generateToken(user._id, user.role);

        // Populate organization logo
        let organizationLogo = '';
        if (user.organizationId) {
            const org = await Organization.findById(user.organizationId);
            organizationLogo = org ? org.logo : '';
        }

        res.status(200).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                organizationId: user.organizationId,
                organizationLogo: organizationLogo
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Register a new Admin & Organization (Pending Approval)
// @route   POST /api/auth/register-admin
// @access  Public
const registerAdmin = async (req, res) => {
    const { 
        organizationName, 
        adminName, 
        adminEmail, 
        adminPassword, 
        planId,
        phoneNumber,
        registrationAmount,
        paymentMethod,
        registrationStatus // Added to handle 'Cancelled' or 'Failed' status
    } = req.body;

    try {
        // If it's a success registration, we clean up any partial/cancelled ones with the same email or name
        if (!registrationStatus || registrationStatus === 'Active') {
            const existingUser = await User.findOne({ email: adminEmail });
            if (existingUser) {
                const existingOrg = await Organization.findById(existingUser.organizationId);
                if (existingOrg && existingOrg.status === 'Active') {
                    return res.status(400).json({ success: false, message: 'An active account already exists with this email.' });
                }
                await User.deleteOne({ _id: existingUser._id });
                if (existingOrg) await Organization.deleteOne({ _id: existingOrg._id });
            }

            const existingOrgByName = await Organization.findOne({ name: organizationName });
            if (existingOrgByName) {
                if (existingOrgByName.status === 'Active') {
                    return res.status(400).json({ success: false, message: 'An active organization already exists with this name.' });
                }
                await Organization.deleteOne({ _id: existingOrgByName._id });
            }
        }

        const plan = await SubscriptionPlan.findById(planId);
        if (!plan) {
            return res.status(404).json({ success: false, message: 'Subscription plan not found' });
        }

        const startDate = new Date();
        const expireDate = new Date();
        if (plan.billingPeriod === 'Yearly') {
            expireDate.setFullYear(startDate.getFullYear() + 1);
        } else {
            expireDate.setMonth(startDate.getMonth() + 1);
        }

        const organization = await Organization.create({
            name: organizationName,
            planId,
            phoneNumber,
            registrationAmount,
            paymentMethod,
            status: registrationStatus === 'Cancelled' ? 'Rejected' : 'Active', 
            paymentStatus: registrationStatus === 'Cancelled' ? 'Pending' : 'Paid',
            planType: plan.billingPeriod,
            startDate,
            expireDate
        });

        // Create Admin User (Now with the registration ID)
        const adminUser = await User.create({
            name: adminName,
            email: adminEmail,
            password: adminPassword,
            role: 'admin',
            organizationId: organization._id
        });

        // Link User back to Organization
        organization.adminUserId = adminUser._id;
        await organization.save();

        // Create Subscription record for revenue tracking
        await Subscription.create({
            organizationId: organization._id,
            planId: plan._id,
            amount: registrationAmount || plan.price,
            status: registrationStatus === 'Cancelled' ? 'Cancelled' : 'Active',
            billingDate: new Date()
        });

        res.status(201).json({
            success: true,
            message: registrationStatus === 'Cancelled' 
                ? 'Attempt logged. Payment was not completed.'
                : 'Registration successful! Your account is now active. You can login immediately.'
        });
    } catch (error) {
        console.error('Registration Error:', error);
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

module.exports = {
    login,
    registerAdmin
};
