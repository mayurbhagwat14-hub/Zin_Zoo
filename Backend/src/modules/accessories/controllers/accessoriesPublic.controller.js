import { AccessoriesCategory } from '../models/accessoriesCategory.model.js';
import { AccessoriesProduct } from '../models/accessoriesProduct.model.js';

export async function getCategories(req, res, next) {
    try {
        const categories = await AccessoriesCategory.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
        res.status(200).json({ success: true, message: 'Accessories categories fetched successfully', data: { categories } });
    } catch (error) {
        next(error);
    }
}

export async function getProducts(req, res, next) {
    try {
        const { categoryId, isRecommended } = req.query;
        let query = { isActive: true };
        if (categoryId) query.categoryId = categoryId;
        if (isRecommended === 'true') query.isRecommended = true;

        const products = await AccessoriesProduct.find(query)
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 });

        res.status(200).json({ success: true, message: 'Accessories products fetched successfully', data: { products } });
    } catch (error) {
        next(error);
    }
}
