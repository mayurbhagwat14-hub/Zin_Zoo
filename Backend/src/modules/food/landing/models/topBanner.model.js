import mongoose from 'mongoose';

const topBannerSchema = new mongoose.Schema({
    image: {
        type: String,
        required: true,
    },
    publicId: {
        type: String,
    },
    order: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FoodCategory',
        default: null
    },
    categoryName: {
        type: String,
        trim: true,
        default: ''
    },
    categorySlug: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

const TopBanner = mongoose.model('TopBanner', topBannerSchema);

export default TopBanner;
