const mongoose = require('mongoose');

const housingDataSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
            unique: true
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        employment: {
            status: {
                type: String,
                enum: ['Working', 'Seeking', 'Not Employed', 'Training'],
                default: 'Seeking'
            },
            employer: { type: String, default: '' },
            startDate: { type: Date },
            hoursPerWeek: { type: Number, default: 0 },
            hourlyWage: { type: Number, default: 0 },
            retained: { type: Boolean, default: false },
            lastVerifiedDate: { type: Date }
        },
        savings: {
            currentAmount: { type: Number, default: 0 },
            priorAmount: { type: Number, default: 0 },
            monthlyChange: { type: Number, default: 0 },
            lastVerifiedDate: { type: Date },
            notes: { type: String, default: '' }
        },
        incidents: [
            {
                date: { type: Date, default: Date.now },
                type: { type: String, default: 'Conflict' },
                severity: {
                    type: String,
                    enum: ['Low', 'Medium', 'High', 'Critical'],
                    default: 'Low'
                },
                status: {
                    type: String,
                    enum: ['Open', 'Pending', 'Resolved'],
                    default: 'Resolved'
                },
                resolutionDate: { type: Date },
                description: { type: String, default: '' }
            }
        ],
        transition: {
            readinessStatus: {
                type: String,
                enum: ['Not yet', 'Building readiness', 'Review soon', 'Ready to transition', 'Transitioned'],
                default: 'Not yet'
            },
            reviewDate: { type: Date },
            transitionDate: { type: Date },
            destination: { type: String, default: '' },
            notes: { type: String, default: '' }
        },
        // 5. Monthly 7-Question Evaluations tied to this individual student
        monthlyEvaluations: [
            {
                month: { type: String, required: true }, // e.g. "2026-09"
                siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProgramSite' },
                responses: [
                    {
                        questionId: { type: Number, required: true },
                        questionText: { type: String, required: true },
                        answer: {
                            type: String,
                            enum: ['Yes', 'No', 'N/A'],
                            default: 'Yes'
                        },
                        comment: { type: String, default: '' }
                    }
                ],
                yesCount: { type: Number, default: 0 },
                applicableCount: { type: Number, default: 7 },
                score: { type: Number, default: 0 }, // e.g. 5
                scorePercentage: { type: Number, default: 0 }, // e.g. 71%
                statusColor: {
                    type: String,
                    enum: ['Green', 'Yellow', 'Red'],
                    default: 'Green'
                },
                evaluatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
                evaluatedAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
);

module.exports = mongoose.model('HousingData', housingDataSchema);
