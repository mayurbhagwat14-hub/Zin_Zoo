// gourmet service import removed
import { getLandingSettings } from '../services/landingSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { FoodAccessoriesBanner } from '../models/accessoriesBanner.model.js';
// dining banner model import removed
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { HomePromotionBanner } from '../models/homePromotionBanner.model.js';
import { getPublicHomePromotionBanners } from '../services/homePromotionBanner.service.js';
const FoodRestaurant = mongoose.models.FoodRestaurant || mongoose.model('FoodRestaurant', new mongoose.Schema({}, { strict: false, collection: 'food_restaurants' }));
import TopBanner from '../models/topBanner.model.js';
import { sendResponse } from '../../../../utils/response.js';
import mongoose from 'mongoose';

/** Public hero banners for user home: active only, sorted, with category populated for click-through */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        let docs = await FoodHeroBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .lean();

        // If no hero banners found, fallback to TopBanner
        if (!docs || docs.length === 0) {
            const topDocs = await TopBanner.find({ isActive: true }).sort('order').lean();
            if (topDocs && topDocs.length > 0) {
                docs = topDocs.map(t => ({
                    ...t,
                    imageUrl: t.image || t.imageUrl,
                    sortOrder: t.order || 0
                }));
            }
        }

        const banners = (docs || []).map((b) => {
            const catName = b.categoryName || '';
            const catSlug = b.categorySlug || (catName ? String(catName).toLowerCase().trim().replace(/\s+/g, '-') : '');
            return {
                ...b,
                linkedRestaurants: b.linkedRestaurants || [],
                imageUrl: b.imageUrl || b.image,
                categoryId: b.categoryId || null,
                categoryName: catName,
                categorySlug: catSlug
            };
        });
        return sendResponse(res, 200, 'Hero banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicTopBannersController = async (req, res, next) => {
    try {
        const docs = await TopBanner.find({ isActive: true }).sort('order').lean();
        const banners = (docs || []).map((b) => {
            const catName = b.categoryName || '';
            const catSlug = b.categorySlug || (catName ? String(catName).toLowerCase().trim().replace(/\s+/g, '-') : '');
            return {
                ...b,
                imageUrl: b.image || b.imageUrl,
                categoryId: b.categoryId || null,
                categoryName: catName,
                categorySlug: catSlug
            };
        });
        return sendResponse(res, 200, 'Top banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicUnder250BannersController = async (req, res, next) => {
    try {
        const docs = await FoodUnder250Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Under 250 banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicAccessoriesBannersController = async (req, res, next) => {
    try {
        const docs = await FoodAccessoriesBanner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Accessories banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicDiningBannersController = async (req, res, next) => {
    try {
        return sendResponse(res, 200, 'Dining banners fetched', { banners: [] });
    } catch (error) {
        next(error);
    }
};

export const getPublicExploreIconsController = async (req, res, next) => {
    try {
        const docs = await FoodExploreIcon.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const items = docs.map(({ targetPath, sortOrder, ...rest }) => ({ ...rest, link: targetPath, order: sortOrder }));
        return sendResponse(res, 200, 'Explore icons fetched', { items });
    } catch (error) {
        next(error);
    }
};

export const getPublicHomePromotionBannersController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const banners = await getPublicHomePromotionBanners(zoneId);
        return sendResponse(res, 200, 'Home promotion banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicGourmetController = async (req, res, next) => {
    try {
        return sendResponse(res, 200, 'Gourmet restaurants fetched', { restaurants: [] });
    } catch (error) {
        next(error);
    }
};

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const settings = await getLandingSettings();
        const ids = settings?.recommendedRestaurantIds || [];
        let recommendedRestaurants = [];
        if (Array.isArray(ids) && ids.length > 0) {
            const query = { _id: { $in: ids }, status: 'approved' };
            if (zoneId && mongoose.Types.ObjectId.isValid(zoneId)) {
                query.zoneId = new mongoose.Types.ObjectId(zoneId);
            }
            recommendedRestaurants = await FoodRestaurant.find(query)
                .select('restaurantName area city profileImage coverImages menuImages slug rating cuisines pureVegRestaurant zoneId')
                .lean();
        }
        const payload = {
            ...settings,
            recommendedRestaurantIds: undefined,
            recommendedRestaurants
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};

/**
 * Validate current stock for food item, grocery product, or accessory product in real-time
 */
export const validateStockController = async (req, res, next) => {
    try {
        const { itemId, moduleType } = req.query;
        if (!itemId || !mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ success: false, message: 'Invalid item ID' });
        }

        const type = moduleType || 'food';
        let stock = 0;
        let isAvailable = false;

        if (type === 'food') {
            const { FoodItem } = await import('../../admin/models/food.model.js');
            const item = await FoodItem.findById(itemId).lean();
            if (item) {
                stock = item.quantity || 0;
                isAvailable = item.isAvailable !== false && item.approvalStatus === 'approved';
            }
        } else if (type === 'grocery') {
            const { GroceryProduct } = await import('../../admin/models/groceryProduct.model.js');
            const item = await GroceryProduct.findById(itemId).lean();
            if (item) {
                stock = item.quantity || 0;
                isAvailable = item.isActive !== false;
            }
        } else if (type === 'accessories') {
            const { AccessoriesProduct } = await import('../../../accessories/models/accessoriesProduct.model.js');
            const item = await AccessoriesProduct.findById(itemId).lean();
            if (item) {
                stock = item.quantity || 0;
                isAvailable = item.isActive !== false;
            }
        }

        return res.status(200).json({
            success: true,
            itemId,
            moduleType: type,
            stock: isAvailable ? Math.max(0, stock) : 0,
            isAvailable
        });
    } catch (error) {
        next(error);
    }
};

