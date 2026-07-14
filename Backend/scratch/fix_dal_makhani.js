import mongoose from 'mongoose';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';

async function run() {
    await mongoose.connect('mongodb+srv://zinzoox99_db_user:zinzoo123@zinzoo.tzwv8he.mongodb.net/zinzoo', {});
    const result = await FoodItem.updateMany(
        { name: 'Dal Makhani', restaurantId: { $exists: false } },
        { $set: { restaurantId: new mongoose.Types.ObjectId('6a27f832f887559e35c282a2') } }
    );
    console.log('Update result:', result);
    process.exit(0);
}

run().catch(console.error);
