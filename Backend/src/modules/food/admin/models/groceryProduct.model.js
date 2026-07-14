import mongoose from 'mongoose';

const groceryProductSchema = new mongoose.Schema(
    {
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryCategory', index: true },
        categoryName: { type: String, trim: true, default: '' },
        name: { type: String, required: true, trim: true, index: true },
        description: { type: String, trim: true, default: '' },
        price: { type: Number, required: true, min: 0 },
        unit: { type: String, trim: true, default: '1 pc' }, // e.g., '1 kg', '500g', '1 Litre'
        stock: { type: Number, default: 0, min: 0, index: true },
        image: { type: String, trim: true, default: '' },
        isActive: { type: Boolean, default: true, index: true },
        isRecommended: { type: Boolean, default: false, index: true },
        /**
         * Optional zone binding.
         * - When set: product is visible only for that zone.
         * - When null/undefined: product is global (visible for all zones).
         */
        zoneId: { type: mongoose.Schema.Types.ObjectId, ref: 'FoodZone', index: true, default: undefined },
        quantity: { type: Number, default: 0 }
    },
    {
        collection: 'grocery_products',
        timestamps: true
    }
);

export const GroceryProduct = mongoose.model('GroceryProduct', groceryProductSchema);
