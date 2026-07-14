import mongoose from 'mongoose';
import { AccessoriesCategory } from '../models/accessoriesCategory.model.js';
import { AccessoriesProduct } from '../models/accessoriesProduct.model.js';
import { broadcastPublicUpdate } from '../../../config/socket.js';

// ----- Categories -----
export async function getCategories(req, res, next) {
    try {
        const categories = await AccessoriesCategory.find().sort({ sortOrder: 1, createdAt: -1 }).lean();
        
        const categoryIds = categories.map(c => c._id);
        const productCounts = await AccessoriesProduct.aggregate([
            { $match: { categoryId: { $in: categoryIds } } },
            { $group: { _id: '$categoryId', count: { $sum: 1 } } }
        ]);
        
        const countMap = {};
        productCounts.forEach(pc => { countMap[pc._id.toString()] = pc.count; });
        
        const mappedCategories = categories.map(c => ({
            ...c,
            id: c._id.toString(),
            itemCount: countMap[c._id.toString()] || 0
        }));

        res.status(200).json({ success: true, message: 'Accessories categories fetched successfully', data: { categories: mappedCategories } });
    } catch (error) {
        next(error);
    }
}

export async function createCategory(req, res, next) {
    try {
        const category = await AccessoriesCategory.create(req.body);
        broadcastPublicUpdate('accessories:category:update', { action: 'create', data: category });
        res.status(201).json({ success: true, message: 'Category created successfully', data: { category } });
    } catch (error) {
        next(error);
    }
}

export async function updateCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category ID' });
        }
        const category = await AccessoriesCategory.findByIdAndUpdate(id, req.body, { new: true });
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        broadcastPublicUpdate('accessories:category:update', { action: 'update', data: category });
        res.status(200).json({ success: true, message: 'Category updated successfully', data: { category } });
    } catch (error) {
        next(error);
    }
}

export async function deleteCategory(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid category ID' });
        }
        const category = await AccessoriesCategory.findByIdAndDelete(id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        
        // Also delete related products
        await AccessoriesProduct.deleteMany({ categoryId: id });
        
        broadcastPublicUpdate('accessories:category:update', { action: 'delete', data: { _id: id } });
        res.status(200).json({ success: true, message: 'Category deleted successfully', data: { category } });
    } catch (error) {
        next(error);
    }
}

export async function toggleCategoryStatus(req, res, next) {
    try {
        const { id } = req.params;
        const category = await AccessoriesCategory.findById(id);
        if (!category) return res.status(404).json({ success: false, message: 'Category not found' });
        
        category.isActive = !category.isActive;
        await category.save();
        
        broadcastPublicUpdate('accessories:category:update', { action: 'update', data: category });
        res.status(200).json({ success: true, message: 'Category status toggled successfully', data: { category } });
    } catch (error) {
        next(error);
    }
}

// ----- Products -----
export async function getProducts(req, res, next) {
    try {
        const { categoryId, search, status } = req.query;
        let query = {};
        if (categoryId) query.categoryId = categoryId;
        if (status) query.isActive = status === 'active';
        if (search) query.name = { $regex: search, $options: 'i' };

        const products = await AccessoriesProduct.find(query)
            .populate('categoryId', 'name')
            .sort({ createdAt: -1 });

        const total = await AccessoriesProduct.countDocuments(query);

        res.status(200).json({ success: true, message: 'Accessories products fetched successfully', data: { products, total } });
    } catch (error) {
        next(error);
    }
}

export async function createProduct(req, res, next) {
    try {
        if (req.body.categoryId) {
            const cat = await AccessoriesCategory.findById(req.body.categoryId);
            if (cat) req.body.categoryName = cat.name;
        }
        const product = await AccessoriesProduct.create(req.body);
        broadcastPublicUpdate('accessories:product:update', { action: 'create', data: product });
        res.status(201).json({ success: true, message: 'Product created successfully', data: { product } });
    } catch (error) {
        next(error);
    }
}

export async function updateProduct(req, res, next) {
    try {
        const { id } = req.params;
        if (req.body.categoryId) {
            const cat = await AccessoriesCategory.findById(req.body.categoryId);
            if (cat) req.body.categoryName = cat.name;
        }
        const product = await AccessoriesProduct.findByIdAndUpdate(id, req.body, { new: true }).populate('categoryId', 'name');
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        broadcastPublicUpdate('accessories:product:update', { action: 'update', data: product });
        res.status(200).json({ success: true, message: 'Product updated successfully', data: { product } });
    } catch (error) {
        next(error);
    }
}

export async function deleteProduct(req, res, next) {
    try {
        const { id } = req.params;
        const product = await AccessoriesProduct.findByIdAndDelete(id);
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        broadcastPublicUpdate('accessories:product:update', { action: 'delete', data: { _id: id } });
        res.status(200).json({ success: true, message: 'Product deleted successfully', data: { product } });
    } catch (error) {
        next(error);
    }
}

export async function toggleProductStatus(req, res, next) {
    try {
        const { id } = req.params;
        const product = await AccessoriesProduct.findById(id).populate('categoryId', 'name');
        if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
        
        product.isActive = !product.isActive;
        await product.save();
        
        broadcastPublicUpdate('accessories:product:update', { action: 'update', data: product });
        res.status(200).json({ success: true, message: 'Product status toggled successfully', data: { product } });
    } catch (error) {
        next(error);
    }
}


// ----- Orders -----
export async function getOrders(req, res, next) {
    try {
        const { GroceryOrder } = await import('../../food/orders/models/groceryOrder.model.js');
        const query = req.query || {};
        const filter = { moduleType: 'accessories' };
        if (query.search) {
            filter.$or = [
                { orderId: { $regex: query.search, $options: 'i' } },
                { customerName: { $regex: query.search, $options: 'i' } }
            ];
        }
        if (query.status && query.status !== 'all') {
            const statusMap = {
                'pending': ['pending_payment', 'created', 'pending', 'confirmed'],
                'accepted': ['confirmed', 'accepted'],
                'processing': ['preparing', 'processing'],
                'out-for-delivery': ['picked_up', 'out_for_delivery'],
                'delivered': ['delivered'],
                'canceled': ['cancelled', 'cancelled_by_admin', 'cancelled_by_restaurant', 'cancelled_by_user', 'canceled']
            };
            const mappedStatuses = statusMap[query.status.toLowerCase()];
            if (mappedStatuses) {
                filter.orderStatus = { $in: mappedStatuses };
            }
        }
        
        const limit = parseInt(query.limit) || 20;
        const page = parseInt(query.page) || 1;
        const skip = (page - 1) * limit;
        
        const orders = await GroceryOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const total = await GroceryOrder.countDocuments(filter);
        
        res.status(200).json({ 
            success: true, 
            message: 'Accessories orders fetched successfully', 
            data: {
                orders: orders.map(o => ({
                    ...o,
                    id: o._id.toString()
                })),
                total,
                page,
                limit
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function getOrderById(req, res, next) {
    try {
        const { id } = req.params;
        const mongoose = (await import('mongoose')).default;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }
        const { GroceryOrder } = await import('../../food/orders/models/groceryOrder.model.js');
        const order = await GroceryOrder.findOne({ _id: id, moduleType: 'accessories' }).lean();
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        res.status(200).json({ success: true, message: 'Order fetched successfully', data: { order } });
    } catch (error) {
        next(error);
    }
}

export async function updateOrderStatus(req, res, next) {
    try {
        const { id } = req.params;
        const mongoose = (await import('mongoose')).default;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }
        const status = req.body?.status;
        if (!status) {
             return res.status(400).json({ success: false, message: 'Status is required' });
        }
        const { GroceryOrder } = await import('../../food/orders/models/groceryOrder.model.js');
        const order = await GroceryOrder.findOneAndUpdate(
            { _id: id, moduleType: 'accessories' },
            { $set: { orderStatus: status } },
            { new: true, runValidators: true }
        );
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        
        // Also broadcast update
        const { broadcastPublicUpdate, broadcastOrderUpdateToAdmin } = await import('../../../config/socket.js');
        broadcastPublicUpdate('accessories:order:update', { action: 'update', data: order });
        broadcastOrderUpdateToAdmin(id);
        
        res.status(200).json({ success: true, message: 'Order status updated successfully', data: { order } });
    } catch (error) {
        next(error);
    }
}
