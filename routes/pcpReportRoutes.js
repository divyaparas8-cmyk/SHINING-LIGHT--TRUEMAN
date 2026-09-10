const express = require('express');
const router = express.Router();
const {
    createReport,
    getReports,
    getReportById,
    updateReport,
    deleteReport
} = require('../controllers/pcpReportController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadAssessment } = require('../config/upload');

router.route('/')
    .get(protect, getReports)
    .post(protect, authorize('admin', 'staff'), uploadAssessment.single('assessmentFile'), createReport);

router.route('/:id')
    .get(protect, getReportById)
    .put(protect, authorize('admin', 'staff'), uploadAssessment.single('assessmentFile'), updateReport)
    .delete(protect, authorize('admin'), deleteReport);

module.exports = router;
