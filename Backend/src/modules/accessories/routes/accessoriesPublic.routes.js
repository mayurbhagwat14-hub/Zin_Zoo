import express from 'express';
import * as publicController from '../controllers/accessoriesPublic.controller.js';

const router = express.Router();

router.get('/categories', publicController.getCategories);
router.get('/products', publicController.getProducts);

export default router;
