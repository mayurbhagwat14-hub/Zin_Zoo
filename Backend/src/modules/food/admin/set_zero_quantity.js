import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

async function setZero() {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        await mongoose.connect(uri);
        console.log('Connected to DB.');

        const db = mongoose.connection.db;

        // Set Dal Makhani to quantity 0
        const res = await db.collection('food_items').updateOne(
            { name: "Dal Makhani" },
            { $set: { quantity: 0 } }
        );
        console.log('Updated Dal Makhani:', res.modifiedCount);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

setZero();
