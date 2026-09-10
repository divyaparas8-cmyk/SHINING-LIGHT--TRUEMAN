const User = require('../models/User');
const Organization = require('../models/Organization');
const imagekit = require('../config/imagekit');

// @desc    Get all staff
// @route   GET /api/users/staff
// @access  Private
const getStaff = async (req, res) => {
    try {
        const staff = await User.find({ 
            role: 'staff',
            organizationId: req.user.organizationId 
        }).select('-password');
        res.status(200).json({ success: true, data: staff });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get current user profile
// @route   GET /api/users/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.status(200).json({ success: true, data: user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update current user profile
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;

            if (req.body.password) {
                user.password = req.body.password;
            }

            if (req.file) {
                try {
                    const uploadResponse = await imagekit.upload({
                        file: req.file.buffer,
                        fileName: req.file.originalname,
                        folder: '/avatars'
                    });
                    user.avatar = uploadResponse.url;
                } catch (err) {
                    console.error('ImageKit Upload Error:', err);
                    return res.status(500).json({ success: false, message: 'File upload failed' });
                }
            }

            const updatedUser = await user.save();

            // If admin, update organization logo
            let organizationLogo = '';
            if (updatedUser.role === 'admin' && updatedUser.organizationId) {
                await Organization.findByIdAndUpdate(updatedUser.organizationId, {
                    logo: updatedUser.avatar
                });
                organizationLogo = updatedUser.avatar;
            } else if (updatedUser.organizationId) {
                const org = await Organization.findById(updatedUser.organizationId);
                organizationLogo = org ? org.logo : '';
            }

            res.status(200).json({
                success: true,
                data: {
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                    avatar: updatedUser.avatar,
                    organizationLogo: organizationLogo
                }
            });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getStaff,
    getMe,
    updateProfile
};
