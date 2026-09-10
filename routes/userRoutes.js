const express = require('express');
const router = express.Router();
const { getStaff, updateProfile, getMe } = require('../controllers/userController');
const { protect } = require('../middlewares/authMiddleware');
const { uploadAvatar } = require('../config/upload');

router.get('/me', protect, getMe);
router.get('/staff', protect, getStaff);
router.put('/profile', protect, uploadAvatar.single('avatar'), updateProfile);

module.exports = router;
