const Setting = require('../models/Setting');
const Student = require('../models/Student');
const { evaluateStudentCompletion } = require('./documentController');

// @desc    Get all system settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res) => {
    try {
        let settings = await Setting.findOne({ organizationId: req.user.organizationId });

        if (!settings) {
            // Initialize with defaults if it doesn't exist for this organization
            settings = await Setting.create({ organizationId: req.user.organizationId });
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update system settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const { completionPointsThreshold } = req.body;
        let settings = await Setting.findOne({ organizationId: req.user.organizationId });
        const oldThreshold = settings ? settings.completionPointsThreshold : null;

        if (!settings) {
            settings = await Setting.create({ ...req.body, organizationId: req.user.organizationId });
        } else {
            settings = await Setting.findOneAndUpdate({ organizationId: req.user.organizationId }, req.body, {
                new: true,
                runValidators: true
            });
        }

        // If threshold changed, re-evaluate all students in this organization
        if (completionPointsThreshold !== undefined && completionPointsThreshold !== oldThreshold) {
            const students = await Student.find({ organizationId: req.user.organizationId }, '_id');
            const evaluations = students.map(student => evaluateStudentCompletion(student._id));
            await Promise.all(evaluations);
        }

        res.status(200).json({
            success: true,
            data: settings
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getSettings,
    updateSettings
};
