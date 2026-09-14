const mongoose = require('mongoose');

const monthlySnapshotSchema = new mongoose.Schema(
    {
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
        month: {
            type: String,
            required: true // e.g. "2026-09"
        },
        metricResponses: [
            {
                questionId: { type: Number, required: true },
                questionText: { type: String, required: true },
                answer: {
                    type: String,
                    enum: ['Yes', 'No', 'N/A'],
                    required: true
                },
                comment: { type: String, default: '' }
            }
        ],
        score: {
            type: Number,
            required: true,
            min: 0,
            max: 100
        },
        statusColor: {
            type: String,
            enum: ['Green', 'Yellow', 'Red'],
            required: true
        },
        narrative: {
            wins: { type: String, default: '' },
            concerns: { type: String, default: '' },
            nextActions: { type: String, default: '' }
        },
        isFinalized: {
            type: Boolean,
            default: false
        },
        finalizedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        finalizedAt: {
            type: Date
        },
        participantSnapshots: [
            {
                studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
                enrollmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'HousingEnrollment' },
                name: String,
                studentCode: String,
                unit: String,
                bed: String,
                employmentStatus: String,
                savingsChange: Number,
                currentSavings: Number,
                ridssPoints: Number,
                ridssStatus: String,
                incidentsSummary: String,
                openIncidentsCount: Number,
                transitionStatus: String,
                // Individual 7-metric evaluation snapshot
                individualScore: { type: Number, default: 0 },
                applicableCount: { type: Number, default: 7 },
                scorePercentage: { type: Number, default: 0 },
                statusColor: { type: String, default: 'Green' },
                responses: [
                    {
                        questionId: Number,
                        questionText: String,
                        answer: String,
                        comment: String
                    }
                ]
            }
        ]
    },
    { timestamps: true }
);

monthlySnapshotSchema.index({ siteId: 1, month: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('MonthlySnapshot', monthlySnapshotSchema);
