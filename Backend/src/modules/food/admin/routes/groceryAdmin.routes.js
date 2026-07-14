import express from 'express';
import * as groceryAdminController from '../controllers/groceryAdmin.controller.js';
// Add any auth middlewares here if needed, like requireAdminAuth

const router = express.Router();

// Categories
router.get('/categories', groceryAdminController.getCategories);
router.post('/categories', groceryAdminController.createCategory);
router.put('/categories/:id', groceryAdminController.updateCategory);
router.delete('/categories/:id', groceryAdminController.deleteCategory);

// Products
router.get('/products', groceryAdminController.getProducts);
router.post('/products', groceryAdminController.createProduct);
router.put('/products/:id', groceryAdminController.updateProduct);
router.delete('/products/:id', groceryAdminController.deleteProduct);

// Orders
router.get('/orders', groceryAdminController.getOrders);
router.get('/orders/:id', groceryAdminController.getOrderById);
router.put('/orders/:id/status', groceryAdminController.updateOrderStatus);

// Seed Data
router.post('/seed', groceryAdminController.seedGroceryData);

export default router;
