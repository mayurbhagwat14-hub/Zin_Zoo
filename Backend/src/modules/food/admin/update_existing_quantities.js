import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function updateQuantities() {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        console.log('Connecting to:', uri);
        await mongoose.connect(uri);
        console.log('Connected to Database.');

        const db = mongoose.connection.db;

        // 1. Update food_items
        const foodRes = await db.collection('food_items').updateMany(
            { $or: [ { quantity: { $exists: false } }, { quantity: null }, { quantity: 0 } ] },
            { $set: { quantity: 50 } }
        );
        console.log('Food items updated:', foodRes.modifiedCount);

        // 2. Update grocery_products
        const groceryRes = await db.collection('grocery_products').updateMany(
            { $or: [ { quantity: { $exists: false } }, { quantity: null }, { quantity: 0 } ] },
            { $set: { quantity: 50 } }
        );
        console.log('Grocery products updated:', groceryRes.modifiedCount);

        // 3. Update accessories_products
        const accessoriesRes = await db.collection('accessories_products').updateMany(
            { $or: [ { quantity: { $exists: false } }, { quantity: null }, { quantity: 0 } ] },
            { $set: { quantity: 50 } }
        );
        console.log('Accessories products updated:', accessoriesRes.modifiedCount);

        process.exit(0);
    } catch (err) {
        console.error('Error updating quantities:', err);
        process.exit(1);
    }
}

updateQuantities();
