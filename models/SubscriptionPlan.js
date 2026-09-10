const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema(
    {
        planName: {
            type: String,
            required: [true, 'Please add a plan name'],
            unique: true,
        },
        price: {
            type: Number,
            required: [true, 'Please add a price'],
        },
        billingPeriod: {
            type: String,
            enum: ['Monthly', 'Yearly'],
            default: 'Monthly',
        },
        maxStaff: {
            type: Number,
            required: [true, 'Please add a max staff limit'],
        },
        maxStudents: {
            type: Number,
            required: [true, 'Please add a max students limit'],
        },
        isPopular: {
            type: Boolean,
            default: false,
        },
        features: {
            type: [String],
            default: [],
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
