const mongoose = require('mongoose');

const workshopSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add a workshop name'],
        },
        description: {
            type: String,
        },
        pointsReward: {
            type: Number,
            default: 1,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
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

// Compound index to ensure workshop names are unique within a single organization
workshopSchema.index({ name: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('Workshop', workshopSchema);
