const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
    {
        studentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Student',
            required: true,
        },
        workshopId: {
            type: String, // Keeping as String mapped to workshopName for simplicity
            required: true,
        },
        date: {
            type: Date,
            required: true,
        },
        pointsAwarded: {
            type: Number,
            required: true,
            default: 1,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Admin
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

// Prevent duplicate attendance for same student + workshop + date
attendanceSchema.index({ studentId: 1, workshopId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);
