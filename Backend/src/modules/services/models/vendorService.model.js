import mongoose from 'mongoose';

const vendorServiceSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Service name is required'],
            trim: true
        },
        image: {
            type: String,
            default: ''
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true
        },
        subCategory: {
            type: String,
            trim: true
        },
        basePrice: {
            type: Number,
            required: [true, 'Base price is required'],
            min: 0
        },
        description: {
            type: String,
            default: '',
            trim: true
        },
        availableFrom: {
            type: String,
            required: [true, 'Available from time is required'],
            match: /^([01]\d|2[0-3]):([0-5]\d)$/ // HH:mm format
        },
        availableTo: {
            type: String,
            required: [true, 'Available to time is required'],
            match: /^([01]\d|2[0-3]):([0-5]\d)$/ // HH:mm format
        },
        provider: {
            type: String,
            default: 'Admin', // Defaulting to Admin for now as per simple setup
            trim: true
        }, 
        zoneId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'FoodZone',
            index: true,
            default: undefined
        },
        isActive: {
            type: Boolean,
            default: true
        }
    },
    {
        timestamps: true
    }
);

export const VendorService = mongoose.model('VendorService', vendorServiceSchema);
