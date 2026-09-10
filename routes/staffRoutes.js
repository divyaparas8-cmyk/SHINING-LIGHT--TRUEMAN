const express = require('express');
const router = express.Router();
const {
    getAllStaff,
    createStaff,
    updateStaff,
    deleteStaff
} = require('../controllers/staffController');
const { protect, authorize } = require('../middlewares/authMiddleware');

// All staff management routes are protected and only accessible by admins
router.use(protect);
router.use(authorize('admin'));

router.route('/')
    .get(getAllStaff)
    .post(createStaff);

router.route('/:id')
    .put(updateStaff)
    .delete(deleteStaff);

module.exports = router;
