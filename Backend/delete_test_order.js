import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { connectDB, disconnectDB } from './src/config/db.js';
import { GroceryOrder } from './src/modules/food/orders/models/groceryOrder.model.js';
import { FoodTransaction } from './src/modules/food/orders/models/foodTransaction.model.js';

async function run() {
    await connectDB();
    console.log("Connected to DB");

    // Find the grocery order where order_id or orderId is "order_id"
    const order = await GroceryOrder.findOne({
        $or: [
            { order_id: "order_id" },
            { orderId: "order_id" }
        ]
    });

    if (!order) {
        console.log("No order found with ID 'order_id'");
    } else {
        console.log(`Found order with ID 'order_id'. Database ID: ${order._id}`);
        
        // Delete the order
        const orderDeleteRes = await GroceryOrder.deleteOne({ _id: order._id });
        console.log("Order deletion response:", orderDeleteRes);

        // Delete matching transaction(s)
        const txDeleteRes = await FoodTransaction.deleteMany({
            $or: [
                { orderId: order._id },
                { orderReadableId: "order_id" }
            ]
        });
        console.log("Transaction deletion response:", txDeleteRes);
    }

    await disconnectDB();
}

run().catch(async (err) => {
    console.error("Deletion script failed:", err);
    await mongoose.disconnect();
});
