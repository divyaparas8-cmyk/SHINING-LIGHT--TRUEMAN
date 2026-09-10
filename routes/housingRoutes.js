const express = require('express');
const router = express.Router();
const {
    getSites,
    createSite,
    updateSite,
    deleteSite,
    getEnrollments,
    enrollStudent,
    updateEnrollment,
    getParticipantHousingData,
    updateParticipantHousingData,
    getMonthlyDashboard,
    saveMonthlySnapshot,
    getSiteTrends
} = require('../controllers/housingController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// All housing routes require authentication
router.use(protect);

// Sites & Pilots
router.get('/sites', getSites);
router.post('/sites', authorize('admin', 'super_admin'), createSite);
router.put('/sites/:id', authorize('admin', 'super_admin'), updateSite);
router.delete('/sites/:id', authorize('admin', 'super_admin'), deleteSite);

// Enrollments
router.get('/enrollments/:siteId', getEnrollments);
router.post('/enroll', authorize('admin', 'staff', 'super_admin'), enrollStudent);
router.put('/enroll/:id', authorize('admin', 'staff', 'super_admin'), updateEnrollment);

// Participant Housing Details (Case Manager / Staff routine updates)
router.get('/participant/:studentId', getParticipantHousingData);
router.post('/participant/:studentId', authorize('admin', 'staff', 'super_admin'), updateParticipantHousingData);

// Monthly Dashboard, 7-Question Review, Scoring & Snapshots (Admin / Program Lead)
router.get('/dashboard/:siteId', getMonthlyDashboard);
router.post('/dashboard/:siteId/snapshot', authorize('admin', 'super_admin'), saveMonthlySnapshot);
router.get('/trends/:siteId', getSiteTrends);

module.exports = router;
