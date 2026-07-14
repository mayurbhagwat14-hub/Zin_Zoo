import { FoodOrder } from '../../orders/models/order.model.js';
import { GroceryOrder } from '../../orders/models/groceryOrder.model.js';

const PENDING_ORDER_STATUSES = ['created', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up'];

export async function getGlobalOrders(req, res, next) {
    try {
        const { status } = req.query;

        let foodFilter = {};
        let groceryFilter = {};

        if (status === 'pending') {
            foodFilter.orderStatus = { $in: PENDING_ORDER_STATUSES };
            groceryFilter.orderStatus = { $in: PENDING_ORDER_STATUSES };
        } else if (status === 'completed') {
            foodFilter.orderStatus = 'delivered';
            groceryFilter.orderStatus = 'delivered';
        }

        const [foodOrders, groceryOrders] = await Promise.all([
            FoodOrder.find(foodFilter)
                .select('_id order_id orderId orderStatus customerName customerPhone pricing.total createdAt')
                .populate('userId', 'name phone email')
                .sort({ createdAt: -1 })
                .lean(),
            GroceryOrder.find(groceryFilter)
                .select('_id order_id orderId orderStatus customerName customerPhone pricing.total createdAt moduleType')
                .populate('userId', 'name phone email')
                .sort({ createdAt: -1 })
                .lean()
        ]);

        const formattedFoodOrders = foodOrders.map(order => ({
            ...order,
            category: 'Food',
            detailsPath: `/admin/food/orders/all?orderId=${order._id}` 
        }));

        const formattedGroceryOrders = groceryOrders.map(order => {
            const isAccessories = order.moduleType === 'accessories';
            return {
                ...order,
                category: isAccessories ? 'Accessories' : 'Grocery',
                detailsPath: isAccessories
                    ? `/admin/food/accessories-orders/all?orderId=${order._id}`
                    : `/admin/food/grocery-orders/all?orderId=${order._id}`
            };
        });

        const allOrders = [...formattedFoodOrders, ...formattedGroceryOrders].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.status(200).json({
            success: true,
            data: allOrders
        });
    } catch (error) {
        next(error);
    }
}
