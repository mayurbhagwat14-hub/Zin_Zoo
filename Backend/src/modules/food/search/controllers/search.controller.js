import { searchUnified, getAdminCategories } from '../services/search.service.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

/**
 * Unified Search for Restaurants, Food Items, and Cuisines
 */
export const searchController = async (req, res, next) => {
    try {
        const { q, lat, lng, radiusKm, categoryId, minRating, maxDeliveryTime, isVeg, page, limit, zoneId } = req.query;
        console.log(`[Search-Debug] q="${q}", catId="${categoryId}", zone="${zoneId}", coords=[${lat}, ${lng}]`);

        const results = await searchUnified({
            q,
            lat,
            lng,
            radiusKm,
            categoryId,
            minRating,
            maxDeliveryTime,
            isVeg,
            page: parseInt(page) || 1,
            limit: parseInt(limit) || 20,
            zoneId
        });

        return sendResponse(res, 200, 'Search results fetched successfully', results.data);
    } catch (error) {
        next(error);
    }
};

export const listAdminCategoriesController = async (req, res, next) => {
    try {
        const { zoneId } = req.query;
        const categories = await getAdminCategories({ zoneId });
        
        return sendResponse(res, 200, 'Admin categories fetched successfully', { categories });
    } catch (error) {
        next(error);
    }
};

import mongoose from 'mongoose';
import { FoodItem } from '../../admin/models/food.model.js';

export const listPublicFoodsController = async (req, res, next) => {
    try {
        const { categoryId, search, page = 1, limit = 20 } = req.query;
        const filter = { isAvailable: true };
        
        if (categoryId && mongoose.Types.ObjectId.isValid(categoryId)) {
            filter.categoryId = new mongoose.Types.ObjectId(categoryId);
        }
        
        if (search) {
            const term = String(search).trim();
            if (term) {
                filter.name = { $regex: new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
            }
        }
        
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);
        
        const [foods, total] = await Promise.all([
            FoodItem.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            FoodItem.countDocuments(filter)
        ]);
        
        const formattedFoods = foods.map(f => ({
            _id: f._id,
            id: f._id,
            name: f.name,
            description: f.description || '',
            price: f.price,
            image: f.image || '',
            foodType: f.foodType || 'Non-Veg',
            isAvailable: f.isAvailable,
            preparationTime: f.preparationTime || '',
            quantity: f.quantity || 0,
            variants: f.variants || []
        }));
        
        return sendResponse(res, 200, 'Public foods fetched successfully', {
            foods: formattedFoods,
            total,
            page: parseInt(page),
            limit: limitNum
        });
    } catch (error) {
        next(error);
    }
};
