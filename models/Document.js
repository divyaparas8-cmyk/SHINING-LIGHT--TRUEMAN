const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
        },
        fileUrl: {
            type: String, // URL from Cloudinary
            required: true,
        },
        documentType: {
            type: String, // e.g. "Housing Verification"
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending',
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        publicId: {
            type: String, // Cloudinary public_id
        },
        size: {
            type: String, // Formatted size string
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Document', documentSchema);
