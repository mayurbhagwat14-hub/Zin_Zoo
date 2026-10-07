import express from 'express';
import { upload } from '../../../../middleware/upload.js';
import {
    listHeroBannersController,
    uploadHeroBannersController,
    deleteHeroBannerController,
    updateHeroBannerOrderController,
    toggleHeroBannerStatusController,
    updateHeroBannerCategoryController
} from '../controllers/heroBanner.controller.js';
import {
    listTopBannersController,
    uploadTopBannersController,
    deleteTopBannerController,
    updateTopBannerOrderController,
    toggleTopBannerStatusController,
    updateTopBannerCategoryController
} from '../controllers/topBanner.controller.js';
import {
    listUnder250BannersController,
    uploadUnder250BannersController,
    deleteUnder250BannerController,
    updateUnder250BannerOrderController,
    toggleUnder250BannerStatusController
} from '../controllers/under250Banner.controller.js';
import {
    listAccessoriesBannersController,
    uploadAccessoriesBannersController,
    deleteAccessoriesBannerController,
    updateAccessoriesBannerOrderController,
    toggleAccessoriesBannerStatusController
} from '../controllers/accessoriesBanner.controller.js';
// Dining banner imports removed (module deleted)
import {
    listHomePromotionBannersController,
    createHomePromotionBannerController,
    updateHomePromotionBannerController,
    deleteHomePromotionBannerController,
    toggleHomePromotionBannerStatusController,
    updateHomePromotionBannerOrderController
} from '../controllers/homePromotionBanner.controller.js';
import {
    getAdminLandingSettingsController,
    updateAdminLandingSettingsController,
    uploadLandingSettingsVideoController
} from '../controllers/landingSettings.controller.js';
import {
    listExploreMoreController,
    createExploreMoreController,
    updateExploreMoreController,
    deleteExploreMoreController,
    toggleExploreMoreStatusController,
    updateExploreMoreOrderController
} from '../controllers/exploreIcon.controller.js';
import {
    getPublicHeroBannersController,
    getPublicUnder250BannersController,
    getPublicAccessoriesBannersController,
    getPublicExploreIconsController,
    getPublicHomePromotionBannersController,
    getPublicGourmetController,
    getPublicLandingSettingsController,
    getPublicTopBannersController,
    validateStockController
} from '../controllers/publicLanding.controller.js';
import { detectZonePublicController, listZonesPublicController, listZonesNearbyPublicController } from '../controllers/zonePublic.controller.js';
// Gourmet controller imports removed (module deleted)
import { getPublicPageController } from '../../admin/controllers/pageContent.controller.js';
import { getPublicReferralSettingsController } from '../controllers/publicReferralSettings.controller.js';

const router = express.Router();

// Public CMS pages (About + legal). No auth required.
router.get('/pages/:key', getPublicPageController);
// Public referral settings (no auth required).
router.get('/referral-settings', getPublicReferralSettingsController);

// Admin hero banner management
router.get('/hero-banners', listHeroBannersController);
router.post(
    '/hero-banners/multiple',
    upload.array('files'),
    uploadHeroBannersController
);
router.delete('/hero-banners/:id', deleteHeroBannerController);
router.patch('/hero-banners/:id/order', updateHeroBannerOrderController);
router.patch('/hero-banners/:id/status', toggleHeroBannerStatusController);
router.patch('/hero-banners/:id/category', updateHeroBannerCategoryController);

// Admin top banners
router.get('/top-banners', listTopBannersController);
router.post(
    '/top-banners/multiple',
    upload.array('files'),
    uploadTopBannersController
);
router.delete('/top-banners/:id', deleteTopBannerController);
router.patch('/top-banners/:id/order', updateTopBannerOrderController);
router.patch('/top-banners/:id/status', toggleTopBannerStatusController);
router.patch('/top-banners/:id/category', updateTopBannerCategoryController);

// Admin under 250 banners
router.get('/hero-banners/under-250', listUnder250BannersController);
router.post(
    '/hero-banners/under-250/multiple',
    upload.array('files'),
    uploadUnder250BannersController
);
router.delete('/hero-banners/under-250/:id', deleteUnder250BannerController);
router.patch('/hero-banners/under-250/:id/order', updateUnder250BannerOrderController);
router.patch('/hero-banners/under-250/:id/status', toggleUnder250BannerStatusController);

// Admin accessories banners
router.get('/hero-banners/accessories', listAccessoriesBannersController);
router.post(
    '/hero-banners/accessories/multiple',
    upload.array('files'),
    uploadAccessoriesBannersController
);
router.delete('/hero-banners/accessories/:id', deleteAccessoriesBannerController);
router.patch('/hero-banners/accessories/:id/order', updateAccessoriesBannerOrderController);
router.patch('/hero-banners/accessories/:id/status', toggleAccessoriesBannerStatusController);

// Admin dining banners routes removed (module deleted)

// Admin Home Promotion banners
router.get('/hero-banners/home-promotion', listHomePromotionBannersController);
router.post(
    '/hero-banners/home-promotion',
    upload.single('file'),
    createHomePromotionBannerController
);
router.patch('/hero-banners/home-promotion/:id', updateHomePromotionBannerController);
router.delete('/hero-banners/home-promotion/:id', deleteHomePromotionBannerController);
router.patch('/hero-banners/home-promotion/:id/status', toggleHomePromotionBannerStatusController);
router.patch('/hero-banners/home-promotion/:id/order', updateHomePromotionBannerOrderController);

// Admin Explore More (icons)
router.get('/hero-banners/landing/explore-more', listExploreMoreController);
router.post(
    '/hero-banners/landing/explore-more',
    upload.single('image'),
    createExploreMoreController
);
router.delete('/hero-banners/landing/explore-more/:id', deleteExploreMoreController);
router.patch('/hero-banners/landing/explore-more/:id/status', toggleExploreMoreStatusController);
router.patch('/hero-banners/landing/explore-more/:id/order', updateExploreMoreOrderController);
router.patch(
    '/hero-banners/landing/explore-more/:id',
    upload.single('image'),
    updateExploreMoreController
);

// Admin Gourmet routes removed (module deleted)

// Public landing endpoints (Food user app)
router.get('/hero-banners/public', getPublicHeroBannersController);
router.get('/top-banners/public', getPublicTopBannersController);
router.get('/hero-banners/under-250/public', getPublicUnder250BannersController);
router.get('/hero-banners/accessories/public', getPublicAccessoriesBannersController);
router.get('/hero-banners/dining/public',
);
router.get('/explore-icons/public', getPublicExploreIconsController);
router.get('/hero-banners/home-promotion/public', getPublicHomePromotionBannersController);
router.get('/hero-banners/gourmet/public', getPublicGourmetController);
router.get('/landing/settings/public', getPublicLandingSettingsController);
router.get('/zones/detect', detectZonePublicController);
router.get('/zones/nearby', listZonesNearbyPublicController);
router.get('/zones/public', listZonesPublicController);
router.get('/stock/validate', validateStockController);
// Admin landing settings
router.get('/hero-banners/landing/settings', getAdminLandingSettingsController);
router.patch('/hero-banners/landing/settings', updateAdminLandingSettingsController);
router.post('/hero-banners/landing/settings/video', upload.single('videoFile'), uploadLandingSettingsVideoController);

export default router;
