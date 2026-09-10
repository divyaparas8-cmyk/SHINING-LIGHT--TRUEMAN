const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
    programName: {
        type: String,
        default: 'RIDSS Program'
    },
    completionPointsThreshold: {
        type: Number,
        default: 250
    },
    allowedDocumentTypes: {
        type: [String],
        default: ['PDF', 'DOC', 'DOCX', 'JPG', 'PNG']
    },
    maxFileSizeMB: {
        type: Number,
        default: 10
    },
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Setting', settingSchema);
