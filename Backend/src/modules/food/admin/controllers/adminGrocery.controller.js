import mongoose from 'mongoose';
import { GroceryCategory } from '../models/groceryCategory.model.js';
import { GroceryProduct } from '../models/groceryProduct.model.js';
import { GroceryOrder } from '../../orders/models/groceryOrder.model.js';

// ----- Grocery Categories -----
export async function getGroceryCategories(req, res, next) {
    try {
        const categories = await GroceryCategory.find().sort({ sortOrder: 1, createdAt: -1 });
        res.status(200).json({ success: true, message: 'Fetched categories', data: { categories } });
    } catch (error) {
        next(error);
    }
}

export async function createGroceryCategory(req, res, next) {
    try {
        const { name, image, zoneId, isActive, sortOrder } = req.body;
        const newCat = await GroceryCategory.create({ name, image, zoneId, isActive, sortOrder });
        res.status(201).json({ success: true, message: 'Category created', data: { category: newCat } });
    } catch (error) {
        next(error);
    }
}

export async function updateGroceryCategory(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await GroceryCategory.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Category not found' });
        res.status(200).json({ success: true, message: 'Category updated', data: { category: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteGroceryCategory(req, res, next) {
    try {
        const { id } = req.params;
        const deleted = await GroceryCategory.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Category not found' });
        res.status(200).json({ success: true, message: 'Category deleted', data: { category: deleted } });
    } catch (error) {
        next(error);
    }
}

// ----- Grocery Products -----
export async function getGroceryProducts(req, res, next) {
    try {
        const products = await GroceryProduct.find().populate('categoryId', 'name').sort({ createdAt: -1 });
        res.status(200).json({ success: true, message: 'Fetched products', data: { products } });
    } catch (error) {
        next(error);
    }
}

export async function createGroceryProduct(req, res, next) {
    try {
        const newProd = await GroceryProduct.create(req.body);
        res.status(201).json({ success: true, message: 'Product created', data: { product: newProd } });
    } catch (error) {
        next(error);
    }
}

export async function updateGroceryProduct(req, res, next) {
    try {
        const { id } = req.params;
        const updated = await GroceryProduct.findByIdAndUpdate(id, req.body, { new: true });
        if (!updated) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ success: true, message: 'Product updated', data: { product: updated } });
    } catch (error) {
        next(error);
    }
}

export async function deleteGroceryProduct(req, res, next) {
    try {
        const { id } = req.params;
        const deleted = await GroceryProduct.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ success: false, message: 'Product not found' });
        res.status(200).json({ success: true, message: 'Product deleted', data: { product: deleted } });
    } catch (error) {
        next(error);
    }
}

// ----- Grocery Orders -----
export async function getGroceryOrders(req, res, next) {
    try {
        const query = {};
        if (req.query.status) {
            const status = req.query.status;
            if (status === 'pending') {
                query.orderStatus = { $in: ['pending_payment', 'created', 'confirmed'] };
            } else if (status === 'delivered') {
                query.orderStatus = 'delivered';
            } else {
                query.orderStatus = status;
            }
        }

        const orders = await GroceryOrder.find(query).populate('userId', 'name email phone').sort({ createdAt: -1 });
        res.status(200).json({ success: true, message: 'Fetched grocery orders', data: { orders } });
    } catch (error) {
        next(error);
    }
}

// ----- Seed Dummy Data -----
export async function seedGroceryData(req, res, next) {
    try {
        // Clear existing for a clean state
        await GroceryCategory.deleteMany({});
        await GroceryProduct.deleteMany({});

        // Insert Categories
        const categories = await GroceryCategory.insertMany([
            { name: 'Fresh Fruits', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf', isActive: true, sortOrder: 1 },
            { name: 'Vegetables', image: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37', isActive: true, sortOrder: 2 },
            { name: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1628088062854-d1870b4553da', isActive: true, sortOrder: 3 },
            { name: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97', isActive: true, sortOrder: 4 }
        ]);

        const fruitCatId = categories.find(c => c.name === 'Fresh Fruits')._id;
        const vegCatId = categories.find(c => c.name === 'Vegetables')._id;
        const dairyCatId = categories.find(c => c.name === 'Dairy & Eggs')._id;

        // Insert Products
        await GroceryProduct.insertMany([
            { categoryId: fruitCatId, categoryName: 'Fresh Fruits', name: 'Organic Apples', description: 'Fresh sweet apples', price: 120, unit: '1 kg', stock: 50, image: 'https://images.unsplash.com/photo-1560806887-1e4cd0b6faa6', isActive: true, isRecommended: true },
            { categoryId: fruitCatId, categoryName: 'Fresh Fruits', name: 'Bananas', description: 'Yellow ripe bananas', price: 60, unit: '1 dozen', stock: 100, image: 'https://images.unsplash.com/photo-1603833665858-e61d17a86224', isActive: true, isRecommended: false },
            { categoryId: vegCatId, categoryName: 'Vegetables', name: 'Tomatoes', description: 'Red juicy tomatoes', price: 40, unit: '1 kg', stock: 200, image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea', isActive: true, isRecommended: true },
            { categoryId: vegCatId, categoryName: 'Vegetables', name: 'Onions', description: 'Fresh onions', price: 30, unit: '1 kg', stock: 300, image: 'https://images.unsplash.com/photo-1506807204940-d9d26bc1c277', isActive: true, isRecommended: false },
            { categoryId: dairyCatId, categoryName: 'Dairy & Eggs', name: 'Cow Milk', description: 'Fresh farm milk', price: 55, unit: '1 Litre', stock: 40, image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150', isActive: true, isRecommended: true }
        ]);

        res.status(200).json({ success: true, message: 'Dummy grocery data seeded successfully!' });
    } catch (error) {
        next(error);
    }
}
