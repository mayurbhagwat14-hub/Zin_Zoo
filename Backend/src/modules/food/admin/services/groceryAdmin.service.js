import { GroceryCategory } from '../models/groceryCategory.model.js';
import { GroceryProduct } from '../models/groceryProduct.model.js';
import { GroceryOrder } from '../../orders/models/groceryOrder.model.js';
import mongoose from 'mongoose';

// ----- Grocery Categories -----
export async function getGroceryCategories(query = {}) {
    const filter = {};
    if (query.search) {
        filter.name = { $regex: query.search, $options: 'i' };
    }
    if (query.status) {
        filter.isActive = query.status === 'active';
    }
    
    const categories = await GroceryCategory.find(filter)
        .sort({ sortOrder: 1, createdAt: -1 })
        .lean();
        
    // Optionally count products per category
    const categoryIds = categories.map(c => c._id);
    const productCounts = await GroceryProduct.aggregate([
        { $match: { categoryId: { $in: categoryIds } } },
        { $group: { _id: '$categoryId', count: { $sum: 1 } } }
    ]);
    
    const countMap = {};
    productCounts.forEach(pc => { countMap[pc._id.toString()] = pc.count; });
    
    return categories.map(c => ({
        ...c,
        id: c._id.toString(),
        itemsCount: countMap[c._id.toString()] || 0
    }));
}

export async function createGroceryCategory(data) {
    const category = new GroceryCategory({
        name: data.name,
        image: data.image,
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder || 0
    });
    await category.save();
    return category;
}

export async function updateGroceryCategory(id, data) {
    return await GroceryCategory.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
    );
}

export async function deleteGroceryCategory(id) {
    return await GroceryCategory.findByIdAndDelete(id);
}

// ----- Grocery Products -----
export async function getGroceryProducts(query = {}) {
    const filter = {};
    if (query.search) {
        filter.name = { $regex: query.search, $options: 'i' };
    }
    if (query.categoryId) {
        filter.categoryId = query.categoryId;
    }
    
    const limit = parseInt(query.limit) || 20;
    const page = parseInt(query.page) || 1;
    const skip = (page - 1) * limit;
    
    const products = await GroceryProduct.find(filter)
        .populate('categoryId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
        
    const total = await GroceryProduct.countDocuments(filter);
    
    return {
        products: products.map(p => ({
            ...p,
            id: p._id.toString(),
            categoryName: p.categoryId?.name || p.categoryName || 'Unknown'
        })),
        total,
        page,
        limit
    };
}

export async function createGroceryProduct(data) {
    // Get category name
    if (data.categoryId) {
        const category = await GroceryCategory.findById(data.categoryId);
        if (category) data.categoryName = category.name;
    }
    const product = new GroceryProduct(data);
    await product.save();
    return product;
}

export async function updateGroceryProduct(id, data) {
    if (data.categoryId) {
        const category = await GroceryCategory.findById(data.categoryId);
        if (category) data.categoryName = category.name;
    }
    return await GroceryProduct.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
    );
}

export async function deleteGroceryProduct(id) {
    return await GroceryProduct.findByIdAndDelete(id);
}

// ----- Grocery Orders -----
export async function getGroceryOrders(query = {}) {
    const filter = { moduleType: 'grocery' };
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
    
    return {
        orders: orders.map(o => ({
            ...o,
            id: o._id.toString(),
        })),
        total,
        page,
        limit
    };
}

export async function getGroceryOrderById(id) {
    return await GroceryOrder.findById(id).lean();
}

export async function updateGroceryOrderStatus(id, status) {
    return await GroceryOrder.findByIdAndUpdate(
        id,
        { $set: { orderStatus: status } },
        { new: true }
    );
}
