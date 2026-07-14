import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function verifyDeduct() {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log('Connected to DB.');

        const db = mongoose.connection.db;

        // 1. Check Food Item "Shreekhand"
        const foodBefore = await db.collection('food_items').findOne({ name: "Shreekhand" });
        if (foodBefore) {
            console.log('Shreekhand quantity BEFORE mock deduct:', foodBefore.quantity);
            
            // Deduct by 2
            await db.collection('food_items').updateOne(
                { _id: foodBefore._id },
                { $inc: { quantity: -2 } }
            );

            const foodAfter = await db.collection('food_items').findOne({ _id: foodBefore._id });
            console.log('Shreekhand quantity AFTER mock deduct:', foodAfter.quantity);
        } else {
            console.log('Shreekhand food item not found');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

verifyDeduct();
