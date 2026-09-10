const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middlewares/authMiddleware');
const {
    getStats,
    createOrganization,
    getOrganizations,
    updateOrganization,
    deleteOrganization,
    updateOrganizationStatus,
    createPlan,
    getPlans,
    updatePlan,
    deletePlan,
    getRevenueStats,
    deleteSubscription
} = require('../controllers/superAdminController');

// All routes here are protected and restricted to super_admin
router.use(protect);
router.use(authorize('super_admin'));

router.get('/dashboard/stats', getStats);
router.get('/revenue/stats', getRevenueStats);
router.delete('/subscriptions/:id', deleteSubscription);

router.route('/organizations')
    .get(getOrganizations)
    .post(createOrganization);

router.route('/organizations/:id')
    .put(updateOrganization)
    .delete(deleteOrganization);

router.patch('/organizations/:id/status', updateOrganizationStatus);

router.route('/plans')
    .get(getPlans)
    .post(createPlan);

router.route('/plans/:id')
    .put(updatePlan)
    .delete(deletePlan);

module.exports = router;
