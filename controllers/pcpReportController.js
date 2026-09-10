const PCPReport = require('../models/PCPReport');
const imagekit = require('../config/imagekit');

// @desc    Create a PCP/IGP Report
// @route   POST /api/pcp-reports
// @access  Private (Admin + Staff)
const createReport = async (req, res) => {
    try {
        console.log('--- New PCP Report Submission ---');
        
        // Pick specific fields and handle potential array values from double-append
        const getField = (name) => {
            const val = req.body[name];
            return Array.isArray(val) ? val[0] : val;
        };

        const studentId = getField('studentId');
        const dateOfService = getField('dateOfService');
        const staffSignature = getField('staffSignature');
        const status = getField('status');

        if (!studentId || !dateOfService || !staffSignature) {
            return res.status(400).json({ success: false, message: 'Student, date of service, and staff signature are required.' });
        }

        // Organization and Role Check: Ensure student belongs to org and (if staff) is assigned
        const Student = require('../models/Student');
        const studentFilter = { _id: studentId, organizationId: req.user.organizationId };
        if (req.user.role === 'staff') {
            studentFilter.assignedStaff = req.user._id;
        }

        const student = await Student.findOne(studentFilter);
        if (!student) {
            return res.status(403).json({ success: false, message: 'Not authorized to create report for this student' });
        }

        let assessmentFile = undefined;
        if (req.file) {
            try {
                const uploadResponse = await imagekit.upload({
                    file: req.file.buffer, // required
                    fileName: req.file.originalname, // required
                    folder: '/assessments'
                });
                assessmentFile = uploadResponse.url;
            } catch (err) {
                console.error('ImageKit Upload Error:', err);
                return res.status(500).json({ success: false, message: 'File upload failed' });
            }
        }

        // Ensure status matches model enum ['draft', 'completed']
        let finalStatus = 'draft';
        if (status) {
            finalStatus = status.toLowerCase() === 'draft' ? 'draft' : 'completed';
        }

        const report = await PCPReport.create({
            studentId,
            dateOfService,
            serviceDescription: getField('serviceDescription') || 'Standard Service',
            faceToFaceIndicator: getField('faceToFaceIndicator') || getField('faceToFace') || 'Face-to-Face',
            purpose: getField('purpose') || 'Standard Purpose',
            intervention: getField('intervention') || 'Standard Intervention',
            effectiveness: getField('effectiveness') || 'Standard Effectiveness',
            staffNotes: getField('staffNotes') || '',
            staffSignature,
            assessmentFile,
            status: finalStatus,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: report });
    } catch (error) {
        console.error('PCP REPORT CREATION ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

// @desc    Get all PCP Reports
// @route   GET /api/pcp-reports
// @access  Private
const getReports = async (req, res) => {
    try {
        const Student = require('../models/Student');
        
        // Base filter: All students in the user's organization
        // (SuperAdmins are excluded from this specific logic as they have their own dashboard/stats)
        const orgStudents = await Student.find({ organizationId: req.user.organizationId }).select('_id');
        const orgStudentIds = orgStudents.map(s => s._id.toString());

        const filter = {};

        if (req.user.role === 'staff') {
            // Staff: only students assigned to them within their organization
            const assignedStudents = await Student.find({ 
                assignedStaff: req.user._id,
                organizationId: req.user.organizationId 
            }).select('_id');
            const assignedStudentIds = assignedStudents.map(s => s._id.toString());
            
            if (req.query.studentId) {
                if (!assignedStudentIds.includes(req.query.studentId.toString())) {
                    return res.status(403).json({ success: false, message: 'Not authorized to view this student\'s reports' });
                }
                filter.studentId = req.query.studentId;
            } else {
                filter.studentId = { $in: assignedStudents.map(s => s._id) };
            }
        } else if (req.user.role === 'admin') {
            // Admin: any student in their organization
            if (req.query.studentId) {
                if (!orgStudentIds.includes(req.query.studentId.toString())) {
                    return res.status(403).json({ success: false, message: 'Not authorized to view this student\'s reports' });
                }
                filter.studentId = req.query.studentId;
            } else {
                filter.studentId = { $in: orgStudents.map(s => s._id) };
            }
        }

        const reports = await PCPReport.find(filter)
            .populate('studentId', 'name studentId status')
            .populate('createdBy', 'name role')
            .sort('-dateOfService');

        res.status(200).json({ success: true, data: reports });
    } catch (error) {
        console.error('GET REPORTS ERROR:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get single PCP Report
// @route   GET /api/pcp-reports/:id
// @access  Private
const getReportById = async (req, res) => {
    try {
        const Student = require('../models/Student');
        const report = await PCPReport.findById(req.params.id)
            .populate('studentId', 'name studentId status points organizationId')
            .populate('createdBy', 'name role');

        if (!report) {
            return res.status(404).json({ success: false, message: 'Report not found' });
        }

        // Organization Check
        if (report.studentId?.organizationId?.toString() !== req.user.organizationId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to access this report' });
        }

        res.status(200).json({ success: true, data: report });
    } catch (error) {
        console.error('GET REPORT BY ID ERROR:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update PCP Report
// @route   PUT /api/pcp-reports/:id
// @access  Private (Admin + Staff)
const updateReport = async (req, res) => {
    try {
        let report = await PCPReport.findById(req.params.id).populate('studentId');
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

        // Organization and Ownership Check
        if (report.studentId?.organizationId?.toString() !== req.user.organizationId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update this report' });
        }

        if (req.user.role === 'staff' && report.studentId?.assignedStaff?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to update reports for this student' });
        }

        // Sanitizing input: only allow these fields to be updated via this route
        const allowedFields = [
            'dateOfService', 'serviceDescription', 'faceToFaceIndicator', 'faceToFace',
            'purpose', 'intervention', 'effectiveness', 'staffNotes', 'staffSignature', 'status'
        ];
        
        const updateData = {};
        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                // If it's an array (from double append), take the first value
                updateData[field] = Array.isArray(req.body[field]) ? req.body[field][0] : req.body[field];
            }
        });

        // Ensure status matches model enum ['draft', 'completed']
        if (updateData.status) {
            updateData.status = updateData.status.toLowerCase() === 'draft' ? 'draft' : 'completed';
        }

        // If a new file is uploaded, update the assessmentFile URL
        if (req.file) {
            try {
                const uploadResponse = await imagekit.upload({
                    file: req.file.buffer,
                    fileName: req.file.originalname,
                    folder: '/assessments'
                });
                updateData.assessmentFile = uploadResponse.url;
            } catch (err) {
                console.error('ImageKit Upload Error:', err);
                return res.status(500).json({ success: false, message: 'File upload failed' });
            }
        }

        report = await PCPReport.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true
        });

        res.status(200).json({ success: true, data: report });
    } catch (error) {
        console.error('PCP REPORT UPDATE ERROR:', error);
        res.status(500).json({ success: false, message: error.message || 'Server Error' });
    }
};

// @desc    Delete PCP Report
// @route   DELETE /api/pcp-reports/:id
// @access  Private (Admin only)
const deleteReport = async (req, res) => {
    try {
        const report = await PCPReport.findById(req.params.id).populate('studentId');
        if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

        // Organization Check
        if (report.studentId?.organizationId?.toString() !== req.user.organizationId.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this report' });
        }

        await report.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

module.exports = {
    createReport,
    getReports,
    getReportById,
    updateReport,
    deleteReport
};
