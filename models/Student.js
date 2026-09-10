const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema(
    {
        studentId: {
            type: String,
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Please add a name'],
        },
        phone: {
            type: String,
            required: [true, 'Please add a phone number'],
        },
        email: {
            type: String,
            required: [true, 'Please add an email'],
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please add a valid email',
            ],
        },
        startDate: {
            type: Date,
            required: [true, 'Please add a start date'],
            default: Date.now,
        },
        points: {
            type: Number,
            default: 0,
        },
        totalPoints: {
            type: Number,
            default: 250,
        },
        status: {
            type: String,
            enum: ['Active', 'Completed', 'Secondary Completion', 'Dropped'],
            default: 'Active',
        },
        assignedStaff: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        notes: [
            {
                text: { type: String, required: true },
                date: { type: String, required: true },
            }
        ],
        attendance: [
            {
                workshopName: { type: String, required: true },
                pointsEarned: { type: Number, required: true },
                date: { type: String, required: true },
            }
        ],
        documents: [
            {
                name: { type: String, required: true },
                url: { type: String, required: true },
                size: { type: String },
                uploadDate: { type: String, required: true },
                publicId: { type: String } // Needed to delete from Cloudinary later
            }
        ],
        pcpReports: [
            {
                dateOfService: { type: String, required: true },
                serviceDescription: { type: String },
                faceToFace: { type: String, default: 'Face-to-Face' },
                purpose: { type: String },
                intervention: { type: String },
                effectiveness: { type: String },
                staffNotes: { type: String },
                staffSignature: { type: String, required: true },
                status: { type: String, enum: ['Draft', 'Completed'], default: 'Completed' },
                createdAt: { type: Date, default: Date.now }
            }
        ],
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

// Pre-save hook to generate Student ID
studentSchema.pre('validate', async function () {
    if (this.isNew && !this.studentId) {
        // Find highest existing Student ID within the organization
        const lastStudent = await this.constructor.findOne({ organizationId: this.organizationId }, {}, { sort: { 'createdAt': -1 } });

        let newIdValue = 1; // Starting ID
        if (lastStudent && lastStudent.studentId) {
            // Extract the numerical part if it exists
            const match = lastStudent.studentId.match(/\d+$/);
            if (match) {
                newIdValue = parseInt(match[0], 10) + 1;
            }
        }
        this.studentId = `STU-${newIdValue.toString().padStart(3, '0')}`;
    }
});

// Pre-save hook to update status based on points
studentSchema.pre('save', async function () {
    try {
        const threshold = this.totalPoints || 250;

        // 1. If status is being manually changed to any completion or dropped status, respect it
        if (this.isModified('status')) {
            if (['Completed', 'Secondary Completion', 'Dropped'].includes(this.status)) {
                return;
            }
        }

        // 2. Auto-complete if points threshold is reached (upgrades to Primary Completion)
        if (this.points >= threshold) {
            if (this.status !== 'Dropped') {
                this.status = 'Completed';
            }
        } 
        // 3. Otherwise, if points are below threshold, respect manual overrides
        else if (this.status !== 'Completed' && this.status !== 'Secondary Completion' && this.status !== 'Dropped') {
            this.status = 'Active';
        }
    } catch (err) {
        console.error('STUDENT_PRE_SAVE_ERR:', err);
        throw err;
    }
});

// Compound indices to ensure uniqueness within a single organization
studentSchema.index({ studentId: 1, organizationId: 1 }, { unique: true });
studentSchema.index({ email: 1, organizationId: 1 }, { unique: true });

module.exports = mongoose.model('Student', studentSchema);
