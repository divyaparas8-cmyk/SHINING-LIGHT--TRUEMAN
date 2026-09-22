const ProgramSite = require('../models/ProgramSite');
const HousingEnrollment = require('../models/HousingEnrollment');
const HousingData = require('../models/HousingData');
const MonthlySnapshot = require('../models/MonthlySnapshot');
const Student = require('../models/Student');
const User = require('../models/User');

// Helper to calculate score excluding N/A
const calculateScore = (metricResponses) => {
    let yesCount = 0;
    let applicableCount = 0;

    metricResponses.forEach((m) => {
        if (m.answer === 'Yes') {
            yesCount += 1;
            applicableCount += 1;
        } else if (m.answer === 'No') {
            applicableCount += 1;
        }
        // N/A is excluded from applicableCount
    });

    const score = applicableCount > 0 ? Math.round((yesCount / applicableCount) * 100) : 100;
    let statusColor = 'Green';
    if (score < 70) {
        statusColor = 'Red';
    } else if (score < 85) {
        statusColor = 'Yellow';
    }

    return { score, statusColor, yesCount, applicableCount };
};

// ==========================================
// 1. SITES / PILOTS
// ==========================================

// @desc    Get all housing sites for user's organization
// @route   GET /api/housing/sites
// @access  Private
exports.getSites = async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        let sites = await ProgramSite.find({ organizationId });

        // Auto-seed Parker Heights if no sites exist yet
        if (sites.length === 0) {
            const defaultSite = await ProgramSite.create({
                name: 'Parker Heights RIDSS Housing Stabilization Pilot',
                code: 'PARKER_HEIGHTS',
                organizationId,
                capacity: 6,
                units: [
                    { unitName: 'Unit 1', bedroom: '1', bed: 'B1-A', isActive: true },
                    { unitName: 'Unit 1', bedroom: '1', bed: 'B1-B', isActive: true },
                    { unitName: 'Unit 1', bedroom: '2', bed: 'B2-A', isActive: true },
                    { unitName: 'Unit 1', bedroom: '2', bed: 'B2-B', isActive: true },
                    { unitName: 'Unit 1', bedroom: '3', bed: 'B3-A', isActive: true },
                    { unitName: 'Unit 1', bedroom: '3', bed: 'B3-B', isActive: true }
                ],
                status: 'Active'
            });
            sites = [defaultSite];
        }

        res.status(200).json({ success: true, data: sites });
    } catch (error) {
        console.error('getSites error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create a new Housing Property / Program Site
// @route   POST /api/housing/sites
// @access  Private (Admin / Super Admin)
exports.createSite = async (req, res) => {
    try {
        const { name, code, capacity, unitName, beds, units } = req.body;
        const organizationId = req.user.organizationId;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Please provide property name' });
        }

        const baseCode = (code || name).toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 15);
        const uniqueSuffix = Math.floor(1000 + Math.random() * 9000);
        const finalCode = `${baseCode}_${uniqueSuffix}`;

        // Auto-generate units & beds if custom list not passed
        let unitsList = [];
        if (Array.isArray(units) && units.length > 0) {
            unitsList = units.map(u => ({
                unitName: (u.unitName || 'Unit 1').trim(),
                bedroom: u.bedroom || '',
                bed: (u.bed || '').trim(),
                isActive: u.isActive !== false
            }));
        } else if (Array.isArray(beds) && beds.length > 0) {
            unitsList = beds.map(b => ({
                unitName: unitName || 'Unit 1',
                bed: b.trim(),
                isActive: true
            }));
        } else if (req.body.bedroomsCount) {
            const bedrooms = Math.max(1, Number(req.body.bedroomsCount) || 1);
            const perBedroom = Math.max(1, Number(req.body.bedsPerBedroom) || 2);
            const targetUnit = unitName || 'Unit 1';
            for (let b = 1; b <= bedrooms; b++) {
                for (let i = 0; i < perBedroom; i++) {
                    const letter = String.fromCharCode(65 + i); // 'A', 'B', 'C'
                    unitsList.push({
                        unitName: targetUnit,
                        bedroom: String(b),
                        bed: `B${b}-${letter}`,
                        isActive: true
                    });
                }
            }
        } else {
            const bedCount = Number(capacity) || 2;
            for (let i = 1; i <= Math.ceil(bedCount / 2); i++) {
                unitsList.push({ unitName: unitName || 'Unit 1', bedroom: String(i), bed: `B${i}-A`, isActive: true });
                if (unitsList.length < bedCount) {
                    unitsList.push({ unitName: unitName || 'Unit 1', bedroom: String(i), bed: `B${i}-B`, isActive: true });
                }
            }
        }

        const bedCount = unitsList.length || Number(capacity) || 2;

        const newSite = await ProgramSite.create({
            name: name.trim(),
            code: finalCode,
            organizationId,
            capacity: bedCount,
            units: unitsList,
            status: 'Active'
        });

        res.status(201).json({
            success: true,
            message: 'New property created successfully',
            data: newSite
        });
    } catch (error) {
        console.error('createSite error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update an existing Housing Property / Program Site
// @route   PUT /api/housing/sites/:id
// @access  Private (Admin / Super Admin)
exports.updateSite = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, capacity, unitName, beds, units, status } = req.body;
        const organizationId = req.user.organizationId;

        const site = await ProgramSite.findOne({ _id: id, organizationId });
        if (!site) {
            return res.status(404).json({ success: false, message: 'Property not found' });
        }

        if (name && name.trim()) site.name = name.trim();
        if (status) site.status = status;

        if (Array.isArray(units) && units.length > 0) {
            site.units = units.map(u => ({
                unitName: (u.unitName || 'Unit 1').trim(),
                bedroom: u.bedroom || '',
                bed: (u.bed || '').trim(),
                isActive: u.isActive !== false
            }));
            site.capacity = site.units.length;
        } else if (capacity) {
            const bedCount = Number(capacity);
            site.capacity = bedCount;

            const defaultUnitName = unitName || site.units[0]?.unitName || 'Unit 1';
            if (Array.isArray(beds) && beds.length > 0) {
                site.units = beds.map(b => ({
                    unitName: defaultUnitName,
                    bed: b.trim(),
                    isActive: true
                }));
            } else {
                let newUnits = [];
                for (let i = 1; i <= Math.ceil(bedCount / 2); i++) {
                    newUnits.push({ unitName: defaultUnitName, bedroom: String(i), bed: `B${i}-A`, isActive: true });
                    if (newUnits.length < bedCount) {
                        newUnits.push({ unitName: defaultUnitName, bedroom: String(i), bed: `B${i}-B`, isActive: true });
                    }
                }
                site.units = newUnits;
            }
        } else if (unitName) {
            site.units.forEach(u => {
                u.unitName = unitName;
            });
        }

        await site.save();

        res.status(200).json({
            success: true,
            message: 'Property updated successfully',
            data: site
        });
    } catch (error) {
        console.error('updateSite error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete a Housing Property / Program Site
// @route   DELETE /api/housing/sites/:id
// @access  Private (Admin / Super Admin)
exports.deleteSite = async (req, res) => {
    try {
        const { id } = req.params;
        const organizationId = req.user.organizationId;

        const activeEnrollments = await HousingEnrollment.countDocuments({
            siteId: id,
            organizationId,
            status: { $in: ['Active', 'Enrolled'] }
        });

        if (activeEnrollments > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete property: ${activeEnrollments} student(s) currently placed in this property!`
            });
        }

        await ProgramSite.findOneAndDelete({ _id: id, organizationId });

        res.status(200).json({
            success: true,
            message: 'Property deleted successfully'
        });
    } catch (error) {
        console.error('deleteSite error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// 2. ENROLLMENTS & PLACEMENTS
// ==========================================

// @desc    Get all enrolled students for a site
// @route   GET /api/housing/enrollments/:siteId
// @access  Private
exports.getEnrollments = async (req, res) => {
    try {
        const { siteId } = req.params;
        const organizationId = req.user.organizationId;

        const enrollments = await HousingEnrollment.find({ siteId, organizationId })
            .populate({
                path: 'studentId',
                select: 'name studentId phone email points totalPoints status attendance assignedStaff'
            })
            .sort({ bed: 1 });

        res.status(200).json({ success: true, data: enrollments });
    } catch (error) {
        console.error('getEnrollments error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Enroll a student into a site bed
// @route   POST /api/housing/enroll
// @access  Private (Admin / Staff)
exports.enrollStudent = async (req, res) => {
    try {
        const { studentId, siteId, unit, bed, entryDate } = req.body;
        const organizationId = req.user.organizationId;

        if (!studentId || !siteId || !bed) {
            return res.status(400).json({
                success: false,
                message: 'Please provide studentId, siteId, and bed'
            });
        }

        // 1. Verify student exists in master record and belongs to user's org
        const student = await Student.findOne({ _id: studentId, organizationId });
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found in master records' });
        }

        // 2. Check if student is already enrolled in this site
        const existingStudentEnrollment = await HousingEnrollment.findOne({
            studentId,
            siteId,
            status: { $in: ['Active', 'Enrolled'] }
        });
        if (existingStudentEnrollment) {
            return res.status(400).json({
                success: false,
                message: 'This student is already actively enrolled in this site'
            });
        }

        // 3. Check if bed in this specific unit is already occupied
        const targetUnit = unit || 'Unit 1';
        const bedOccupied = await HousingEnrollment.findOne({
            siteId,
            unit: targetUnit,
            bed,
            status: { $in: ['Active', 'Enrolled'] }
        });
        if (bedOccupied) {
            return res.status(400).json({
                success: false,
                message: `Bed ${bed} in ${targetUnit} is already occupied. Please select another bed.`
            });
        }

        // 4. Create or Re-activate Enrollment
        let enrollment = await HousingEnrollment.findOne({ studentId, siteId });
        if (enrollment) {
            enrollment.organizationId = organizationId;
            enrollment.unit = targetUnit;
            enrollment.bed = bed;
            enrollment.entryDate = entryDate || new Date();
            enrollment.status = 'Active';
            enrollment.exitDate = null;
            enrollment.exitReason = null;
            await enrollment.save();
        } else {
            enrollment = await HousingEnrollment.create({
                studentId,
                siteId,
                organizationId,
                unit: targetUnit,
                bed,
                entryDate: entryDate || new Date(),
                status: 'Active'
            });
        }

        // 5. Ensure initial HousingData record exists for routine tracking
        let housingData = await HousingData.findOne({ studentId });
        if (!housingData) {
            housingData = await HousingData.create({
                studentId,
                organizationId,
                employment: { status: 'Seeking' },
                savings: { currentAmount: 0, priorAmount: 0, monthlyChange: 0 },
                incidents: [],
                transition: { readinessStatus: 'Not yet' }
            });
        }

        res.status(201).json({
            success: true,
            message: 'Student enrolled successfully in Housing Pilot',
            data: enrollment
        });
    } catch (error) {
        console.error('enrollStudent error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update enrollment (Change bed or Exit/Discharge)
// @route   PUT /api/housing/enroll/:id
// @access  Private (Admin / Staff)
exports.updateEnrollment = async (req, res) => {
    try {
        const { id } = req.params;
        const { unit, bed, status, exitDate, exitReason } = req.body;
        const organizationId = req.user.organizationId;

        const enrollment = await HousingEnrollment.findOne({ _id: id, organizationId });
        if (!enrollment) {
            return res.status(404).json({ success: false, message: 'Enrollment record not found' });
        }

        // If changing bed, check if new bed is occupied
        if (bed && bed !== enrollment.bed && (!status || status === 'Active' || status === 'Enrolled')) {
            const bedOccupied = await HousingEnrollment.findOne({
                siteId: enrollment.siteId,
                bed,
                _id: { $ne: id },
                status: { $in: ['Active', 'Enrolled'] }
            });
            if (bedOccupied) {
                return res.status(400).json({
                    success: false,
                    message: `Bed ${bed} is already occupied.`
                });
            }
            enrollment.bed = bed;
        }

        if (unit) enrollment.unit = unit;
        if (status) enrollment.status = status;
        if (exitDate) enrollment.exitDate = exitDate;
        if (exitReason) enrollment.exitReason = exitReason;

        await enrollment.save();

        res.status(200).json({
            success: true,
            message: 'Enrollment updated successfully',
            data: enrollment
        });
    } catch (error) {
        console.error('updateEnrollment error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Reassign Bed (Move to a new bed without losing history)
// @route   POST /api/housing/reassign
// @access  Private (Admin / Staff)
exports.reassignBed = async (req, res) => {
    try {
        const { currentEnrollmentId, studentId, siteId, unit, bed, reassignDate } = req.body;
        const organizationId = req.user.organizationId;

        if (!studentId || !siteId || !bed) {
            return res.status(400).json({
                success: false,
                message: 'Please provide studentId, siteId, and bed'
            });
        }

        // 1. Check if the NEW bed is already occupied by someone else
        const targetUnit = unit || 'Unit 1';
        const bedOccupied = await HousingEnrollment.findOne({
            siteId,
            unit: targetUnit,
            bed,
            status: { $in: ['Active', 'Enrolled'] }
        });
        
        if (bedOccupied && String(bedOccupied.studentId) !== String(studentId)) {
            return res.status(400).json({
                success: false,
                message: `Bed ${bed} in ${targetUnit} is already occupied.`
            });
        }

        // 2. Mark current enrollment as Exited (if provided and exists)
        if (currentEnrollmentId) {
            const currentEnrollment = await HousingEnrollment.findOne({ 
                _id: currentEnrollmentId, 
                organizationId 
            });
            
            if (currentEnrollment && ['Active', 'Enrolled'].includes(currentEnrollment.status)) {
                currentEnrollment.status = 'Exited';
                currentEnrollment.exitDate = reassignDate || new Date();
                currentEnrollment.exitReason = 'Reassigned to new bed';
                await currentEnrollment.save();
            }
        }

        // 3. Create a brand new active enrollment for the new bed
        const newEnrollment = await HousingEnrollment.create({
            studentId,
            siteId,
            organizationId,
            unit: targetUnit,
            bed,
            entryDate: reassignDate || new Date(),
            status: 'Active'
        });

        res.status(201).json({
            success: true,
            message: 'Student successfully reassigned to new bed. History preserved.',
            data: newEnrollment
        });
    } catch (error) {
        console.error('reassignBed error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// 3. PARTICIPANT HOUSING DATA (Staff / Routine Updates)
// ==========================================

// @desc    Get participant housing data (linked with master student record)
// @route   GET /api/housing/participant/:studentId
// @access  Private
exports.getParticipantHousingData = async (req, res) => {
    try {
        const { studentId } = req.params;
        const organizationId = req.user.organizationId;

        // Fetch master Student record for live zero-double-entry readout
        const student = await Student.findOne({ _id: studentId, organizationId })
            .populate('assignedStaff', 'name email');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        // Fetch all housing enrollments
        const enrollments = await HousingEnrollment.find({
            studentId,
            organizationId
        }).populate('siteId', 'name code').sort({ createdAt: -1 });

        // Fetch or initialize housing-specific data
        let housingData = await HousingData.findOne({ studentId, organizationId });
        if (!housingData) {
            housingData = await HousingData.create({
                studentId,
                organizationId,
                employment: { status: 'Seeking' },
                savings: { currentAmount: 0, priorAmount: 0, monthlyChange: 0 },
                incidents: [],
                transition: { readinessStatus: 'Not yet' }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                student: {
                    _id: student._id,
                    name: student.name,
                    studentId: student.studentId,
                    email: student.email,
                    phone: student.phone,
                    points: student.points,
                    totalPoints: student.totalPoints,
                    attendanceCount: student.attendance?.length || 0,
                    status: student.status,
                    assignedStaff: student.assignedStaff
                },
                enrollments,
                housingData
            }
        });
    } catch (error) {
        console.error('getParticipantHousingData error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update participant routine housing data (Employment, Savings, Incidents, Transition)
// @route   POST /api/housing/participant/:studentId
// @access  Private (Admin / Staff)
exports.updateParticipantHousingData = async (req, res) => {
    try {
        const { studentId } = req.params;
        const organizationId = req.user.organizationId;
        const { employment, savings, incidents, transition } = req.body;

        let housingData = await HousingData.findOne({ studentId, organizationId });
        if (!housingData) {
            housingData = new HousingData({ studentId, organizationId });
        }

        if (employment) {
            housingData.employment = {
                ...housingData.employment.toObject(),
                ...employment,
                lastVerifiedDate: employment.lastVerifiedDate || new Date()
            };
        }

        if (savings) {
            const currentAmount = savings.currentAmount !== undefined ? Number(savings.currentAmount) : (housingData.savings.currentAmount || 0);
            const priorAmount = savings.priorAmount !== undefined ? Number(savings.priorAmount) : (housingData.savings.priorAmount || 0);
            const monthlyChange = currentAmount - priorAmount;

            housingData.savings = {
                ...housingData.savings.toObject(),
                ...savings,
                currentAmount,
                priorAmount,
                monthlyChange,
                lastVerifiedDate: savings.lastVerifiedDate || new Date()
            };
        }

        if (incidents) {
            housingData.incidents = incidents;
        }

        if (transition) {
            housingData.transition = {
                ...housingData.transition.toObject(),
                ...transition,
                reviewDate: transition.reviewDate || new Date()
            };
        }

        await housingData.save();

        res.status(200).json({
            success: true,
            message: 'Housing data updated successfully',
            data: housingData
        });
    } catch (error) {
        console.error('updateParticipantHousingData error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get participant monthly 7-question review
// @route   GET /api/housing/participant/:studentId/monthly-review
// @access  Private (Admin / Staff)
exports.getParticipantMonthlyReview = async (req, res) => {
    try {
        const { studentId } = req.params;
        const month = req.query.month || new Date().toISOString().substring(0, 7);
        const reqSiteId = req.query.siteId;

        const student = await Student.findById(studentId).populate('assignedStaff');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        let organizationId = req.user?.organizationId || student.assignedStaff?.organizationId;
        if (!organizationId) {
            const enrollmentRecord = await HousingEnrollment.findOne({ studentId });
            organizationId = enrollmentRecord?.organizationId;
        }
        if (!organizationId) {
            const fallbackSite = await ProgramSite.findOne();
            organizationId = fallbackSite?.organizationId;
        }

        const enrollments = await HousingEnrollment.find({
            studentId,
            status: { $in: ['Active', 'Enrolled'] }
        }).populate('siteId', 'name code').sort({ createdAt: -1 });
        const enrollment = enrollments.length > 0 ? enrollments[0] : null;

        let housingData = await HousingData.findOne({ studentId });
        if (!housingData) {
            housingData = await HousingData.create({
                studentId,
                organizationId,
                employment: { status: 'Seeking' },
                savings: { currentAmount: 0, priorAmount: 0, monthlyChange: 0 },
                incidents: [],
                transition: { readinessStatus: 'Not yet' },
                monthlyEvaluations: []
            });
        }

        const existingEval = (housingData.monthlyEvaluations || []).find(e => 
            e.month === month && 
            (!reqSiteId || String(e.siteId) === String(reqSiteId))
        );

        if (existingEval) {
            return res.status(200).json({
                success: true,
                data: {
                    month,
                    studentId,
                    studentName: student.name,
                    site: enrollment?.siteId || null,
                    unit: enrollment?.unit || 'Unit 1',
                    bed: enrollment?.bed || '',
                    isEvaluated: true,
                    evaluatedAt: existingEval.evaluatedAt,
                    evaluatedBy: existingEval.evaluatedBy,
                    score: existingEval.score,
                    applicableCount: existingEval.applicableCount,
                    scorePercentage: existingEval.scorePercentage,
                    statusColor: existingEval.statusColor,
                    responses: existingEval.responses
                }
            });
        }

        // Auto-populate default responses from live routine data
        const empStatus = housingData.employment?.status || 'Seeking';
        const monthlySavings = housingData.savings?.monthlyChange || 0;
        const incidentsList = housingData.incidents || [];
        const openIncidents = incidentsList.filter(i => i.status !== 'Resolved').length;
        const resolvedIncidents = incidentsList.filter(i => i.status === 'Resolved').length;
        const currentPoints = student.points || 0;
        const targetPoints = student.totalPoints || 250;
        const ridssStatus = currentPoints >= (targetPoints * 0.5) ? 'On Track' : 'Needs follow-up';

        const suggestedResponses = DEFAULT_QUESTIONS.map(q => {
            let ans = q.suggestedAnswer;
            if (q.questionId === 1) ans = 'Yes';
            else if (q.questionId === 2) ans = empStatus === 'Working' ? 'Yes' : 'No';
            else if (q.questionId === 3) ans = monthlySavings >= 0 ? 'Yes' : 'No';
            else if (q.questionId === 4) ans = ridssStatus === 'On Track' ? 'Yes' : 'No';
            else if (q.questionId === 5) ans = openIncidents === 0 ? 'Yes' : 'No';
            else if (q.questionId === 6) ans = resolvedIncidents >= 0 ? 'Yes' : 'No';
            else if (q.questionId === 7) ans = 'N/A';
            return {
                questionId: q.questionId,
                questionText: q.questionText,
                answer: ans,
                comment: ''
            };
        });

        const initialScore = calculateScore(suggestedResponses);

        res.status(200).json({
            success: true,
            data: {
                month,
                studentId,
                studentName: student.name,
                site: enrollment?.siteId || null,
                unit: enrollment?.unit || 'Unit 1',
                bed: enrollment?.bed || '',
                isEvaluated: false,
                evaluatedAt: null,
                evaluatedBy: null,
                score: initialScore.yesCount,
                applicableCount: initialScore.applicableCount,
                scorePercentage: initialScore.score,
                statusColor: initialScore.statusColor,
                responses: suggestedResponses
            }
        });
    } catch (error) {
        console.error('getParticipantMonthlyReview error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Save participant monthly 7-question review & calculate individual score
// @route   POST /api/housing/participant/:studentId/monthly-review
// @access  Private (Admin / Staff)
exports.saveParticipantMonthlyReview = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { month, responses, siteId } = req.body;

        if (!month || !responses || !Array.isArray(responses)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide month and responses array'
            });
        }

        const student = await Student.findById(studentId).populate('assignedStaff');
        if (!student) {
            return res.status(404).json({ success: false, message: 'Student not found' });
        }

        let organizationId = req.user?.organizationId || student.assignedStaff?.organizationId;
        if (!organizationId) {
            const enrollmentRecord = await HousingEnrollment.findOne({ studentId });
            organizationId = enrollmentRecord?.organizationId;
        }
        if (!organizationId) {
            const fallbackSite = await ProgramSite.findOne();
            organizationId = fallbackSite?.organizationId;
        }

        let housingData = await HousingData.findOne({ studentId });
        if (!housingData) {
            housingData = new HousingData({
                studentId,
                organizationId,
                employment: { status: 'Seeking' },
                savings: { currentAmount: 0, priorAmount: 0, monthlyChange: 0 },
                incidents: [],
                transition: { readinessStatus: 'Not yet' },
                monthlyEvaluations: []
            });
        }

        // Calculate score
        let yesCount = 0;
        let applicableCount = 0;
        responses.forEach(r => {
            if (r.answer === 'Yes') {
                yesCount += 1;
                applicableCount += 1;
            } else if (r.answer === 'No') {
                applicableCount += 1;
            }
        });

        const scorePercentage = applicableCount > 0 ? Math.round((yesCount / applicableCount) * 100) : 100;
        let statusColor = 'Green';
        if (scorePercentage < 70) statusColor = 'Red';
        else if (scorePercentage < 85) statusColor = 'Yellow';

        const evalObject = {
            month,
            siteId: siteId || undefined,
            responses,
            yesCount,
            applicableCount,
            score: yesCount, // e.g. 5
            scorePercentage,
            statusColor,
            evaluatedBy: req.user._id,
            evaluatedAt: new Date()
        };

        if (!Array.isArray(housingData.monthlyEvaluations)) {
            housingData.monthlyEvaluations = [];
        }

        const existingIndex = housingData.monthlyEvaluations.findIndex(e => 
            e.month === month && 
            String(e.siteId) === String(siteId)
        );
        if (existingIndex >= 0) {
            housingData.monthlyEvaluations[existingIndex] = evalObject;
        } else {
            housingData.monthlyEvaluations.push(evalObject);
        }

        await housingData.save();

        res.status(200).json({
            success: true,
            message: `Monthly review for ${student.name} saved! Score: ${yesCount}/${applicableCount} (${scorePercentage}%)`,
            data: evalObject
        });
    } catch (error) {
        console.error('saveParticipantMonthlyReview error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// ==========================================
// 4. MONTHLY HOUSING DASHBOARD & REVIEW
// ==========================================

// Default 7 Questions Framework from client documentation
const DEFAULT_QUESTIONS = [
    {
        questionId: 1,
        questionText: 'Are assigned participants placed and maintaining housing stability?',
        suggestedAnswer: 'Yes'
    },
    {
        questionId: 2,
        questionText: 'Are participants gaining or retaining employment?',
        suggestedAnswer: 'Yes'
    },
    {
        questionId: 3,
        questionText: 'Are participant savings growing?',
        suggestedAnswer: 'Yes'
    },
    {
        questionId: 4,
        questionText: 'Are RIDSS points and wellness-zone activities progressing?',
        suggestedAnswer: 'Yes'
    },
    {
        questionId: 5,
        questionText: 'Are serious incidents decreasing?',
        suggestedAnswer: 'Yes'
    },
    {
        questionId: 6,
        questionText: 'When serious issues occur, are they being addressed according to the program plan?',
        suggestedAnswer: 'Yes'
    },
    {
        questionId: 7,
        questionText: 'Are participants moving toward or into standard housing opportunities?',
        suggestedAnswer: 'N/A'
    }
];

// @desc    Get monthly dashboard for a site (Roll-up table, 7 questions, and scoring)
// @route   GET /api/housing/dashboard/:siteId
// @access  Private
exports.getMonthlyDashboard = async (req, res) => {
    try {
        const { siteId } = req.params;
        const organizationId = req.user.organizationId;
        const month = req.query.month || new Date().toISOString().substring(0, 7); // e.g. "2026-09"

        const site = await ProgramSite.findOne({ _id: siteId, organizationId });
        if (!site) {
            return res.status(404).json({ success: false, message: 'Housing Site not found' });
        }

        // 1. Get active enrollments for this site
        const enrollments = await HousingEnrollment.find({
            siteId,
            organizationId,
            status: { $in: ['Active', 'Enrolled'] }
        }).populate({
            path: 'studentId',
            select: 'name studentId phone email points totalPoints status attendance'
        }).sort({ bed: 1 });

        // 2. Fetch HousingData for each participant to construct Roll-Up Table
        const participantRollUp = [];
        let totalSavingsGrowth = 0;
        let employedCount = 0;
        let activeIncidentsCount = 0;

        for (const enr of enrollments) {
            if (!enr.studentId) continue;

            const hData = await HousingData.findOne({ studentId: enr.studentId._id });
            const empStatus = hData?.employment?.status || 'Seeking';
            if (empStatus === 'Working') employedCount += 1;

            const monthlySavings = hData?.savings?.monthlyChange || 0;
            totalSavingsGrowth += monthlySavings;

            const incidentsList = hData?.incidents || [];
            const openIncidents = incidentsList.filter(i => i.status !== 'Resolved').length;
            const resolvedIncidents = incidentsList.filter(i => i.status === 'Resolved').length;
            activeIncidentsCount += openIncidents;

            // Determine RIDSS status from master student points
            const currentPoints = enr.studentId.points || 0;
            const targetPoints = enr.studentId.totalPoints || 250;
            const ridssStatus = currentPoints >= (targetPoints * 0.5) ? 'On Track' : 'Needs follow-up';

            // Check for student-level monthly evaluation for this month
            const studentEval = (hData?.monthlyEvaluations || []).find(e => 
                e.month === month && 
                (!e.siteId || String(e.siteId) === String(siteId))
            );
            let individualScore;
            if (studentEval) {
                individualScore = {
                    score: studentEval.score,
                    applicableCount: studentEval.applicableCount,
                    scorePercentage: studentEval.scorePercentage,
                    statusColor: studentEval.statusColor,
                    isEvaluated: true,
                    evaluatedAt: studentEval.evaluatedAt,
                    responses: studentEval.responses
                };
            } else {
                // Inferred suggestions based on live data if student not yet formally evaluated
                const inferredResponses = DEFAULT_QUESTIONS.map(q => {
                    let ans = q.suggestedAnswer;
                    if (q.questionId === 1) ans = 'Yes';
                    else if (q.questionId === 2) ans = empStatus === 'Working' ? 'Yes' : 'No';
                    else if (q.questionId === 3) ans = monthlySavings >= 0 ? 'Yes' : 'No';
                    else if (q.questionId === 4) ans = ridssStatus === 'On Track' ? 'Yes' : 'No';
                    else if (q.questionId === 5) ans = openIncidents === 0 ? 'Yes' : 'No';
                    else if (q.questionId === 6) ans = resolvedIncidents >= 0 ? 'Yes' : 'No';
                    else if (q.questionId === 7) ans = 'N/A';
                    return {
                        questionId: q.questionId,
                        questionText: q.questionText,
                        answer: ans,
                        comment: ''
                    };
                });
                const inferredScore = calculateScore(inferredResponses);
                individualScore = {
                    score: inferredScore.yesCount,
                    applicableCount: inferredScore.applicableCount,
                    scorePercentage: inferredScore.score,
                    statusColor: inferredScore.statusColor,
                    isEvaluated: false,
                    evaluatedAt: null,
                    responses: inferredResponses
                };
            }

            participantRollUp.push({
                studentId: enr.studentId._id,
                enrollmentId: enr._id,
                name: enr.studentId.name,
                studentCode: enr.studentId.studentId,
                bed: enr.bed,
                unit: enr.unit,
                employmentStatus: empStatus,
                savingsChange: monthlySavings,
                currentSavings: hData?.savings?.currentAmount || 0,
                ridssPoints: currentPoints,
                ridssStatus,
                incidentsSummary: `${openIncidents} open, ${resolvedIncidents} resolved`,
                openIncidentsCount: openIncidents,
                transitionStatus: hData?.transition?.readinessStatus || 'Not yet',
                individualScore
            });
        }

        // 3. Roll up all individual scores into Monthly Program Score Summary
        let totalIndividualYes = 0;
        let totalIndividualApplicable = 0;
        let evaluatedCount = 0;

        const metricStats = DEFAULT_QUESTIONS.map(q => ({
            questionId: q.questionId,
            questionText: q.questionText,
            yesCount: 0,
            noCount: 0,
            naCount: 0
        }));

        participantRollUp.forEach(p => {
            if (p.individualScore) {
                totalIndividualYes += (p.individualScore.score || 0);
                totalIndividualApplicable += (p.individualScore.applicableCount || 0);
                if (p.individualScore.isEvaluated) evaluatedCount++;

                (p.individualScore.responses || []).forEach(r => {
                    const m = metricStats.find(item => item.questionId === r.questionId);
                    if (m) {
                        if (r.answer === 'Yes') m.yesCount++;
                        else if (r.answer === 'No') m.noCount++;
                        else if (r.answer === 'N/A') m.naCount++;
                    }
                });
            }
        });

        const rolledUpScore = totalIndividualApplicable > 0 
            ? Math.round((totalIndividualYes / totalIndividualApplicable) * 100) 
            : 100;
        let rolledUpStatusColor = 'Green';
        if (rolledUpScore < 70) rolledUpStatusColor = 'Red';
        else if (rolledUpScore < 85) rolledUpStatusColor = 'Yellow';

        // 4. Check if snapshot is already saved/finalized for this month
        let snapshot = await MonthlySnapshot.findOne({ siteId, month, organizationId })
            .populate('finalizedBy', 'name email');

        let metricResponses;
        let scoreData;
        let narrative = { wins: '', concerns: '', nextActions: '' };
        let isFinalized = false;
        let displayRollUp = participantRollUp;

        if (snapshot) {
            metricResponses = snapshot.metricResponses;
            scoreData = {
                score: snapshot.score,
                statusColor: snapshot.statusColor,
                yesCount: totalIndividualYes,
                applicableCount: totalIndividualApplicable,
                evaluatedCount
            };
            narrative = snapshot.narrative;
            isFinalized = snapshot.isFinalized;

            // True Immutability: Serve frozen participant snapshot when finalized
            if (isFinalized && Array.isArray(snapshot.participantSnapshots) && snapshot.participantSnapshots.length > 0) {
                displayRollUp = snapshot.participantSnapshots;
            }
        } else {
            // Aggregate Roll-Up for the 7 questions
            metricResponses = metricStats.map(m => {
                const applicable = m.yesCount + m.noCount;
                const pct = applicable > 0 ? Math.round((m.yesCount / applicable) * 100) : 100;
                return {
                    questionId: m.questionId,
                    questionText: m.questionText,
                    answer: pct >= 70 ? 'Yes' : 'No',
                    yesCount: m.yesCount,
                    noCount: m.noCount,
                    naCount: m.naCount,
                    percentage: pct,
                    comment: `${m.yesCount} of ${applicable} participants meeting metric`
                };
            });
            scoreData = {
                score: rolledUpScore,
                statusColor: rolledUpStatusColor,
                yesCount: totalIndividualYes,
                applicableCount: totalIndividualApplicable,
                evaluatedCount
            };
        }

        // 4. Retrieve 3-month and 6-month historical trends
        const pastSnapshots = await MonthlySnapshot.find({
            siteId,
            organizationId
        }).sort({ month: -1 }).limit(6);

        const trends = pastSnapshots.map(s => ({
            month: s.month,
            score: s.score,
            statusColor: s.statusColor,
            isFinalized: s.isFinalized
        })).reverse();

        res.status(200).json({
            success: true,
            data: {
                site: {
                    _id: site._id,
                    name: site.name,
                    code: site.code,
                    capacity: site.capacity,
                    units: site.units
                },
                month,
                assignedCount: displayRollUp.length,
                metricResponses,
                score: scoreData.score,
                statusColor: scoreData.statusColor,
                narrative,
                isFinalized,
                finalizedBy: snapshot?.finalizedBy || null,
                finalizedAt: snapshot?.finalizedAt || null,
                participantRollUp: displayRollUp,
                trends
            }
        });
    } catch (error) {
        console.error('getMonthlyDashboard error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Save draft or finalize monthly snapshot
// @route   POST /api/housing/dashboard/:siteId/snapshot
// @access  Private (Admin / Program Lead)
exports.saveMonthlySnapshot = async (req, res) => {
    try {
        const { siteId } = req.params;
        const organizationId = req.user.organizationId;
        const { month, metricResponses, narrative, isFinalized, participantSnapshots } = req.body;

        if (!month || !metricResponses || !Array.isArray(metricResponses)) {
            return res.status(400).json({ success: false, message: 'Please provide month and metric responses' });
        }

        const scoreData = calculateScore(metricResponses);

        let snapshot = await MonthlySnapshot.findOne({ siteId, month, organizationId });

        if (snapshot && snapshot.isFinalized) {
            return res.status(400).json({
                success: false,
                message: 'This monthly snapshot is already finalized and locked. Historical snapshots cannot be edited.'
            });
        }

        if (!snapshot) {
            snapshot = new MonthlySnapshot({
                siteId,
                organizationId,
                month
            });
        }

        snapshot.metricResponses = metricResponses;
        snapshot.score = scoreData.score;
        snapshot.statusColor = scoreData.statusColor;
        if (narrative) snapshot.narrative = narrative;
        if (participantSnapshots) snapshot.participantSnapshots = participantSnapshots;

        if (isFinalized) {
            snapshot.isFinalized = true;
            snapshot.finalizedBy = req.user._id;
            snapshot.finalizedAt = new Date();
        }

        await snapshot.save();

        res.status(200).json({
            success: true,
            message: isFinalized ? 'Monthly Snapshot finalized and locked successfully' : 'Draft snapshot saved successfully',
            data: snapshot
        });
    } catch (error) {
        console.error('saveMonthlySnapshot error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get 3-Month and 6-Month score trends
// @route   GET /api/housing/trends/:siteId
// @access  Private
exports.getSiteTrends = async (req, res) => {
    try {
        const { siteId } = req.params;
        const organizationId = req.user.organizationId;

        const snapshots = await MonthlySnapshot.find({ siteId, organizationId })
            .sort({ month: -1 })
            .limit(6);

        res.status(200).json({
            success: true,
            data: snapshots.reverse()
        });
    } catch (error) {
        console.error('getSiteTrends error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};
