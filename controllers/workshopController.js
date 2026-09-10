const Workshop = require('../models/Workshop');
const Attendance = require('../models/Attendance');

// @desc    Get all workshops
// @route   GET /api/workshops
// @access  Private
const getWorkshops = async (req, res) => {
    try {
        const workshops = await Workshop.find({ organizationId: req.user.organizationId }).sort({ createdAt: -1 });

        // Map to return expected format: id, name, pointsReward, createdAt
        const formattedWorkshops = workshops.map(w => ({
            id: w._id,
            _id: w._id, // Legacy support just in case frontend needs it
            name: w.name,
            description: w.description,
            pointsReward: w.pointsReward,
            createdAt: w.createdAt
        }));

        res.status(200).json(formattedWorkshops);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get single workshop
// @route   GET /api/workshops/:id
// @access  Private
const getWorkshopById = async (req, res) => {
    try {
        const workshop = await Workshop.findOne({ _id: req.params.id, organizationId: req.user.organizationId });

        if (!workshop) {
            return res.status(404).json({ success: false, message: 'Workshop not found' });
        }

        res.status(200).json({
            success: true,
            workshop: {
                id: workshop._id,
                name: workshop.name,
                description: workshop.description,
                pointsReward: workshop.pointsReward
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create workshop
// @route   POST /api/workshops
// @access  Private/Admin
const createWorkshop = async (req, res) => {
    try {
        const { name, description, pointsReward } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Please add a workshop name' });
        }

        const workshop = await Workshop.create({
            name,
            description,
            pointsReward: pointsReward || 1,
            createdBy: req.user._id,
            organizationId: req.user.organizationId
        });

        res.status(201).json({
            success: true,
            workshop: {
                id: workshop._id,
                name: workshop.name,
                description: workshop.description,
                pointsReward: workshop.pointsReward
            }
        });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Workshop name already exists' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update workshop
// @route   PUT /api/workshops/:id
// @access  Private/Admin
const updateWorkshop = async (req, res) => {
    try {
        const { name, description, pointsReward } = req.body;

        let workshop = await Workshop.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });
        if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });

        // Build object with only allowed fields
        const updateData = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (pointsReward !== undefined) updateData.pointsReward = pointsReward;

        workshop = await Workshop.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({
            success: true,
            workshop: {
                id: workshop._id,
                name: workshop.name,
                description: workshop.description,
                pointsReward: workshop.pointsReward
            }
        });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Workshop name already exists' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete workshop
// @route   DELETE /api/workshops/:id
// @access  Private/Admin
const deleteWorkshop = async (req, res) => {
    try {
        const workshop = await Workshop.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });
        if (!workshop) return res.status(404).json({ success: false, message: 'Workshop not found' });

        // No restricted deletion - client wants full control to delete any workshop even with attendance
        await workshop.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    getWorkshops,
    getWorkshopById,
    createWorkshop,
    updateWorkshop,
    deleteWorkshop
};
