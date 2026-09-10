const Student = require('../models/Student');
const Document = require('../models/Document');
const Attendance = require('../models/Attendance');
const { cloudinary } = require('../config/cloudinary');
const https = require('https');
const http = require('http');

// ─────────────────────────────────────────────────────────
// NOTES
// ─────────────────────────────────────────────────────────

// @desc    Add Note to Student
// @route   POST /api/students/:id/notes
// @access  Private
const addNote = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const { text, date } = req.body;
        if (!text || !date) return res.status(400).json({ success: false, message: 'Please provide text and date' });

        student.notes.unshift({ text, date }); // Add to beginning
        await student.save();

        res.status(201).json({ success: true, data: student.notes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete Note from Student
// @route   DELETE /api/students/:id/notes/:noteId
// @access  Private
const deleteNote = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        student.notes = student.notes.filter(note => note._id.toString() !== req.params.noteId);
        await student.save();

        res.status(200).json({ success: true, data: student.notes });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─────────────────────────────────────────────────────────
// ATTENDANCE
// ─────────────────────────────────────────────────────────

// @desc    Add Attendance to Student
// @route   POST /api/students/:id/attendance
// @access  Private
const addAttendance = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const { workshopName, pointsEarned, date } = req.body;
        if (!workshopName || pointsEarned === undefined || !date) {
            return res.status(400).json({ success: false, message: 'Please provide workshopName, pointsEarned, and date' });
        }

        student.attendance.unshift({ workshopName, pointsEarned, date });
        student.points += Number(pointsEarned); // Increment overall points
        await student.save();

        // Sync with global Attendance
        try {
            await Attendance.create({
                studentId: student._id,
                workshopId: workshopName,
                date: new Date(), // Approximate current date for backend
                pointsAwarded: Number(pointsEarned),
                createdBy: req.user._id,
                organizationId: req.user.organizationId
            });
        } catch (syncErr) {
            console.log("Global sync attendance duplicate or error ignored:", syncErr.message);
        }

        res.status(201).json({ success: true, data: student }); // Return whole student to update points on UI
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete Attendance from Student
// @route   DELETE /api/students/:id/attendance/:attId
// @access  Private/Admin
const deleteAttendance = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const attIndex = student.attendance.findIndex(att => att._id.toString() === req.params.attId);
        if (attIndex === -1) return res.status(404).json({ success: false, message: 'Attendance record not found' });

        const deletedRecord = student.attendance[attIndex];

        // Deduct points
        student.points -= deletedRecord.pointsEarned;

        // Sync delete with global Attendance
        try {
            await Attendance.findOneAndDelete({
                studentId: student._id,
                workshopId: deletedRecord.workshopName
            });
        } catch (syncErr) {
            console.log("Global sync delete ignored:", syncErr.message);
        }

        // Remove record
        student.attendance.splice(attIndex, 1);
        await student.save();

        res.status(200).json({ success: true, data: student });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// ─────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────

// @desc    Upload Document for Student
// @route   POST /api/students/:id/documents
// @access  Private
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Please upload a file' });
        }

        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        // Generate size string (Cloudinary returns bytes)
        const bytes = req.file.size;
        let sizeStr = '';
        if (bytes) {
            sizeStr = bytes < 1024 * 1024
                ? `${(bytes / 1024).toFixed(0)} KB`
                : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
        } else {
            sizeStr = 'Unknown Size';
        }

        // Create in global Document collection for central admin access
        await Document.create({
            studentId: student._id,
            documentType: req.file.originalname, // Default to filename for now
            fileUrl: req.file.path,
            publicId: req.file.filename,
            size: sizeStr,
            status: 'approved', // Profile uploads are usually pre-approved or direct
            uploadedBy: req.user._id,
            organizationId: req.user.organizationId
        });

        // Fetch documents from the global Document collection for this student scoped by organization
        const globalDocs = await Document.find({ 
            studentId: req.params.id, 
            organizationId: req.user.organizationId 
        });

        // Format global documents to match the profile expectations
        const formattedGlobalDocs = globalDocs.map(d => ({
            _id: d._id,
            name: d.documentType,
            url: d.fileUrl,
            status: d.status,
            uploadDate: d.createdAt ? new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            size: d.size || 'N/A'
        }));

        // Merge with existing embedded documents
        const allDocuments = [...formattedGlobalDocs, ...student.documents];

        res.status(201).json({ success: true, data: allDocuments });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Delete Document from Student
// @route   DELETE /api/students/:id/documents/:docId
// @access  Private/Admin
const deleteDocument = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        // Staff check: Can only delete if student is assigned to them
        if (req.user.role === 'staff' && student.assignedStaff?.toString() !== req.user._id.toString()) {
            return res.status(403).json({ success: false, message: 'Not authorized to delete this student\'s documents' });
        }

        const { docId } = req.params;
        let docToDelete = null;
        let publicId = null;

        // 1. Check embedded documents
        const embeddedDocIndex = student.documents.findIndex(d => d._id.toString() === docId);
        if (embeddedDocIndex !== -1) {
            docToDelete = student.documents[embeddedDocIndex];
            publicId = docToDelete.publicId;
            student.documents.splice(embeddedDocIndex, 1);
            await student.save();
        }

        // 2. Check global Document collection
        const globalDoc = await Document.findById(docId);
        if (globalDoc) {
            publicId = publicId || globalDoc.publicId;
            // Also delete from student.documents if it matches by URL (fallback)
            if (!docToDelete) {
                student.documents = student.documents.filter(d => d.url !== globalDoc.fileUrl);
                await student.save();
            }
            await Document.findByIdAndDelete(docId);
        }

        if (!docToDelete && !globalDoc) {
            return res.status(404).json({ success: false, message: 'Document not found' });
        }

        // 3. Delete from Cloudinary if we have a publicId
        if (publicId) {
            try {
                await cloudinary.uploader.destroy(publicId);
            } catch (cloudinaryErr) {
                console.error('Cloudinary delete error:', cloudinaryErr.message);
            }
        }

        // 4. Return the merged list (consistent with getStudentById)
        const globalDocs = await Document.find({ studentId: req.params.id });
        const formattedGlobalDocs = globalDocs.map(d => ({
            _id: d._id,
            name: d.documentType,
            url: d.fileUrl,
            status: d.status,
            uploadDate: new Date(d.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            size: d.size || 'N/A'
        }));

        const allDocuments = [...formattedGlobalDocs, ...student.documents];

        res.status(200).json({ success: true, data: allDocuments });
    } catch (error) {
        console.error('Delete Document Error:', error);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
};

// @desc    Download Document (proxy with correct filename)
// @route   GET /api/students/:id/documents/:docId/download
// @access  Private
const downloadDocument = async (req, res) => {
    try {
        const student = await Student.findOne({
            _id: req.params.id,
            organizationId: req.user.organizationId
        });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        const document = student.documents.id(req.params.docId);
        if (!document) return res.status(404).json({ success: false, message: 'Document not found' });

        // Clean filename
        let cleanFileName = (document.name || 'document').replace(/\"/g, '');
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

        streamWithRedirects(document.url);
    } catch (error) {
        console.error('Download error:', error);
        if (!res.writableEnded) {
            res.status(500).json({ success: false, message: 'Server Error' });
        }
    }
};

module.exports = {
    addNote,
    deleteNote,
    addAttendance,
    deleteAttendance,
    uploadDocument,
    deleteDocument,
    downloadDocument
};
