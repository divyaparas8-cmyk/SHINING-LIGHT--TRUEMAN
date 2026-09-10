const express = require('express');
const router = express.Router();
const {
    createAttendance,
    getAllAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');

const { protect, authorize } = require('../middlewares/authMiddleware');

router.route('/')
    .get(protect, getAllAttendance)
    .post(protect, authorize('admin', 'staff'), createAttendance); // Allowing staff to mark as well based on standard school CRMs, change to admin if strictly required.

router.route('/:id')
    .delete(protect, authorize('admin', 'staff'), deleteAttendance);

module.exports = router;
