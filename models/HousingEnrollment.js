const mongoose = require('mongoose');

const housingEnrollmentSchema = new mongoose.Schema(
    {
        // Connection to master Student record
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true
        },
        siteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ProgramSite',
            required: true
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        unit: {
            type: String,
            default: 'Unit 1'
        },
        bed: {
            type: String,
            required: [true, 'Please assign a bed (e.g. B1-A)'],
            trim: true
        },
        entryDate: {
            type: Date,
            default: Date.now
        },
        status: {
            type: String,
            enum: ['Enrolled', 'Active', 'Completed', 'Exited'],
            default: 'Active'
        },
        exitDate: {
            type: Date
        },
        exitReason: {
            type: String
        }
    },
    { timestamps: true }
);

// One student can only have one Active/Enrolled status at a site at a time per organization
housingEnrollmentSchema.index(
    { studentId: 1, siteId: 1 }, 
    { 
        unique: true, 
        partialFilterExpression: { status: { $in: ['Active', 'Enrolled'] } }
    }
);

module.exports = mongoose.model('HousingEnrollment', housingEnrollmentSchema);
