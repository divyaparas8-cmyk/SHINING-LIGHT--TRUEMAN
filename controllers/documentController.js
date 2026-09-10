const Document = require('../models/Document');
const Student = require('../models/Student');
const Setting = require('../models/Setting');
const imagekit = require('../config/imagekit');
const https = require('https');
const http = require('http');

// Helper to evaluate completion rules based on CRM specs
const evaluateStudentCompletion = async (studentId) => {
    try {
        const student = await Student.findById(studentId);
        if (!student) return;

        // Fetch current system settings scoped by organization
        let settings = await Setting.findOne({ organizationId: student.organizationId });
        if (!settings) {
            settings = await Setting.create({ organizationId: student.organizationId });
        }
        const threshold = settings.completionPointsThreshold;

        // Check if housing document exists scoped by organization
        const hasAnyHousingDoc = await Document.exists({
            studentId,
            documentType: 'Housing Verification',
            organizationId: student.organizationId
        });

        if (hasAnyHousingDoc) {
            if (student.points >= threshold) {
                student.status = 'Completed';
            } else {
                student.status = 'Secondary Completion';
            }
            await student.save();
        }
    } catch (err) {
        console.error("Error evaluating completion logic: ", err);
    }
};

// @desc    Upload new document
// @route   POST /api/documents
// @access  Private
const uploadDocument = async (req, res) => {
    try {
        const { studentId, status, documentType } = req.body;

        if (!studentId || !documentType) {
            return res.status(400).json({ success: false, message: 'Student ID and Document Type are required' });
        }

        let fileUrl = '';
        if (req.file) {
            try {
                const uploadResponse = await imagekit.upload({
                    file: req.file.buffer,
                    fileName: req.file.originalname,
                    folder: '/documents'
                });
                fileUrl = uploadResponse.url;
            } catch (err) {
                console.error('ImageKit Upload Error:', err);
                return res.status(500).json({ success: false, message: 'File upload failed' });
            }
        }

        const document = await Document.create({
            studentId,
            documentType,
            status: status || 'pending',
            fileUrl: fileUrl,
            uploadedBy: req.user._id,
            organizationId: req.user.organizationId
        });

        // Trigger business background task automatically
        await evaluateStudentCompletion(studentId);

        res.status(201).json({ success: true, data: document });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Get all documents
// @route   GET /api/documents
// @access  Private
const getDocuments = async (req, res) => {
    try {
        const filter = { organizationId: req.user.organizationId };
        if (req.query.studentId) filter.studentId = req.query.studentId;

        // Staff filter
        if (req.user.role === 'staff') {
            const students = await Student.find({
                assignedStaff: req.user._id,
                organizationId: req.user.organizationId
            }).select('_id');
            const studentIds = students.map(s => s._id);

            if (filter.studentId) {
                // If a specific student is requested, ensure it's one of their assigned students
                if (!studentIds.some(id => id.toString() === filter.studentId.toString())) {
                    return res.status(403).json({ success: false, message: 'Not authorized to view this student\'s documents' });
                }
            } else {
                filter.studentId = { $in: studentIds };
            }
        }

        const documents = await Document.find(filter)
            .populate('studentId', 'name studentId status points')
            .populate('uploadedBy', 'name role')
            .sort('-createdAt');

        res.status(200).json({ success: true, data: documents });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const document = await Document.findById(req.params.id);

        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        // Staff check: Can only delete if student is assigned to them
        // Staff check: Can only delete if student is assigned to them within their organization
        if (req.user.role === 'staff') {
            const student = await Student.findOne({
                _id: document.studentId,
                organizationId: req.user.organizationId
            });
            if (!student || student.assignedStaff?.toString() !== req.user._id.toString()) {
                return res.status(403).json({ success: false, message: 'Not authorized to delete this student\'s documents' });
            }
        }

        // Optional: Delete from Cloudinary if needed, but for now just from DB
        await document.deleteOne();

        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Update existing document
// @route   PUT /api/documents/:id
// @access  Private/Admin
const updateDocument = async (req, res) => {
    try {
        const document = await Document.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        if (!document) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        const { documentType, status } = req.body;

        // Update document type if provided
        if (documentType) {
            document.documentType = documentType;
        }

        // Update status if provided
        if (status) {
            document.status = status;
        }

        // If new file is uploaded, update the file URL
        if (req.file) {
            try {
                const uploadResponse = await imagekit.upload({
                    file: req.file.buffer,
                    fileName: req.file.originalname,
                    folder: '/documents'
                });
                document.fileUrl = uploadResponse.url;
            } catch (err) {
                console.error('ImageKit Upload Error:', err);
                return res.status(500).json({ success: false, message: 'File upload failed' });
            }
        }

        await document.save();

        // Trigger business logic to evaluate student completion
        await evaluateStudentCompletion(document.studentId);

        res.status(200).json({ success: true, data: document });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

const downloadDocument = async (req, res) => {
    try {
        const document = await Document.findOne({ 
            _id: req.params.id, 
            organizationId: req.user.organizationId 
        });
        if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

        // Clean filename
        let cleanFileName = (document.documentType || 'document').replace(/\"/g, '');
        if (!cleanFileName.toLowerCase().endsWith('.pdf')) {
            cleanFileName = `${cleanFileName}.pdf`;
        }

        res.setHeader('Content-Disposition', `attachment; filename="${cleanFileName}"`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

        // Function to stream with redirect following
        const streamWithRedirects = (url) => {
            const protocol = url.startsWith('https') ? https : http;
            protocol.get(url, (fileStream) => {
                // Handle redirects
                if (fileStream.statusCode >= 300 && fileStream.statusCode < 400 && fileStream.headers.location) {
                    return streamWithRedirects(fileStream.headers.location);
                }

                if (fileStream.statusCode !== 200) {
                    return res.status(fileStream.statusCode || 500).end();
                }

                // Forward content type if available
                const contentType = fileStream.headers['content-type'];
                if (contentType) {
                    res.setHeader('Content-Type', contentType);
                } else {
                    res.setHeader('Content-Type', 'application/octet-stream');
                }

                fileStream.pipe(res);
            }).on('error', (err) => {
                console.error('Request error:', err);
                if (!res.writableEnded) res.status(500).end();
            });
        };

        streamWithRedirects(document.fileUrl);
    } catch (error) {
        console.error('Download error:', error);
        if (!res.writableEnded) {
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    }
};

module.exports = {
    uploadDocument,
    getDocuments,
    evaluateStudentCompletion,
    deleteDocument,
    downloadDocument,
    updateDocument
};
