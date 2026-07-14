import mongoose from 'mongoose';
import { FoodSupportTicket } from '../models/supportTicket.model.js';
import { sendResponse, sendError } from '../../../../utils/response.js';

export async function createSupportTicketController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const body = req.body || {};
        const type = String(body.type || '').trim();
        const issueType = String(body.issueType || '').trim();
        const description = String(body.description || '').trim();
        if (!['order', 'restaurant', 'other'].includes(type)) {
            return sendError(res, 400, 'Invalid ticket type');
        }
        if (!issueType) return sendError(res, 400, 'issueType required');
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return sendError(res, 401, 'Unauthorized or invalid user');
        }
        const doc = {
            userId: new mongoose.Types.ObjectId(userId),
            type,
            issueType,
            description
        };
        if (type === 'order') {
            if (!body.orderId || !mongoose.Types.ObjectId.isValid(body.orderId)) {
                return sendError(res, 400, 'orderId required');
            }
            const orderMongoId = new mongoose.Types.ObjectId(body.orderId);
            doc.orderId = orderMongoId;
            // Collect ALL restaurant IDs from the order (multi-restaurant support)
            const { FoodOrder } = await import('../../orders/models/order.model.js');
            const order = await FoodOrder.findById(orderMongoId).select('restaurantId restaurantIds items').lean();
            if (order) {
                const idSet = new Set();
                // From restaurantIds array (multi-restaurant orders)
                if (Array.isArray(order.restaurantIds)) {
                    order.restaurantIds.forEach(id => { if (id) idSet.add(String(id)); });
                }
                // From single restaurantId field
                if (order.restaurantId) {
                    idSet.add(String(order.restaurantId));
                }
                // From items array (each item may have its own restaurantId)
                if (Array.isArray(order.items)) {
                    order.items.forEach(item => { if (item?.restaurantId) idSet.add(String(item.restaurantId)); });
                }
                const allIds = [...idSet].map(id => new mongoose.Types.ObjectId(id));
                if (allIds.length > 0) {
                    doc.restaurantId = allIds[0]; // backward compat: first restaurant
                    doc.restaurantIds = allIds;   // full list
                }
            }
        }
        if (type === 'restaurant') {
            if (!body.restaurantId || !mongoose.Types.ObjectId.isValid(body.restaurantId)) {
                return sendError(res, 400, 'restaurantId required');
            }
            const rId = new mongoose.Types.ObjectId(body.restaurantId);
            doc.restaurantId = rId;
            doc.restaurantIds = [rId];
        }
        const created = await FoodSupportTicket.create(doc);

        // Real-time broadcast
        try {
            const { broadcastPublicUpdate } = await import('../../../../config/socket.js');
            const populatedTicket = await FoodSupportTicket.findById(created._id)
                .populate('userId', 'name phone email')
                .populate({ path: 'restaurantId', select: 'restaurantName city area' })
                .populate({ path: 'restaurantIds', select: 'restaurantName city area' })
                .populate({
                    path: 'orderId',
                    select: 'restaurantId restaurantIds items',
                    populate: { path: 'restaurantId', select: 'restaurantName city area' }
                })
                .lean();

            const user = populatedTicket.userId ? {
                _id: populatedTicket.userId._id,
                name: populatedTicket.userId.name || '',
                phone: populatedTicket.userId.phone || '',
                email: populatedTicket.userId.email || ''
            } : null;

            const restaurantMap = new Map();
            const addRestaurant = (doc) => {
                if (!doc || typeof doc !== 'object' || !doc._id) return;
                const key = String(doc._id);
                if (!restaurantMap.has(key)) {
                    restaurantMap.set(key, {
                        _id: doc._id,
                        name: doc.restaurantName || '',
                        city: doc.city || '',
                        area: doc.area || ''
                    });
                }
            };
            if (Array.isArray(populatedTicket.restaurantIds)) {
                populatedTicket.restaurantIds.forEach(addRestaurant);
            }
            if (populatedTicket.restaurantId) {
                addRestaurant(populatedTicket.restaurantId);
            }
            const restaurants = [...restaurantMap.values()];
            const restaurant = restaurants.length > 0 ? restaurants[0] : null;
            const restaurantName = restaurants.map(r => r.name).filter(Boolean).join(', ');

            const mappedTicket = {
                ...populatedTicket,
                userId: populatedTicket.userId ? String(populatedTicket.userId._id) : String(populatedTicket.userId),
                user,
                restaurant,
                restaurants,
                restaurantName
            };

            broadcastPublicUpdate('support:ticket:create', { ticket: mappedTicket });
        } catch (socketErr) {
            console.error('Failed to broadcast support:ticket:create', socketErr);
        }

        return sendResponse(res, 201, 'Ticket created', { ticket: created.toObject() });
    } catch (e) {
        next(e);
    }
}

export async function listMySupportTicketsController(req, res, next) {
    try {
        const userId = req.user?.userId;
        const limit = Math.min(Math.max(parseInt(req.query?.limit, 10) || 20, 1), 50);
        const page = Math.max(parseInt(req.query?.page, 10) || 1, 1);
        const skip = (page - 1) * limit;
        const [tickets, total] = await Promise.all([
            FoodSupportTicket.find({ userId: new mongoose.Types.ObjectId(userId) })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodSupportTicket.countDocuments({ userId: new mongoose.Types.ObjectId(userId) })
        ]);
        return sendResponse(res, 200, 'Tickets fetched', { tickets, total, page, limit });
    } catch (e) {
        next(e);
    }
}
