const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to DB");
    
    const Order = mongoose.model('FoodOrder', new mongoose.Schema({}, { strict: false }), 'food_orders');
    const GroceryOrder = mongoose.model('GroceryOrder', new mongoose.Schema({}, { strict: false }), 'grocery_orders');
    const TransactionReal = mongoose.model('FoodTransactionReal', new mongoose.Schema({}, { strict: false }), 'food_transactions');
    
    const orderCount = await Order.countDocuments({});
    console.log(`Total orders in food_orders collection: ${orderCount}`);
    
    const groceryOrderCount = await GroceryOrder.countDocuments({});
    console.log(`Total orders in grocery_orders collection: ${groceryOrderCount}`);
    
    const ordersByType = await GroceryOrder.aggregate([
        { $group: { _id: "$moduleType", count: { $sum: 1 } } }
    ]);
    console.log("Grocery/Accessories Orders by moduleType:", ordersByType);
    
    const txCount = await TransactionReal.countDocuments({});
    console.log(`Total transactions in food_transactions collection: ${txCount}`);
    
    const txsByStatus = await TransactionReal.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } }
    ]);
    console.log("Transactions by status:", txsByStatus);

    await mongoose.disconnect();
}

run().catch(console.error);
