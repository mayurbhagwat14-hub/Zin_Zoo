import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function fix() {
    await mongoose.connect(process.env.MONGODB_URI);
    const db = mongoose.connection.db;
    
    // Update the recent accessory order
    await db.collection('grocery_orders').updateOne(
        { _id: new mongoose.Types.ObjectId('6a44ede26ad8b220d2bf0d21') },
        { $set: { moduleType: 'accessories' } }
    );
    
    console.log('Updated accessory order');
    await mongoose.disconnect();
}

fix().catch(console.error);
