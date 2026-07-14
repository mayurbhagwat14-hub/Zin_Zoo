import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const groceryCategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
}, { collection: 'grocery_categories', timestamps: true });

const groceryProductSchema = new mongoose.Schema({
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'GroceryCategory' },
    categoryName: { type: String, default: '' },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    price: { type: Number, required: true },
    unit: { type: String, default: '1 pc' },
    stock: { type: Number, default: 0 },
    image: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
    isRecommended: { type: Boolean, default: false },
}, { collection: 'grocery_products', timestamps: true });

const GroceryCategory = mongoose.model('GroceryCategory', groceryCategorySchema);
const GroceryProduct = mongoose.model('GroceryProduct', groceryProductSchema);

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await GroceryCategory.deleteMany({});
        await GroceryProduct.deleteMany({});
        console.log('Cleared existing grocery data');

        // Categories
        const categories = [
            { name: 'Fresh Vegetables', image: 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=500&auto=format&fit=crop&q=60' },
            { name: 'Dairy & Eggs', image: 'https://images.unsplash.com/photo-1550583724-b2692b85b150?w=500&auto=format&fit=crop&q=60' },
            { name: 'Snacks', image: 'https://images.unsplash.com/photo-1599490659213-e2b9527bd087?w=500&auto=format&fit=crop&q=60' },
            { name: 'Beverages', image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60' }
        ];

        const insertedCategories = await GroceryCategory.insertMany(categories);
        console.log('Inserted categories');

        const catMap = {};
        insertedCategories.forEach(cat => catMap[cat.name] = cat._id);

        // Products
        const products = [
            {
                categoryId: catMap['Fresh Vegetables'], categoryName: 'Fresh Vegetables',
                name: 'Farm Fresh Tomatoes', price: 40, unit: '1 kg', stock: 100, isRecommended: true,
                image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=500&auto=format&fit=crop&q=60'
            },
            {
                categoryId: catMap['Fresh Vegetables'], categoryName: 'Fresh Vegetables',
                name: 'Green Capsicum', price: 60, unit: '500 g', stock: 50,
                image: 'https://images.unsplash.com/photo-1563565375-f3fdfdbefa83?w=500&auto=format&fit=crop&q=60'
            },
            {
                categoryId: catMap['Dairy & Eggs'], categoryName: 'Dairy & Eggs',
                name: 'Amul Taaza Milk', price: 32, unit: '500 ml', stock: 200, isRecommended: true,
                image: 'https://plus.unsplash.com/premium_photo-1664302152996-2244af27df5e?w=500&auto=format&fit=crop&q=60'
            },
            {
                categoryId: catMap['Dairy & Eggs'], categoryName: 'Dairy & Eggs',
                name: 'Farm Eggs', price: 80, unit: '6 pcs', stock: 150,
                image: 'https://images.unsplash.com/photo-1587486913049-53fc88980bfc?w=500&auto=format&fit=crop&q=60'
            },
            {
                categoryId: catMap['Snacks'], categoryName: 'Snacks',
                name: 'Lays Classic Salted', price: 20, unit: '1 pc', stock: 300, isRecommended: true,
                image: 'https://images.unsplash.com/photo-1566478989037-eec170784d0b?w=500&auto=format&fit=crop&q=60'
            },
            {
                categoryId: catMap['Beverages'], categoryName: 'Beverages',
                name: 'Coca Cola', price: 40, unit: '750 ml', stock: 250,
                image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=500&auto=format&fit=crop&q=60'
            }
        ];

        await GroceryProduct.insertMany(products);
        console.log('Inserted products');

        process.exit(0);
    } catch (err) {
        console.error('Seeding failed:', err);
        process.exit(1);
    }
};

seedData();
