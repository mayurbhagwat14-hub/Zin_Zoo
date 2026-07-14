import mongoose from 'mongoose';
import { FoodItem } from '../src/modules/food/admin/models/food.model.js';

async function run() {
    await mongoose.connect('mongodb+srv://zinzoox99_db_user:zinzoo123@zinzoo.tzwv8he.mongodb.net/zinzoo', {});
    const items = await FoodItem.find({ name: { $in: ['pulao', 'Dal bati', 'Ehbw', 'palin Dhosa', 'special Dhosa', 'Dhosa'] } }).select('name categoryName categoryId').lean();
    console.log(items);
    process.exit(0);
}

run().catch(console.error);
