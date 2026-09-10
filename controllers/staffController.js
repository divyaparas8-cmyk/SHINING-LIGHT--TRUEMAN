const User = require('../models/User');
const Organization = require('../models/Organization');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// @desc    Get all staff
// @route   GET /api/staff
// @access  Private/Admin
const getAllStaff = async (req, res) => {
    try {
        const fetchFilter = { 
            organizationId: req.user.organizationId 
        };

        // If requester is admin, only show staff
        if (req.user.role === 'admin') {
            fetchFilter.role = 'staff';
        } else {
            fetchFilter.role = { $in: ['staff', 'admin'] };
        }

        const staff = await User.find(fetchFilter).select('-password');
        res.status(200).json({
            success: true,
            count: staff.length,
            data: staff
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create new staff
// @route   POST /api/staff
// @access  Private/Admin
const createStaff = async (req, res) => {
    let { name, email, password, role } = req.body;

    // Security: Admin can only create 'staff'
    if (req.user.role === 'admin') {
        role = 'staff';
    }

    try {
        let user = await User.findOne({ 
            email, 
            organizationId: req.user.organizationId 
        });

        if (user) {
            return res.status(400).json({ success: false, message: 'User already exists in your organization' });
        }

        // Check plan limits
        const organization = await Organization.findById(req.user.organizationId).populate('planId');
        if (!organization || !organization.planId) {
            return res.status(400).json({ success: false, message: 'Organization plan not found' });
        }

        const staffCount = await User.countDocuments({
            organizationId: req.user.organizationId,
            role: { $in: ['staff', 'admin'] }
        });

        if (staffCount >= organization.planId.maxStaff) {
            return res.status(400).json({ 
                success: false, 
                message: `You have reached the maximum staff limit (${organization.planId.maxStaff}) for your plan. Please upgrade to add more staff.` 
            });
        }

        user = await User.create({
            name,
            email,
            password,
            role: role || 'staff',
            status: req.body.status || 'Active',
            organizationId: req.user.organizationId
        });

        res.status(201).json({
            success: true,
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update staff
// @route   PUT /api/staff/:id
// @access  Private/Admin
const updateStaff = async (req, res) => {
    try {
        let user = await User.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        // Update fields if they exist in request body
        if (req.body.name) user.name = req.body.name;
        if (req.body.email) user.email = req.body.email;
        
        // Security: Only SuperAdmin can promote/demote admins
        if (req.body.role && req.user.role !== 'admin') {
            user.role = req.body.role;
        } else if (req.body.role === 'admin' && req.user.role === 'admin') {
            // Silently ignore or block role escalation to admin by an admin
            // We keep the existing role
        }

        if (req.body.status) user.status = req.body.status;
        if (req.body.password) user.password = req.body.password;

        await user.save();

        const updatedUser = await User.findById(user._id).select('-password');

        res.status(200).json({
            success: true,
            data: updatedUser
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete staff
// @route   DELETE /api/staff/:id
// @access  Private/Admin
const deleteStaff = async (req, res) => {
    try {
        const user = await User.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });

        if (!user) {
            return res.status(404).json({ success: false, message: 'Staff member not found' });
        }

        await User.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            data: {}
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getAllStaff,
    createStaff,
    updateStaff,
    deleteStaff
};
