import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const restaurantSchema = new mongoose.Schema({}, { collection: 'food_restaurants', strict: false });
const FoodRestaurant = mongoose.models.FoodRestaurant || mongoose.model('FoodRestaurant', restaurantSchema);

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const list = await FoodRestaurant.find({}).select('restaurantName ownerName ownerPhone city status').lean();
        console.log('All restaurants count:', list.length);
        console.log('All restaurants list:');
        list.forEach((r, i) => {
            console.log(`${i+1}. ID: ${r._id}, Name: ${r.restaurantName}, Owner: ${r.ownerName}, Phone: ${r.ownerPhone}, Status: ${r.status}`);
        });
        await mongoose.disconnect();
    } catch (e) {
        console.error(e);
    }
}
check();
