import mongoose from 'mongoose';
import { logger } from '../../../../utils/logger.js';
import {
  sendNotificationToOwner,
  sendNotificationToOwners,
} from "../../../../core/notifications/firebase.service.js";
import { createInboxNotifications } from "../../../../core/notifications/notification.service.js";
import { createAdminNotification } from "../../admin/services/adminNotification.service.js";
import { getIO, rooms } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';

export function enqueueOrderEvent(action, payload = {}) {
  try {
    void addOrderJob({ action, ...payload }).catch((err) => {
      logger.warn(`BullMQ enqueue order event failed: ${action} - ${err?.message || err}`);
    });
  } catch (err) {
    logger.warn(`BullMQ enqueue order event failed (sync): ${action} - ${err?.message || err}`);
  }
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function sanitizeOrderForExternal(orderDoc) {
  const o = orderDoc?.toObject ? orderDoc.toObject() : { ...(orderDoc || {}) };
  o.orderMongoId = (o._id || orderDoc?._id || "").toString();
  // Ensure orderId field for UI always contains the pretty ID
  o.orderId = o.order_id || o.orderMongoId; 
  return o;
}

export async function notifyOwnersSafely(targets, payload) {
  try {
    await sendNotificationToOwners(targets, payload);
    
    // Save in user inbox database so they see them in their notification bell
    const inboxNotifications = (Array.isArray(targets) ? targets : []).map(target => ({
      ownerType: target.ownerType,
      ownerId: target.ownerId,
      title: payload.title || "Order Update",
      message: payload.body || payload.message || "",
      link: payload.data?.link || "",
      category: "order",
      metadata: payload.data || {}
    }));
    if (inboxNotifications.length > 0) {
      await createInboxNotifications({ notifications: inboxNotifications });
    }
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export async function notifyOwnerSafely(target, payload) {
  try {
    await sendNotificationToOwner({ ...target, payload });
    
    if (target?.ownerType && target?.ownerId) {
      await createInboxNotifications({
        notifications: [{
          ownerType: target.ownerType,
          ownerId: target.ownerId,
          title: payload.title || "Order Update",
          message: payload.body || payload.message || "",
          link: payload.data?.link || "",
          category: "order",
          metadata: payload.data || {}
        }]
      });
    }
  } catch (error) {
    logger.warn(`FCM notification failed: ${error?.message || error}`);
  }
}

export function buildOrderIdentityFilter(orderIdOrMongoId) {
  const raw = String(orderIdOrMongoId || "").trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw))
    return { _id: new mongoose.Types.ObjectId(raw) };
  
  // Search BOTH underscore and camelCase variants for robust lookup
  return { 
    $or: [
        { order_id: raw },
        { orderId: raw }
    ]
  };
}

export function toGeoPoint(lat, lng) {
  if (lat == null || lng == null) return undefined;
  const a = Number(lat);
  const b = Number(lng);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return undefined;
  return { type: "Point", coordinates: [b, a] };
}

export function pushStatusHistory(order, { byRole, byId, from, to, note = "" }) {
  order.statusHistory.push({
    at: new Date(),
    byRole,
    byId: byId || undefined,
    from,
    to,
    note,
  });
}

export function normalizeOrderForClient(orderDoc) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const mongoId = (order._id || orderDoc?._id || "").toString();
  const displayId = order.order_id || mongoId;
  const statusHistory = Array.isArray(order?.statusHistory)
    ? order.statusHistory
    : [];
  const cancellationEntry = [...statusHistory]
    .reverse()
    .find((entry) => String(entry?.to || "").toLowerCase().includes("cancel"));
  const cancellationReason =
    String(order?.cancellationReason || "").trim() ||
    String(cancellationEntry?.note || "").trim() ||
    (String(order?.orderStatus || "").toLowerCase().includes("cancel")
      ? String(order?.note || "").trim()
      : "");
  const cancellationStatus = String(cancellationEntry?.to || "").toLowerCase();
  let cancelledBy = "";
  if (cancellationStatus === "cancelled_by_user") cancelledBy = "customer";
  else if (cancellationStatus === "cancelled_by_restaurant")
    cancelledBy = "restaurant";
  else if (cancellationStatus === "cancelled_by_admin") cancelledBy = "admin";
  else if (String(cancellationEntry?.byRole || "").toUpperCase() === "USER")
    cancelledBy = "customer";
  else if (
    String(cancellationEntry?.byRole || "").toUpperCase() === "RESTAURANT"
  )
    cancelledBy = "restaurant";
  else if (String(cancellationEntry?.byRole || "").toUpperCase() === "ADMIN")
    cancelledBy = "admin";

  const uniqueNamesSet = new Set();
  (order.items || []).forEach(it => {
    if (it.restaurantName) uniqueNamesSet.add(it.restaurantName);
  });
  if (order.restaurantId && typeof order.restaurantId === 'object' && order.restaurantId.restaurantName) {
    uniqueNamesSet.add(order.restaurantId.restaurantName);
  }
  if (Array.isArray(order.restaurantIds)) {
    order.restaurantIds.forEach(r => {
      if (r && typeof r === 'object' && r.restaurantName) {
        uniqueNamesSet.add(r.restaurantName);
      }
    });
  }
  const uniqueNames = Array.from(uniqueNamesSet).filter(Boolean);
  const isFood = order.moduleType === 'food' || (!order.moduleType && uniqueNames.length > 0) || (!order.moduleType && !order.items?.[0]?.foodName);
  const restaurantNameText = uniqueNames.length > 0 
    ? uniqueNames.join(", ") 
    : (isFood ? "ZinZooX Kitchen" : "");

  return {
    ...order,
    orderMongoId: mongoId,
    orderId: displayId,
    status: order?.orderStatus || order?.status || "",
    cancellationReason,
    cancelledBy,
    cancelledAt: cancellationEntry?.at || null,
    deliveredAt:
      order?.deliveryState?.deliveredAt || order?.deliveredAt || null,
    deliveryPartnerId:
      order?.dispatch?.deliveryPartnerId || order?.deliveryPartnerId || null,
    rating: order?.ratings?.restaurant?.rating ?? order?.rating ?? null,
    restaurant: restaurantNameText,
    restaurantName: restaurantNameText,
    restaurantId: order.restaurantId && typeof order.restaurantId === 'object' && order.restaurantId.restaurantName
      ? order.restaurantId
      : String((order.restaurantIds && order.restaurantIds[0]) || order.restaurantId || ""),
    deliveryState: {
      status: order?.deliveryState?.status || ""
    }
  };
}

export async function applyAggregateRating(model, entityId, newRating) {
  if (!entityId) return;
  const doc = await model.findById(entityId).select("rating totalRatings");
  if (!doc) return;

  const totalRatings = Number(doc.totalRatings || 0);
  const currentAverage = Number(doc.rating || 0);
  const nextTotal = totalRatings + 1;
  const nextAverage = Number(
    ((currentAverage * totalRatings + Number(newRating)) / nextTotal).toFixed(1),
  );

  doc.totalRatings = nextTotal;
  doc.rating = nextAverage;
  await doc.save();
}

export function buildDeliverySocketPayload(orderDoc, restaurantDoc = null) {
  const order = orderDoc?.toObject ? orderDoc.toObject() : orderDoc || {};
  const restaurant = restaurantDoc || order?.restaurantId || null;
  const restaurantLocation = restaurant?.location || {};
  const deliveryAddress = order?.deliveryAddress || {};
  const customerAddressParts = [
    deliveryAddress.street,
    deliveryAddress.additionalDetails,
    deliveryAddress.city,
    deliveryAddress.state,
    deliveryAddress.zipCode,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean);

  console.log(`[DEBUG] buildDeliverySocketPayload - Order: ${order?.orderId || order?._id}`);
  console.log(`[DEBUG] buildDeliverySocketPayload - riderEarning in doc: ${order?.riderEarning}`);
  console.log(`[DEBUG] buildDeliverySocketPayload - deliveryFee in doc: ${order?.pricing?.deliveryFee}`);

  return {
    orderMongoId:
      orderDoc?._id?.toString?.() || order?._id?.toString?.() || order?._id,
    orderId: order?.order_id || order?._id?.toString?.(),
    status: orderDoc?.orderStatus || order?.orderStatus,
    items: order?.items || [],
    pricing: order?.pricing,
    total: order?.pricing?.total,
    payment: order?.payment,
    paymentMethod: order?.payment?.method,
    restaurantId:
      order?.restaurantId?._id?.toString?.() ||
      order?.restaurantId?.toString?.() ||
      order?.restaurantId ||
      (order?.restaurantIds && order.restaurantIds[0]?.toString?.()) ||
      "",
    restaurantName: restaurant?.restaurantName || order?.restaurantName,
    restaurantAddress:
      restaurantLocation?.address ||
      restaurantLocation?.formattedAddress ||
      restaurant?.location?.address ||
      restaurant?.location?.formattedAddress ||
      "",
    restaurantPhone: restaurant?.phone || "",
    restaurantLocation: {
      latitude: restaurantLocation?.latitude,
      longitude: restaurantLocation?.longitude,
      address:
        restaurantLocation?.address ||
        restaurantLocation?.formattedAddress ||
        restaurant?.location?.address ||
        restaurant?.location?.formattedAddress ||
        "",
      area: restaurantLocation?.area || restaurant?.area || "",
      city: restaurantLocation?.city || restaurant?.city || "",
      state: restaurantLocation?.state || restaurant?.state || "",
    },
    deliveryAddress: order?.deliveryAddress,
    customerAddress: customerAddressParts.length ? customerAddressParts.join(', ') : "",
    customerName: order?.customerName || order?.deliveryAddress?.fullName || order?.deliveryAddress?.name || order?.userId?.name || "",
    customerPhone: order?.customerPhone || order?.deliveryAddress?.phone || order?.userId?.phone || "",
    userName: order?.customerName || order?.deliveryAddress?.fullName || order?.deliveryAddress?.name || order?.userId?.name || "",
    userPhone: order?.customerPhone || order?.deliveryAddress?.phone || order?.userId?.phone || "",
    accountName: order?.userId?.name || order?.userId?.fullName || "",
    accountPhone: order?.userId?.phone || "",
    accountEmail: order?.userId?.email || "",
    note: order?.note || "",
    riderEarning: order?.riderEarning || 0,
    earnings: order?.riderEarning || order?.pricing?.deliveryFee || 0,
    deliveryFee: order?.pricing?.deliveryFee || 0,
    deliveryFleet: order?.deliveryFleet,
    dispatch: order?.dispatch,
    createdAt: order?.createdAt,
    updatedAt: order?.updatedAt,
  };
}

export function canExposeOrderToRestaurant(orderLike) {
  if (String(orderLike?.orderStatus || "").toLowerCase() === "pending_payment") return false;
  const method = String(orderLike?.payment?.method || "").toLowerCase();
  const status = String(orderLike?.payment?.status || "").toLowerCase();
  if (["cash", "wallet"].includes(method)) return true;
  return ["paid", "authorized", "captured", "settled"].includes(status);
}

export async function notifyRestaurantNewOrder(orderDoc) {
  try {
    if (!orderDoc || !canExposeOrderToRestaurant(orderDoc)) return;

    // Collect all unique restaurant IDs from restaurantIds array or restaurantId field
    const rIds = new Set();
    if (orderDoc.restaurantId) {
      rIds.add(orderDoc.restaurantId.toString());
    }
    if (Array.isArray(orderDoc.restaurantIds)) {
      orderDoc.restaurantIds.forEach(id => {
        if (id) rIds.add(id.toString());
      });
    }

    if (rIds.size === 0) return;

    const io = getIO();
    const payload = {
      ...orderDoc.toObject(),
      orderMongoId: orderDoc._id?.toString?.() || undefined,
      orderId: orderDoc.order_id || orderDoc._id?.toString?.(),
    };

    const targetOwners = [];

    for (const rId of rIds) {
      if (io) {
        logger.info(
          `[RestaurantOrders] Emitting new_order to ${rooms.restaurant(rId)} for order ${orderDoc._id?.toString?.() || ''}`,
        );
        io.to(rooms.restaurant(rId)).emit("new_order", payload);
      }
      targetOwners.push({ ownerType: "RESTAURANT", ownerId: rId });
    }

    if (targetOwners.length > 0) {
      await notifyOwnersSafely(
        targetOwners,
        {
          title: "New order received",
          body: `Order #${orderDoc.order_id || orderDoc._id} is waiting for review.`,
          data: {
            type: "new_order",
            orderId: orderDoc._id.toString(),
            orderMongoId: orderDoc._id?.toString?.() || "",
            link: `/restaurant/orders/${orderDoc._id?.toString?.() || ""}`,
          },
        },
      );
    }
  } catch (err) {
    logger.error(`Error notifying restaurants: ${err.message}`);
  }
}

export const STATUS_PRIORITY = {
  created: 10,
  confirmed: 20,
  preparing: 30,
  ready_for_pickup: 40,
  reached_pickup: 50,
  picked_up: 60,
  reached_drop: 70,
  delivered: 80,
  cancelled_by_user: 100,
  cancelled_by_restaurant: 100,
  cancelled_by_admin: 100,
};

/**
 * Returns true if the next status is a valid forward progression from the current status.
 * Prevents "reversing" order status (e.g. from Preparing back to Created).
 */
export function isStatusAdvance(current, next) {
  // If current status is missing, it's effectively 'created' or start of flow
  if (!current) return true;
  
  const currentPrio = STATUS_PRIORITY[current] || 0;
  const nextPrio = STATUS_PRIORITY[next] || 0;

  // Terminal states (100) cannot transition to anything else
  if (currentPrio >= 100) return false;
  
  // Delivered (80) cannot transition to anything (except maybe cancellation if allowed, but here we say no)
  if (currentPrio === 80) return false;

  // Special case: Cancellation is almost always an advance unless already delivered
  if (nextPrio === 100 && currentPrio < 80) return true;

  return nextPrio > currentPrio;
}

export async function broadcastNewOrderToAdmin(order) {
  try {
    const payload = {
      orderId: order.order_id || order.orderId || order._id?.toString() || "N/A",
      orderMongoId: order._id?.toString() || "",
      moduleType: order.moduleType || 'food',
      restaurantName: order.restaurantName || (order.items?.[0]?.restaurantName) || "",
      pricing: order.pricing
    };
    
    const totalAmount = payload.pricing?.total ?? payload.pricing?.finalTotal ?? payload.pricing?.amount ?? 0;
    let moduleName = 'Food';
    let link = '/admin/food/orders/all';
    if (payload.moduleType === 'grocery') {
        moduleName = 'Grocery';
        link = '/admin/food/grocery-orders/all';
    } else if (payload.moduleType === 'accessories') {
        moduleName = 'Accessories';
        link = '/admin/food/accessories-orders/all';
    }

    const notifTitle = `New ${moduleName} Order`;
    const notifMessage = `Order #${payload.orderId} was placed. Total: ₹${Number(totalAmount).toFixed(2)}.`;

    await createAdminNotification({
      title: notifTitle,
      message: notifMessage,
      type: 'order',
      category: payload.moduleType || 'food',
      link,
      metaData: payload
    });

    const io = getIO();
    if (io) {
      logger.info(`[Socket] Broadcasting new order ${payload.orderId} to admin-orders`);
      io.to('admin-orders').emit("play_notification_sound", {
        ...payload,
        title: notifTitle,
        message: notifMessage,
        link
      });
      io.to('admin-orders').emit("admin_new_order", {
        ...payload,
        title: notifTitle,
        message: notifMessage,
        link
      });
      io.to('admin-orders').emit("adminNotificationsUpdated", {
        ...payload,
        title: notifTitle,
        message: notifMessage
      });
    }

    // Dispatch FCM Push Notification to all active admins
    try {
      const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
      await notifyAdminsSafely({
        title: `🚨 ${notifTitle}`,
        body: notifMessage,
        data: {
          type: "order_created",
          orderId: String(payload.orderId),
          orderMongoId: String(payload.orderMongoId),
          moduleType: String(payload.moduleType),
          link
        }
      });
      logger.info(`[FCM] Successfully dispatched new order push notification for #${payload.orderId} to active admins`);
    } catch (fcmErr) {
      logger.warn(`Failed to dispatch FCM push notification to admins: ${fcmErr.message}`);
    }
  } catch (err) {
    logger.warn(`Failed to broadcast new order to admin via sockets: ${err.message}`);
  }
}

export async function broadcastCancelledOrderToAdmin(order, { cancelledBy = 'user', reason = '' } = {}) {
  try {
    const orderId = order.order_id || order.orderId || order._id?.toString() || 'N/A';
    const orderMongoId = order._id?.toString() || '';
    const moduleType = order.moduleType || 'food';
    const restaurantName = order.restaurantName || (order.items?.[0]?.restaurantName) || '';
    const totalAmount = order.pricing?.total ?? order.pricing?.finalTotal ?? order.pricing?.amount ?? 0;

    let moduleName = 'Food';
    let link = '/admin/food/orders/all';
    if (moduleType === 'grocery') {
      moduleName = 'Grocery';
      link = '/admin/food/grocery-orders/all';
    } else if (moduleType === 'accessories') {
      moduleName = 'Accessories';
      link = '/admin/food/accessories-orders/all';
    }

    const cancellerMap = {
      user: 'Customer',
      restaurant: 'Restaurant',
      admin: 'Admin',
      auto_cancel: 'System (Timeout)',
      system: 'System'
    };
    const byText = cancellerMap[cancelledBy] || cancelledBy;
    const notifTitle = `Order Cancelled #${orderId}`;
    const reasonText = reason ? ` Reason: ${reason}` : '';
    const notifMessage = `${moduleName} Order #${orderId} was cancelled by ${byText}.${reasonText}`;

    const payload = {
      orderId,
      orderMongoId,
      moduleType,
      restaurantName,
      status: 'cancelled',
      cancelledBy: byText,
      reason: reason || '',
      pricing: order.pricing,
      link,
      title: `❌ ${notifTitle}`,
      message: notifMessage
    };

    await createAdminNotification({
      title: `❌ ${notifTitle}`,
      message: notifMessage,
      type: 'order',
      category: moduleType,
      link,
      metaData: payload
    });

    const io = getIO();
    if (io) {
      logger.info(`[Socket] Broadcasting cancelled order #${orderId} to admin-orders`);
      io.to('admin-orders').emit('play_notification_sound', payload);
      io.to('admin-orders').emit('admin_new_order', payload);
      io.to('admin-orders').emit('adminNotificationsUpdated', payload);
      io.to('admin-orders').emit('admin_order_update', { orderId: orderMongoId, timestamp: Date.now() });
    }

    // Dispatch FCM Push Notification to all active admins
    try {
      const { notifyAdminsSafely } = await import('../../../../core/notifications/firebase.service.js');
      await notifyAdminsSafely({
        title: `❌ ${notifTitle}`,
        body: notifMessage,
        data: {
          type: 'order_cancelled',
          orderId: String(orderId),
          orderMongoId: String(orderMongoId),
          moduleType: String(moduleType),
          link
        }
      });
      logger.info(`[FCM] Successfully dispatched cancel order push notification for #${orderId} to active admins`);
    } catch (fcmErr) {
      logger.warn(`Failed to dispatch FCM cancel push notification to admins: ${fcmErr.message}`);
    }
  } catch (err) {
    logger.warn(`Failed to broadcast cancelled order to admin via sockets: ${err.message}`);
  }
}
