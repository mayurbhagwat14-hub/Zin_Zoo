import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import { AuthError } from '../../../../core/auth/errors.js';
import * as adminController from '../controllers/admin.controller.js';
import * as businessSettingsController from '../controllers/businessSettings.controller.js';
import * as coinSettingsController from '../controllers/coinSettings.controller.js';
import * as coinRedemptionController from '../controllers/coinRedemption.controller.js';
import * as feedbackExperienceController from '../controllers/feedbackExperience.controller.js';
import * as notificationBroadcastController from '../controllers/notificationBroadcast.controller.js';
import * as orderController from '../../orders/controllers/order.controller.js';
import { getAdminPageController, upsertAdminPageController } from '../controllers/pageContent.controller.js';
import * as adminWalletController from '../controllers/adminWallet.controller.js';
import { FoodAdmin } from '../../../../core/admin/admin.model.js';
import { requireAdminPermission, requireAnyAdminPermission } from '../../../../core/roles/adminPermission.middleware.js';
import * as adminPromotionsController from '../controllers/adminPromotions.controller.js';
import * as adminGroceryController from '../controllers/adminGrocery.controller.js';
import * as adminGlobalOrdersController from '../controllers/adminGlobalOrders.controller.js';

const router = express.Router();

// ----- Public Business Settings (No Admin Required) -----
router.get('/business-settings/public', businessSettingsController.getBusinessSettings);
router.get('/power-scanning/public', businessSettingsController.getPowerScanningSettings);
router.get('/fee-settings/public', adminController.getFeeSettings);
router.get('/feature-settings/public', adminController.getFeatureSettings);

const requireAdmin = (req, _res, next) => {
    const user = req.user;
    if (!user || user.role !== 'ADMIN') {
        return next(new AuthError('Admin access required'));
    }
    return next();
};

router.use(requireAdmin);
router.use(async (req, _res, next) => {
    try {
        const admin = await FoodAdmin.findById(req.user?.userId)
            .select('adminType permissions isActive isDeleted')
            .lean();
        req.adminAccess = admin;
        return next();
    } catch (error) {
        return next(error);
    }
});

const resolveSectionFromRequest = (path = '', method = '') => {
    if (path.startsWith('/sub-admins')) return 'sub_admin_management';
    if (path.startsWith('/restaurants') || path.startsWith('/restaurant-commissions') || path.startsWith('/restaurant-settings') || path.startsWith('/restaurant-subscription-settings') || path.startsWith('/restaurant-subscriptions')) return 'restaurant_management';
    if (path === '/customers' && String(method).toUpperCase() === 'GET') return null;
    if (path.startsWith('/customers') || path.startsWith('/support-tickets')) return 'customer_management';
    if (path === '/zones' && String(method).toUpperCase() === 'GET') return null;
    if (/^\/zones\/[^/]+$/.test(path) && String(method).toUpperCase() === 'GET') return null;
    if (path === '/orders' && String(method).toUpperCase() === 'GET') return null;
    if (path.startsWith('/zones')) return 'zone_management'; // keeping permission key for Zones
    if (path.startsWith('/categories') || path.startsWith('/foods')) return 'food_management';
    if (path.startsWith('/offers')) return 'promotions_management';
    if (path.startsWith('/orders')) return 'order_management';
    if (path.startsWith('/feedback-experiences')) return 'report_management';
    if (path.startsWith('/reports')) return 'report_management';
    if (path.startsWith('/feature-settings') || path.startsWith('/business-settings') || path.startsWith('/power-scanning') || path.startsWith('/notifications') || path.startsWith('/coin-settings') || path.startsWith('/coin-requests')) return 'system_settings';
    if (path.startsWith('/pages-social-media')) return 'pages_social_media';
    if (path.startsWith('/sidebar-badges') || path.startsWith('/dashboard-stats')) return 'dashboard';
    return null;
};

const resolveActionByMethod = (method = '') => {
    const normalized = String(method).toUpperCase();
    if (normalized === 'GET') return 'view';
    if (normalized === 'POST') return 'create';
    if (normalized === 'DELETE') return 'delete';
    if (normalized === 'PATCH' || normalized === 'PUT') return 'edit';
    return 'view';
};

router.use((req, res, next) => {
    const section = resolveSectionFromRequest(req.path, req.method);
    if (!section) return next();
    const action = resolveActionByMethod(req.method);
    return requireAdminPermission(section, action)(req, res, next);
});

router.use('/sub-admins', requireAdminPermission('sub_admin_management', 'view'));
router.use(
    '/customers',
    requireAnyAdminPermission([
        { section: 'customer_management', action: 'view' },
        { section: 'report_management', action: 'view' },
    ])
);
router.use('/support-tickets', requireAdminPermission('customer_management', 'view'));
router.use('/categories', requireAdminPermission('food_management', 'view'));
router.use('/foods', requireAdminPermission('food_management', 'view'));
router.use('/offers', requireAdminPermission('promotions_management', 'view'));
router.use('/reports', requireAdminPermission('report_management', 'view'));
router.use('/feature-settings', requireAdminPermission('system_settings', 'view'));
router.use('/business-settings', requireAdminPermission('system_settings', 'view'));
router.use('/power-scanning', requireAdminPermission('system_settings', 'view'));
router.use('/coin-settings', requireAdminPermission('system_settings', 'view'));
router.use('/coin-requests', requireAdminPermission('system_settings', 'view'));
router.use('/notifications', requireAdminPermission('system_settings', 'view'));
router.use('/pages-social-media', requireAdminPermission('pages_social_media', 'view'));
router.use('/wallet', requireAdminPermission('system_settings', 'view')); // Using system_settings or maybe we should add transaction_management
router.use('/sidebar-badges', requireAdminPermission('dashboard', 'view'));

router.post('/sub-admins', requireAdminPermission('sub_admin_management', 'create'), adminController.createSubAdmin);
router.get('/sub-admins', adminController.listSubAdmins);
router.get('/sub-admins/permission-catalog', adminController.getAdminPermissionCatalog);
router.get('/sub-admins/:id', adminController.getSubAdminDetails);
router.patch('/sub-admins/:id', requireAdminPermission('sub_admin_management', 'edit'), adminController.updateSubAdminProfile);
router.patch('/sub-admins/:id/permissions', requireAdminPermission('sub_admin_management', 'edit'), adminController.updateSubAdminPermissions);
router.patch('/sub-admins/:id/status', requireAdminPermission('sub_admin_management', 'edit'), adminController.updateSubAdminStatus);
router.delete('/sub-admins/:id', requireAdminPermission('sub_admin_management', 'delete'), adminController.deleteSubAdmin);

// ----- Broadcast Notifications -----
router.post('/notifications/broadcast', notificationBroadcastController.createBroadcastNotificationController);
router.get('/notifications/broadcast', notificationBroadcastController.getBroadcastNotificationsController);
router.delete('/notifications/broadcast/:id', notificationBroadcastController.deleteBroadcastNotificationController);

// ----- Customers -----
router.get(
    '/customers',
    requireAnyAdminPermission([
        { section: 'customer_management', action: 'view' },
        { section: 'report_management', action: 'view' },
    ]),
    adminController.getCustomers
);
router.get('/customers/:id', adminController.getCustomerById);
router.patch('/customers/:id/status', adminController.updateCustomerStatus);

// ----- Safety / Emergency Reports -----
router.get('/safety-emergency-reports', adminController.getSafetyEmergencyReports);
router.put('/safety-emergency-reports/:id/status', adminController.updateSafetyEmergencyStatus);
router.put('/safety-emergency-reports/:id/priority', adminController.updateSafetyEmergencyPriority);
router.delete('/safety-emergency-reports/:id', adminController.deleteSafetyEmergencyReport);

// ----- Support Tickets (users) -----
router.get('/support-tickets', adminController.getSupportTicketsController);
router.patch('/support-tickets/:id', adminController.updateSupportTicketController);
router.delete('/support-tickets/:id', adminController.deleteSupportTicketController);
router.get('/global-search', adminController.globalSearch);

router.get('/dashboard-stats', adminController.getDashboardStats);
router.get('/reports/transactions', adminController.getTransactionReport);
router.get('/reports/restaurants', adminController.getRestaurantReport);
router.get('/reports/tax', adminController.getTaxReport);
router.get('/reports/tax/:id', adminController.getTaxReportDetail);
router.get('/feature-settings', adminController.getFeatureSettings);
router.patch('/feature-settings/:key', adminController.updateFeatureSetting);

// ==========================
// GROCERY MANAGEMENT
// ==========================
router.get('/grocery/categories', adminGroceryController.getGroceryCategories);
router.post('/grocery/categories', adminGroceryController.createGroceryCategory);
router.put('/grocery/categories/:id', adminGroceryController.updateGroceryCategory);
router.delete('/grocery/categories/:id', adminGroceryController.deleteGroceryCategory);

router.get('/grocery/products', adminGroceryController.getGroceryProducts);
router.post('/grocery/products', adminGroceryController.createGroceryProduct);
router.put('/grocery/products/:id', adminGroceryController.updateGroceryProduct);
router.delete('/grocery/products/:id', adminGroceryController.deleteGroceryProduct);

router.get('/grocery/orders', adminGroceryController.getGroceryOrders);
router.post('/grocery/seed', adminGroceryController.seedGroceryData);

// ==========================
// PROMOTIONS & CAMPAIGNS
// ==========================
// Campaigns
router.post('/campaigns', adminPromotionsController.createCampaign);
router.get('/campaigns', adminPromotionsController.getCampaigns);
router.put('/campaigns/:id', adminPromotionsController.updateCampaign);
router.delete('/campaigns/:id', adminPromotionsController.deleteCampaign);
router.patch('/campaigns/:id/status', adminPromotionsController.toggleCampaignStatus);

// Cashback
router.post('/cashbacks', adminPromotionsController.createCashback);
router.get('/cashbacks', adminPromotionsController.getCashbacks);
router.put('/cashbacks/:id', adminPromotionsController.updateCashback);
router.delete('/cashbacks/:id', adminPromotionsController.deleteCashback);
router.patch('/cashbacks/:id/status', adminPromotionsController.toggleCashbackStatus);

// Advertisements
router.post('/advertisements', adminPromotionsController.createAdvertisement);
router.get('/advertisements', adminPromotionsController.getAdvertisements);
router.put('/advertisements/:id', adminPromotionsController.updateAdvertisement);
router.delete('/advertisements/:id', adminPromotionsController.deleteAdvertisement);
router.patch('/advertisements/:id/status', adminPromotionsController.updateAdvertisementStatus);

// ----- Categories -----
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.patch('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);
router.patch('/categories/:id/toggle', adminController.toggleCategoryStatus);
router.patch('/categories/:id/approve', adminController.approveCategory);
router.patch('/categories/:id/reject', adminController.rejectCategory);
router.patch('/categories/:id/make-global', adminController.makeCategoryGlobal);

// ----- Foods -----
router.get('/foods', adminController.getFoods);
router.post('/foods', adminController.createFood);
router.patch('/foods/:id', adminController.updateFood);
router.delete('/foods/:id', adminController.deleteFood);
router.post('/foods/bulk-approve', adminController.bulkApproveFoodItems);

// ----- Offers & Coupons -----
router.get('/offers', adminController.getAllOffers);
router.post('/offers', adminController.createAdminOffer);
router.patch('/offers/:id/cart-visibility', adminController.updateAdminOfferCartVisibility);
router.delete('/offers/:id', adminController.deleteAdminOffer);

// ----- Feedback Experience (Admin) -----
router.get('/feedback-experiences', feedbackExperienceController.getFeedbackExperiences);
router.get('/contact-messages', feedbackExperienceController.getFeedbackExperiences);
router.delete('/feedback-experiences/:id', feedbackExperienceController.deleteFeedbackExperience);

// ----- Fee Settings -----
router.get('/fee-settings', adminController.getFeeSettings);
router.put('/fee-settings', adminController.createOrUpdateFeeSettings);

// ----- Referral Settings -----
router.get('/referral-settings', adminController.getReferralSettings);
router.put('/referral-settings', adminController.createOrUpdateReferralSettings);

// ----- Business Settings -----
router.get('/business-settings/public', businessSettingsController.getBusinessSettings); // Public endpoint
router.get('/business-settings', businessSettingsController.getBusinessSettings);
router.patch('/business-settings', upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 }
]), businessSettingsController.updateBusinessSettings);
router.get('/power-scanning', businessSettingsController.getPowerScanningSettings);
router.patch('/power-scanning', businessSettingsController.updatePowerScanningSettings);

// ----- Coin Settings -----
router.get('/coin-settings', coinSettingsController.getCoinSettings);
router.patch('/coin-settings', coinSettingsController.updateCoinSettings);
router.get('/coin-requests', coinRedemptionController.getCoinRequests);
router.patch('/coin-requests/:id/verify', coinRedemptionController.verifyCoinRequest);

// ----- Zones -----
router.get(
    '/zones',
    requireAnyAdminPermission([
        { section: 'dashboard', action: 'view' },
        { section: 'zone_management', action: 'view' },
        { section: 'restaurant_management', action: 'view' },
        { section: 'point_of_sale', action: 'view' },
        { section: 'food_management', action: 'view' },
        { section: 'delivery_management', action: 'view' },
        { section: 'report_management', action: 'view' },
    ]),
    adminController.getZones
);
router.get(
    '/zones/:id',
    requireAnyAdminPermission([
        { section: 'dashboard', action: 'view' },
        { section: 'zone_management', action: 'view' },
        { section: 'restaurant_management', action: 'view' },
        { section: 'point_of_sale', action: 'view' },
        { section: 'food_management', action: 'view' },
        { section: 'delivery_management', action: 'view' },
        { section: 'report_management', action: 'view' },
    ]),
    adminController.getZoneById
);
router.post('/zones', adminController.createZone);
router.patch('/zones/:id', adminController.updateZone);
router.delete('/zones/:id', adminController.deleteZone);

// ----- Global Orders -----
router.get(
    '/global-orders',
    requireAnyAdminPermission([
        { section: 'order_management', action: 'view' },
        { section: 'dashboard', action: 'view' },
    ]),
    adminGlobalOrdersController.getGlobalOrders
);

// ----- Orders -----
router.get(
    '/orders',
    requireAnyAdminPermission([
        { section: 'order_management', action: 'view' },
        { section: 'report_management', action: 'view' },
    ]),
    orderController.listOrdersAdminController
);
router.get('/orders/:orderId', orderController.getOrderByIdAdminController);
router.patch('/orders/:orderId/accept', orderController.acceptOrderAdminController);
router.patch('/orders/:orderId/reject', orderController.rejectOrderAdminController);
router.put('/orders/:orderId/status', orderController.updateOrderStatusAdminController);
router.post('/orders/:orderId/refund', orderController.processRefundAdminController);
router.delete('/orders/:orderId', orderController.deleteOrderAdminController);

// ----- CMS Pages (About + legal) -----
router.get('/pages-social-media/:key', getAdminPageController);
router.put('/pages-social-media/:key', upsertAdminPageController);

// ----- Wallet & Transactions -----
router.post('/wallet/add-fund', adminWalletController.addFundToCustomer);
router.get('/wallet/bonuses', adminWalletController.getWalletBonuses);
router.post('/wallet/bonuses', adminWalletController.createWalletBonus);
router.patch('/wallet/bonuses/:id', adminWalletController.updateWalletBonus);
router.delete('/wallet/bonuses/:id', adminWalletController.deleteWalletBonus);
router.patch('/wallet/bonuses/:id/status', adminWalletController.toggleWalletBonusStatus);
router.get('/wallet/withdraw-methods', adminWalletController.getWithdrawMethods);
router.post('/wallet/withdraw-methods', adminWalletController.createWithdrawMethod);
router.patch('/wallet/withdraw-methods/:id', adminWalletController.updateWithdrawMethod);
router.delete('/wallet/withdraw-methods/:id', adminWalletController.deleteWithdrawMethod);
router.patch('/wallet/withdraw-methods/:id/status', adminWalletController.toggleWithdrawMethodStatus);

// ----- Restaurant Management (Admin) -----
router.get('/restaurants/pending', adminController.getPendingRestaurants);
router.get('/restaurants/unregistered', adminController.getUnregisteredRestaurants);
router.delete('/restaurants/unregistered/:id', adminController.deleteUnregisteredRestaurant);
router.get('/restaurants/complaints', adminController.getRestaurantComplaints);
router.patch('/restaurants/complaints/:id', adminController.updateRestaurantComplaint);
router.patch('/restaurants/:id/approve', adminController.approveRestaurant);
router.patch('/restaurants/:id/reject', adminController.rejectRestaurant);
router.get('/restaurant-subscription-settings', adminController.getRestaurantSubscriptionSettings);
router.patch('/restaurant-subscription-settings', adminController.updateRestaurantSubscriptionSettings);
router.get('/restaurant-subscriptions/history', adminController.getRestaurantSubscriptionHistory);
router.post('/restaurants', adminController.createRestaurant);
router.get('/restaurants', adminController.getRestaurants);
router.get('/restaurants/reviews', adminController.getRestaurantReviews);
router.get('/restaurants/:id', adminController.getRestaurantById);
router.patch('/restaurants/:id', adminController.updateRestaurantById);
router.delete('/restaurants/:id', adminController.deleteRestaurant);

// ----- Restaurant Commissions -----
router.get('/restaurant-commissions', adminController.getRestaurantCommissions);
router.get('/restaurant-commissions/bootstrap', adminController.getRestaurantCommissionBootstrap);
router.get('/restaurant-commissions/:id', adminController.getRestaurantCommissionById);
router.post('/restaurant-commissions', adminController.createRestaurantCommission);
router.patch('/restaurant-commissions/:id', adminController.updateRestaurantCommission);
router.delete('/restaurant-commissions/:id', adminController.deleteRestaurantCommission);
router.patch('/restaurant-commissions/:id/status', adminController.toggleRestaurantCommissionStatus);
router.patch('/restaurant-commissions/:id/toggle', adminController.toggleRestaurantCommissionStatus);

router.get('/sidebar-badges', adminController.getSidebarBadges);

export default router;
