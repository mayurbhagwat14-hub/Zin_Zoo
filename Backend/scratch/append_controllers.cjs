const fs = require('fs');
const path = require('path');

const filePath = 'c:/Users/hp/Desktop/GitDeployee/Zin_Zoo/backend/src/modules/accessories/controllers/accessoriesAdmin.controller.js';
const appendContent = `

// ----- Orders -----
export async function getOrders(req, res, next) {
    try {
        const { GroceryOrder } = await import('../../food/grocery/models/groceryOrder.model.js');
        const query = req.query || {};
        const filter = { moduleType: 'accessories' };
        if (query.search) {
            filter.$or = [
                { orderId: { $regex: query.search, $options: 'i' } },
                { customerName: { $regex: query.search, $options: 'i' } }
            ];
        }
        if (query.status && query.status !== 'all') {
            const statusMap = {
                'pending': ['pending_payment', 'created', 'pending'],
                'accepted': ['confirmed', 'accepted'],
                'processing': ['preparing', 'processing'],
                'out-for-delivery': ['picked_up', 'out_for_delivery'],
                'delivered': ['delivered'],
                'canceled': ['cancelled', 'cancelled_by_admin', 'cancelled_by_restaurant', 'cancelled_by_user', 'canceled']
            };
            const mappedStatuses = statusMap[query.status.toLowerCase()];
            if (mappedStatuses) {
                filter.orderStatus = { $in: mappedStatuses };
            }
        }
        
        const limit = parseInt(query.limit) || 20;
        const page = parseInt(query.page) || 1;
        const skip = (page - 1) * limit;
        
        const orders = await GroceryOrder.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();
            
        const total = await GroceryOrder.countDocuments(filter);
        
        res.status(200).json({ 
            success: true, 
            message: 'Accessories orders fetched successfully', 
            data: {
                orders: orders.map(o => ({
                    ...o,
                    id: o._id.toString()
                })),
                total,
                page,
                limit
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function getOrderById(req, res, next) {
    try {
        const { id } = req.params;
        const mongoose = (await import('mongoose')).default;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }
        const { GroceryOrder } = await import('../../food/grocery/models/groceryOrder.model.js');
        const order = await GroceryOrder.findOne({ _id: id, moduleType: 'accessories' }).lean();
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        res.status(200).json({ success: true, message: 'Order fetched successfully', data: { order } });
    } catch (error) {
        next(error);
    }
}

export async function updateOrderStatus(req, res, next) {
    try {
        const { id } = req.params;
        const mongoose = (await import('mongoose')).default;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }
        const status = req.body?.status;
        if (!status) {
             return res.status(400).json({ success: false, message: 'Status is required' });
        }
        const { GroceryOrder } = await import('../../food/grocery/models/groceryOrder.model.js');
        const order = await GroceryOrder.findOneAndUpdate(
            { _id: id, moduleType: 'accessories' },
            { $set: { orderStatus: status } },
            { new: true, runValidators: true }
        );
        if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
        
        // Also broadcast update
        const { broadcastPublicUpdate } = await import('../../../config/socket.js');
        broadcastPublicUpdate('accessories:order:update', { action: 'update', data: order });
        
        res.status(200).json({ success: true, message: 'Order status updated successfully', data: { order } });
    } catch (error) {
        next(error);
    }
}
`;

fs.appendFileSync(filePath, appendContent);
console.log("Appended successfully");
