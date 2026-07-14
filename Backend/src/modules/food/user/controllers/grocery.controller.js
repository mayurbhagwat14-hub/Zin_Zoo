import mongoose from 'mongoose';
import { GroceryCategory } from '../../admin/models/groceryCategory.model.js';
import { GroceryProduct } from '../../admin/models/groceryProduct.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

/**
 * Get all active grocery categories
 */
export const getCategories = async (req, res) => {
    try {
        const categories = await GroceryCategory.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
        return sendResponse(res, 200, "Grocery categories fetched successfully", { categories });
    } catch (error) {
        console.error("Error fetching grocery categories:", error);
        return sendError(res, 500, "Failed to fetch grocery categories");
    }
};

/**
 * Get grocery products with optional filtering by category, search, and zone
 */
export const getProducts = async (req, res) => {
    try {
        const { categoryId, search, isRecommended, zoneId } = req.query;
        
        let query = { isActive: true };

        if (categoryId && mongoose.isValidObjectId(categoryId)) {
            query.categoryId = categoryId;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
        }

        if (isRecommended === 'true') {
            query.isRecommended = true;
        }

        if (zoneId && mongoose.isValidObjectId(zoneId)) {
            query.$or = [
                { zoneId: zoneId },
                { zoneId: null },
                { zoneId: { $exists: false } }
            ];
        }

        const products = await GroceryProduct.find(query).sort({ createdAt: -1 });

        return sendResponse(res, 200, "Grocery products fetched successfully", { products });
    } catch (error) {
        console.error("Error fetching grocery products:", error);
        return sendError(res, 500, "Failed to fetch grocery products");
    }
};
