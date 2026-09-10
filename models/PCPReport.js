const mongoose = require('mongoose');

const pcpReportSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
        },
        dateOfService: {
            type: Date,
            required: true,
        },
        serviceDescription: {
            type: String,
            required: true,
        },
        faceToFaceIndicator: {
            type: String, // e.g., 'Face-to-Face', 'Virtual', etc.
            required: true,
        },
        purpose: {
            type: String,
            required: true,
        },
        intervention: {
            type: String,
            required: true,
        },
        effectiveness: {
            type: String,
            required: true,
        },
        staffNotes: {
            type: String,
        },
        staffSignature: {
            type: String,
            required: true,
        },
        assessmentFile: {
            type: String, // URL from Cloudinary (or local path if configured that way)
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        status: {
            type: String,
            enum: ['draft', 'completed'],
            default: 'draft',
        }
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('PCPReport', pcpReportSchema);
