const Student = require('../models/Student');
const Document = require('../models/Document');
const Organization = require('../models/Organization');
const SubscriptionPlan = require('../models/SubscriptionPlan');

// @desc    Get all students
// @route   GET /api/students
// @access  Private (Admin: all, Staff: assigned only)
const getStudents = async (req, res) => {
    try {
        let students;
        if (req.user.role === 'admin') {
            students = await Student.find({ organizationId: req.user.organizationId }).populate('assignedStaff', 'name email');
        } else {
            // Staff sees only their assigned students within their organization
            students = await Student.find({ 
                organizationId: req.user.organizationId,
                assignedStaff: req.user._id 
            }).populate('assignedStaff', 'name email');
        }

        // Map to match frontend expectations
        const formattedStudents = students.map(student => ({
            id: student.studentId,
            _id: student._id,
            name: student.name,
            points: student.points,
            status: student.status,
            phone: student.phone,
            email: student.email,
            assignedStaff: student.assignedStaff ? {
                _id: student.assignedStaff._id,
                name: student.assignedStaff.name
            } : null,
            startDate: student.startDate
        }));

        res.status(200).json(formattedStudents);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Create student
// @route   POST /api/students
// @access  Private/Admin
const createStudent = async (req, res) => {
    const { name, phone, email, assignedStaff, status, points, startDate } = req.body;

    if (!name || !phone || !email || !assignedStaff) {
        return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    try {
        // Check if student with email already exists within the organization
        const emailExists = await Student.findOne({ 
            email, 
            organizationId: req.user.organizationId 
        });

        if (emailExists) {
            return res.status(400).json({ success: false, message: 'Student with this email already exists in your organization' });
        }

        // Check plan limits
        const organization = await Organization.findById(req.user.organizationId).populate('planId');
        if (!organization || !organization.planId) {
            return res.status(400).json({ success: false, message: 'Organization plan not found' });
        }

        const studentCount = await Student.countDocuments({
            organizationId: req.user.organizationId
        });

        if (studentCount >= organization.planId.maxStudents) {
            return res.status(400).json({ 
                success: false, 
                message: `You have reached the maximum student limit (${organization.planId.maxStudents}) for your plan. Please upgrade to add more students.` 
            });
        }

        const student = await Student.create({
            name,
            phone,
            email,
            assignedStaff,
            organizationId: req.user.organizationId,
            points: 0, // Points are now automated via attendance only
            ...(status && { status }),
            ...(startDate && { startDate })
        });

        res.status(201).json({
            success: true,
            data: student
        });
    } catch (error) {
        console.error(error);
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'Student ID or Email already exists' });
        }
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get student profile
// @route   GET /api/students/:id
// @access  Private
const getStudentById = async (req, res) => {
    try {
        const student = await Student.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        }).populate('assignedStaff', 'name email');

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Check if staff is authorized to view this student
        if (req.user.role !== 'admin' && student.assignedStaff._id.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to access this student' });
        }

        // Fetch documents from the global Document collection for this student scoped by organization
        const globalDocs = await Document.find({ 
            studentId: req.params.id, 
            organizationId: req.user.organizationId 
        });

        // Format global documents to match the profile expectations
        const formattedGlobalDocs = globalDocs.map(d => ({
            _id: d._id,
            name: d.documentType, // Use documentType as the name
            url: d.fileUrl,
            status: d.status,
            uploadDate: new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            size: d.size || 'N/A'
        }));

        // Merge with embedded documents
        const allDocuments = [...formattedGlobalDocs, ...student.documents];

        res.status(200).json({
            id: student.studentId,
            _id: student._id,
            name: student.name,
            phone: student.phone,
            email: student.email,
            points: student.points,
            status: student.status,
            assignedStaff: student.assignedStaff ? {
                _id: student.assignedStaff._id,
                name: student.assignedStaff.name
            } : null,
            progress: `${student.points} / 250`,
            startDate: student.startDate || student.createdAt,
            notes: student.notes,
            attendance: student.attendance,
            documents: allDocuments
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private/Admin
const updateStudent = async (req, res) => {
    try {
        let student = await Student.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Authorization Check: Staff can only update their assigned students
        if (req.user.role !== 'admin' && student.assignedStaff && student.assignedStaff.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this student' });
        } else if (req.user.role !== 'admin' && !student.assignedStaff) {
            return res.status(403).json({ success: false, message: 'Not authorized to update unassigned students' });
        }

        // Only update allowed fields - removed 'points' to prevent manual override
        const { name, phone, email, assignedStaff, status, startDate } = req.body;

        if (name) student.name = name;
        if (phone) student.phone = phone;
        if (email) student.email = email;

        // Only admin can change assigned staff
        if (assignedStaff && req.user.role === 'admin') {
            student.assignedStaff = assignedStaff;
        }

        if (status) student.status = status; // Allow manual override (e.g., Dropped)
        if (startDate) student.startDate = startDate;

        await student.save(); // using save to trigger pre-save hook for status updates

        const updatedStudent = await Student.findById(req.params.id).populate('assignedStaff', 'name email');

        res.status(200).json({
            success: true,
            data: updatedStudent
        });
    } catch (error) {
        console.error('UPDATE_STUDENT_ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

// @desc    Delete student
// @route   DELETE /api/students/:id
// @access  Private/Admin
const deleteStudent = async (req, res) => {
    try {
        const student = await Student.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });

        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        await student.deleteOne();

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
    getStudents,
    createStudent,
    getStudentById,
    updateStudent,
    deleteStudent
};
