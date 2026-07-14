import express from 'express';
import * as groceryController from '../controllers/grocery.controller.js';

const router = express.Router();

router.get('/categories', groceryController.getCategories);
router.get('/products', groceryController.getProducts);

export default router;
