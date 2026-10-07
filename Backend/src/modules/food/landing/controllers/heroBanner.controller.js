import {
    listHeroBanners,
    createHeroBannersFromFiles,
    deleteHeroBanner,
    updateHeroBannerOrder,
    toggleHeroBannerStatus,
    updateHeroBannerCategory
} from '../services/heroBanner.service.js';
import { sendResponse } from '../../../../utils/response.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import { broadcastPublicUpdate } from '../../../../config/socket.js';

export const listHeroBannersController = async (req, res, next) => {
    try {
        const data = await listHeroBanners();
        // Wrap in { banners } to match LandingPageManagement.jsx expectations
        return sendResponse(res, 200, 'Hero banners fetched successfully', { banners: data });
    } catch (error) {
        next(error);
    }
};

export const uploadHeroBannersController = async (req, res, next) => {
    try {
        if (!req.files || !req.files.length) {
            throw new ValidationError('No files uploaded');
        }

        let categoryName = req.body.categoryName || '';
        let categorySlug = req.body.categorySlug || '';
        let categoryId = req.body.categoryId || null;

        if (categoryId && (!categoryName || !categorySlug)) {
            try {
                const { FoodCategory } = await import('../../admin/models/category.model.js');
                const cat = await FoodCategory.findById(categoryId).lean();
                if (cat) {
                    categoryName = categoryName || cat.name || '';
                    categorySlug = categorySlug || (cat.name ? String(cat.name).toLowerCase().trim().replace(/\s+/g, '-') : '');
                }
            } catch (err) {
                // ignore
            }
        }

        const meta = {
            title: req.body.title,
            ctaText: req.body.ctaText,
            ctaLink: req.body.ctaLink,
            categoryId: categoryId || null,
            categoryName: categoryName || '',
            categorySlug: categorySlug || ''
        };

        const results = await createHeroBannersFromFiles(req.files, meta);
        broadcastPublicUpdate('banner:update', { action: 'create', section: 'hero', data: results });
        return sendResponse(res, 201, 'Hero banners uploaded', { results });
    } catch (error) {
        next(error);
    }
};

export const updateHeroBannerCategoryController = async (req, res, next) => {
    try {
        const { id } = req.params;
        let { categoryId, categoryName, categorySlug } = req.body;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }

        if (categoryId && (!categoryName || !categorySlug)) {
            try {
                const { FoodCategory } = await import('../../admin/models/category.model.js');
                const cat = await FoodCategory.findById(categoryId).lean();
                if (cat) {
                    categoryName = categoryName || cat.name || '';
                    categorySlug = categorySlug || (cat.name ? String(cat.name).toLowerCase().trim().replace(/\s+/g, '-') : '');
                }
            } catch (err) {
                // ignore
            }
        }

        const updated = await updateHeroBannerCategory(id, { categoryId, categoryName, categorySlug });
        broadcastPublicUpdate('banner:update', { action: 'update', section: 'hero', data: updated });
        return sendResponse(res, 200, 'Hero banner category updated', updated);
    } catch (error) {
        next(error);
    }
};

export const deleteHeroBannerController = async (req, res, next) => {
    try {
        const { id } = req.params;
        if (!id) {
            throw new ValidationError('Banner id is required');
        }
        const result = await deleteHeroBanner(id);
        broadcastPublicUpdate('banner:update', { action: 'delete', section: 'hero', data: { _id: id } });
        return sendResponse(res, 200, result.deleted ? 'Hero banner deleted' : 'Hero banner not found', result);
    } catch (error) {
        next(error);
    }
};

export const updateHeroBannerOrderController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { sortOrder } = req.body;
        if (!id || typeof sortOrder !== 'number') {
            throw new ValidationError('id and numeric sortOrder are required');
        }
        const updated = await updateHeroBannerOrder(id, sortOrder);
        broadcastPublicUpdate('banner:update', { action: 'reorder', section: 'hero', data: updated });
        return sendResponse(res, 200, 'Hero banner order updated', updated);
    } catch (error) {
        next(error);
    }
};

export const toggleHeroBannerStatusController = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        if (!id || typeof isActive !== 'boolean') {
            throw new ValidationError('id and boolean isActive are required');
        }
        const updated = await toggleHeroBannerStatus(id, isActive);
        broadcastPublicUpdate('banner:update', { action: 'toggle', section: 'hero', data: updated });
        return sendResponse(res, 200, 'Hero banner status updated', updated);
    } catch (error) {
        next(error);
    }
};

