import express from 'express';
import authRoutes from '../core/auth/auth.routes.js';
import landingRoutes from '../modules/food/landing/routes/landing.routes.js';
import restaurantRoutes from '../modules/food/restaurant/routes/restaurant.routes.js';
import uploadRoutes from '../modules/uploads/routes/upload.routes.js';
import restaurantAdminRoutes from '../modules/food/admin/routes/admin.routes.js';
import groceryAdminRoutes from '../modules/food/admin/routes/groceryAdmin.routes.js';
import groceryPublicRoutes from '../modules/food/user/routes/grocery.routes.js';
import servicesAdminRoutes from '../modules/services/routes/servicesAdmin.routes.js';
import servicesUserRoutes from '../modules/services/routes/servicesUser.routes.js';
import servicesPublicRoutes from '../modules/services/routes/servicesPublic.routes.js';
import userRoutes from '../modules/food/user/routes/user.routes.js';
import orderUserRoutes from '../modules/food/orders/routes/order.routes.user.js';
import accessoriesAdminRoutes from '../modules/accessories/routes/accessoriesAdmin.routes.js';
import accessoriesPublicRoutes from '../modules/accessories/routes/accessoriesPublic.routes.js';
import paymentRoutes from '../core/payments/payment.routes.js';
import fcmRoutes from '../core/notifications/fcm.routes.js';
import notificationRoutes from '../core/notifications/notification.routes.js';
import { authMiddleware } from '../core/auth/auth.middleware.js';
import * as businessSettingsController from '../modules/food/admin/controllers/businessSettings.controller.js';
import * as adminController from '../modules/food/admin/controllers/admin.controller.js';
import { requireRoles } from '../core/roles/role.middleware.js';
import { getQueuesController } from '../controllers/admin.controller.js';
import webhookRoutes from '../core/payments/routes/webhook.routes.js'; // ✅ NEW
import searchRoutes from '../modules/food/search/routes/search.routes.js';
import { submitPublicFeedback } from '../controllers/publicFeedback.controller.js';

const router = express.Router();

router.get('/v1/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'Server is healthy' });
});

// Food-prefixed auth routes (preferred)
router.use('/v1/food/auth', authRoutes);

// Backward-compatible auth routes (legacy)
router.use('/v1/auth', authRoutes);
// Landing & hero-banners for Food user app (paths start with /food/hero-banners/...)
router.use('/v1/food', landingRoutes);
router.use('/v1/food/restaurant', restaurantRoutes);
router.use('/v1/food/grocery', groceryPublicRoutes);
router.use('/v1/food/search', searchRoutes);
router.use('/v1/uploads', uploadRoutes);

// Public feedback endpoint (no auth - for QR code invoice feedback)
router.post('/v1/food/public/feedback', submitPublicFeedback);

// Mark business-settings/public as truly public (must be before protected admin block)
router.get('/v1/food/admin/business-settings/public', businessSettingsController.getBusinessSettings);
router.get('/v1/food/admin/power-scanning/public', businessSettingsController.getPowerScanningSettings);
router.get('/v1/food/admin/restaurant-subscription-settings/public', adminController.getRestaurantSubscriptionSettings);
router.get('/v1/food/admin/feature-settings/public', adminController.getFeatureSettings);
router.get('/v1/food/admin/fee-settings/public', adminController.getFeeSettings);

// 6. Food Admin API (Secured)
router.use('/v1/food/admin', authMiddleware, requireRoles('ADMIN'), restaurantAdminRoutes);

// 7. Grocery Admin API (Secured)
router.use('/v1/grocery/admin', authMiddleware, requireRoles('ADMIN'), groceryAdminRoutes);

// 8. Services Admin API (Secured)
router.use('/v1/services/admin', authMiddleware, requireRoles('ADMIN'), servicesAdminRoutes);

// 9. Services User API (Secured)
router.use('/v1/services/user', authMiddleware, requireRoles('USER'), servicesUserRoutes);

// 10. Services Public API
router.use('/v1/services/public', servicesPublicRoutes);

// 11. Accessories Admin API (Secured)
router.use('/v1/accessories/admin', authMiddleware, requireRoles('ADMIN'), accessoriesAdminRoutes);

// 12. Accessories Public API
router.use('/v1/accessories/public', accessoriesPublicRoutes);

router.use('/v1/food/user', authMiddleware, requireRoles('USER'), userRoutes);
router.use('/v1/food/notifications', authMiddleware, requireRoles('USER', 'RESTAURANT'), notificationRoutes);
router.use('/v1/food/orders', authMiddleware, requireRoles('USER'), orderUserRoutes);
router.use('/v1/food/payments', authMiddleware, paymentRoutes);
router.use('/v1/payments/webhook', webhookRoutes); // ✅ NEW: Public Webhook
router.use('/v1/fcm-tokens', fcmRoutes);
router.use('/fcm-tokens', fcmRoutes);

router.get('/v1/admin/queues', authMiddleware, requireRoles('ADMIN'), getQueuesController);

export default router;
