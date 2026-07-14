import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from './src/config/db.js';
import { GroceryOrder } from './src/modules/food/orders/models/groceryOrder.model.js';
import { FoodTransaction } from './src/modules/food/orders/models/foodTransaction.model.js';
import * as foodTransactionService from './src/modules/food/orders/services/foodTransaction.service.js';

async function run() {
    await connectDB();
    console.log("Database connected successfully.");

    // Retrieve all grocery & accessories orders
    const orders = await GroceryOrder.find({});
    console.log(`Found ${orders.length} grocery/accessories orders in database.`);

    let createdCount = 0;
    for (const order of orders) {
        // Check if transaction already exists
        const existingTx = await FoodTransaction.findOne({ orderId: order._id });
        if (!existingTx) {
            console.log(`Creating transaction for order ${order.order_id || order._id} (${order.moduleType})...`);
            await foodTransactionService.createInitialTransaction(order);
            createdCount++;
        }
    }

    console.log(`Migration complete. Created ${createdCount} transaction records.`);
    await disconnectDB();
}

run().catch(async (err) => {
    console.error("Migration failed:", err);
    await mongoose.disconnect();
});
