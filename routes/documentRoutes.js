const express = require('express');
const router = express.Router();
const { uploadDocument, getDocuments, deleteDocument, downloadDocument, updateDocument } = require('../controllers/documentController');
const { protect, authorize } = require('../middlewares/authMiddleware');
const { uploadDocument: uploadMiddleware } = require('../config/upload'); // rename exported middleware

router.route('/')
    .get(protect, getDocuments)
    .post(protect, authorize('admin', 'staff'), uploadMiddleware.single('file'), uploadDocument);

router.route('/:id/download')
    .get(protect, downloadDocument);

router.route('/:id')
    .put(protect, authorize('admin', 'staff'), uploadMiddleware.single('file'), updateDocument)
    .delete(protect, authorize('admin', 'staff'), deleteDocument);

module.exports = router;
