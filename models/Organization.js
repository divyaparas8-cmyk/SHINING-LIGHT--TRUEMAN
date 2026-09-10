const mongoose = require('mongoose');

const organizationSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please add an organization name'],
            unique: true,
        },
        adminUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
        planId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionPlan',
            required: true,
        },
        phoneNumber: {
            type: String,
        },
        address: {
            type: String,
        },
        startDate: {
            type: Date,
            default: Date.now,
        },
        expireDate: {
            type: Date,
        },
        planType: {
            type: String,
            enum: ['Monthly', 'Yearly'],
            default: 'Monthly',
        },
        paymentStatus: {
            type: String,
            enum: ['Paid', 'Pending', 'Partly'],
            default: 'Pending',
        },
        paymentStatus: {
            type: String,
            enum: ['Paid', 'Pending', 'Partly'],
            default: 'Pending',
        },
        status: {
            type: String,
            enum: ['Active', 'Suspended', 'Pending', 'Rejected'],
            default: 'Pending',
        },
        registrationAmount: {
            type: Number,
        },
        paymentMethod: {
            type: String,
            enum: ['Cash', 'UPI', 'Card'],
        },
        logo: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Organization', organizationSchema);
