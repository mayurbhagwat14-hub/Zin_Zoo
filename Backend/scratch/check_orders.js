import mongoose from 'mongoose';
import { config } from './src/config/env.js';

async function checkOrders() {
    await mongoose.connect(config.db.url);
    console.log("Connected to DB");
    
    const db = mongoose.connection.db;
    
    const groceryOrders = await db.collection('groceryorders').find({}).sort({createdAt: -1}).limit(5).toArray();
    console.log("Latest GroceryOrders:", groceryOrders.map(o => ({ _id: o._id, moduleType: o.moduleType, customerName: o.customerName })));

    const foodOrders = await db.collection('foodorders').find({}).sort({createdAt: -1}).limit(5).toArray();
    console.log("Latest FoodOrders:", foodOrders.map(o => ({ _id: o._id, moduleType: o.moduleType, customerName: o.customerName })));
    
    await mongoose.disconnect();
}

checkOrders().catch(console.error);
