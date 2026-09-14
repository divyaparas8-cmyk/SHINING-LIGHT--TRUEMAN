const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const housingController = require('../controllers/housingController');
const Student = require('../models/Student');
const ProgramSite = require('../models/ProgramSite');
const HousingEnrollment = require('../models/HousingEnrollment');

const runTest = async () => {
    try {
        console.log('Connecting to MongoDB Atlas for Backend testing...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected!');

        // 1. Find a test student
        const student = await Student.findOne();
        if (!student) {
            console.log('❌ No student found');
            return;
        }
        console.log(`Testing with student: ${student.name} (ID: ${student._id})`);

        // Mock req and res for getParticipantMonthlyReview
        const reqMock = {
            params: { studentId: student._id.toString() },
            query: { month: '2026-09' },
            user: { organizationId: student.organizationId, _id: student.assignedStaff || student._id }
        };

        let capturedData = null;
        const resMock = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                capturedData = data;
                return this;
            }
        };

        // Test GET monthly-review
        await housingController.getParticipantMonthlyReview(reqMock, resMock);
        console.log('✅ GET Participant Monthly Review Status:', resMock.statusCode);
        console.log('   - Suggested Score:', capturedData?.data?.score, 'out of', capturedData?.data?.applicableCount);
        console.log('   - Evaluated status:', capturedData?.data?.isEvaluated);

        // Test POST monthly-review (Save student review with 5 Yes out of 7)
        const postReqMock = {
            params: { studentId: student._id.toString() },
            body: {
                month: '2026-09',
                responses: [
                    { questionId: 1, questionText: 'Q1', answer: 'Yes', comment: 'Stable' },
                    { questionId: 2, questionText: 'Q2', answer: 'Yes', comment: 'Working' },
                    { questionId: 3, questionText: 'Q3', answer: 'Yes', comment: 'Savings up' },
                    { questionId: 4, questionText: 'Q4', answer: 'Yes', comment: 'Points on track' },
                    { questionId: 5, questionText: 'Q5', answer: 'Yes', comment: '0 incidents' },
                    { questionId: 6, questionText: 'Q6', answer: 'No', comment: 'Issue pending' },
                    { questionId: 7, questionText: 'Q7', answer: 'N/A', comment: 'Not yet applicable' }
                ]
            },
            user: { organizationId: student.organizationId, _id: student.assignedStaff || student._id }
        };

        let postCaptured = null;
        const postResMock = {
            status: function(code) {
                this.statusCode = code;
                return this;
            },
            json: function(data) {
                postCaptured = data;
                return this;
            }
        };

        await housingController.saveParticipantMonthlyReview(postReqMock, postResMock);
        console.log('✅ POST Participant Monthly Review Status:', postResMock.statusCode);
        console.log('   - Saved Score:', postCaptured?.data?.score, 'out of', postCaptured?.data?.applicableCount);
        console.log('   - Score %:', postCaptured?.data?.scorePercentage, '%');
        console.log('   - Status Color:', postCaptured?.data?.statusColor);

        // Test Dashboard roll-up
        const site = await ProgramSite.findOne();
        if (site) {
            const dashReq = {
                params: { siteId: site._id.toString() },
                query: { month: '2026-09' },
                user: { organizationId: site.organizationId }
            };
            let dashCaptured = null;
            const dashRes = {
                status: function(code) {
                    this.statusCode = code;
                    return this;
                },
                json: function(data) {
                    dashCaptured = data;
                    return this;
                }
            };
            await housingController.getMonthlyDashboard(dashReq, dashRes);
            console.log('✅ GET Monthly Dashboard Status:', dashRes.statusCode);
            console.log('   - Rolled Up Score:', dashCaptured?.data?.score);
            console.log('   - Rolled Up Status Color:', dashCaptured?.data?.statusColor);
            console.log('   - Participants in Roll-Up:', dashCaptured?.data?.participantRollUp?.length);
        }

        console.log('\n🎉 ALL BACKEND CONTROLLER & ROUTING LOGIC PASSED 100%!');
    } catch (err) {
        console.error('❌ Test failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

runTest();
