import TopBanner from '../models/topBanner.model.js';
import { uploadImageBufferDetailed, deleteLocalFile } from '../../../../services/localUpload.service.js';

export const listTopBannersController = async (req, res) => {
    try {
        const banners = await TopBanner.find().sort('order');
        res.status(200).json({ success: true, data: { banners } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch top banners', error: error.message });
    }
};

export const uploadTopBannersController = async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No images provided' });
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

        const uploadedBanners = [];
        const errors = [];

        for (const file of req.files) {
            try {
                const uploadResult = await uploadImageBufferDetailed(file.buffer, 'food/top-banners');

                // Find max order
                const maxOrderBanner = await TopBanner.findOne().sort('-order');
                const nextOrder = maxOrderBanner ? maxOrderBanner.order + 1 : 0;

                const newBanner = new TopBanner({
                    image: uploadResult.secure_url,
                    publicId: uploadResult.public_id,
                    order: nextOrder,
                    isActive: true,
                    categoryId: categoryId || null,
                    categoryName: categoryName || '',
                    categorySlug: categorySlug || ''
                });

                await newBanner.save();
                uploadedBanners.push(newBanner);
            } catch (err) {
                errors.push(`Failed to upload ${file.originalname}: ${err.message}`);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Top banners processed',
            data: { banners: uploadedBanners, errors }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
};

export const updateTopBannerCategoryController = async (req, res) => {
    try {
        let { categoryId, categoryName, categorySlug } = req.body;
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

        const banner = await TopBanner.findByIdAndUpdate(
            req.params.id,
            {
                categoryId: categoryId || null,
                categoryName: categoryName || '',
                categorySlug: categorySlug || ''
            },
            { new: true }
        );

        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        res.status(200).json({ success: true, message: 'Category updated', data: { banner } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update category', error: error.message });
    }
};

export const deleteTopBannerController = async (req, res) => {
    try {
        const banner = await TopBanner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }

        if (banner.image) {
            try {
                await deleteLocalFile(banner.image);
            } catch (err) {
                console.error("Local file deletion failed:", err.message);
            }
        }

        await TopBanner.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'Banner deleted successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to delete banner', error: error.message });
    }
};

export const updateTopBannerOrderController = async (req, res) => {
    try {
        const { order } = req.body;
        const banner = await TopBanner.findByIdAndUpdate(
            req.params.id,
            { order },
            { new: true }
        );
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }
        res.status(200).json({ success: true, message: 'Order updated', data: { banner } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update order', error: error.message });
    }
};

export const toggleTopBannerStatusController = async (req, res) => {
    try {
        const banner = await TopBanner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({ success: false, message: 'Banner not found' });
        }
        banner.isActive = !banner.isActive;
        await banner.save();
        res.status(200).json({ success: true, message: 'Status updated', data: { banner } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update status', error: error.message });
    }
};
