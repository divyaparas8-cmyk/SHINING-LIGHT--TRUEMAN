const mongoose = require('mongoose');

const programSiteSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add site name'],
            trim: true
        },
        code: {
            type: String,
            required: true,
            uppercase: true,
            trim: true
        },
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true
        },
        capacity: {
            type: Number,
            default: 6
        },
        units: [
            {
                unitName: { type: String, default: 'Unit 1' },
                bedroom: { type: String },
                bed: { type: String, required: true },
                isActive: { type: Boolean, default: true }
            }
        ],
        status: {
            type: String,
            enum: ['Active', 'Inactive'],
            default: 'Active'
        },
        startDate: {
            type: Date,
            default: Date.now
        },
        endDate: {
            type: Date
        }
    },
    { timestamps: true }
);

programSiteSchema.index({ code: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('ProgramSite', programSiteSchema);
