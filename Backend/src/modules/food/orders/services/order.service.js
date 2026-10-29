import mongoose from 'mongoose';
import { FoodOrder, FoodSettings } from '../models/order.model.js';
import { GroceryOrder } from '../models/groceryOrder.model.js';
// import { paymentSnapshotFromOrder } from './foodOrderPayment.service.js';
import { logger } from '../../../../utils/logger.js';
import { FoodUser } from '../../../../core/users/user.model.js';
const FoodRestaurant = mongoose.models.FoodRestaurant || mongoose.model('FoodRestaurant', new mongoose.Schema({}, { strict: false, collection: 'food_restaurants' }));
const FoodDeliveryPartner = mongoose.models.FoodDeliveryPartner || mongoose.model('FoodDeliveryPartner', new mongoose.Schema({}, { strict: false, collection: 'food_delivery_partners' }));
import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodFeeSettings } from '../../admin/models/feeSettings.model.js';
import { ValidationError, ForbiddenError, NotFoundError } from '../../../../core/auth/errors.js';
import { buildPaginationOptions, buildPaginatedResult } from '../../../../utils/helpers.js';
import { FoodOffer } from '../../admin/models/offer.model.js';
import { FoodOfferUsage } from '../../admin/models/offerUsage.model.js';
const FoodDeliveryCommissionRule = mongoose.models.FoodDeliveryCommissionRule || mongoose.model('FoodDeliveryCommissionRule', new mongoose.Schema({}, { strict: false, collection: 'food_delivery_commission_rules' }));
const FoodRestaurantCommission = mongoose.models.FoodRestaurantCommission || mongoose.model('FoodRestaurantCommission', new mongoose.Schema({}, { strict: false, collection: 'food_restaurant_commissions' }));
import { FoodBusinessSettings } from '../../admin/models/businessSettings.model.js';
import { FoodTransaction } from '../models/foodTransaction.model.js';
import { FoodSupportTicket } from '../../user/models/supportTicket.model.js';
import { config } from '../../../../config/env.js';
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  getRazorpayKeyId,
  isRazorpayConfigured,
  initiateRazorpayRefund
} from '../helpers/razorpay.helper.js';
import { getIO, rooms, broadcastPublicUpdate, broadcastOrderUpdateToAdmin } from '../../../../config/socket.js';
import { addOrderJob } from '../../../../queues/producers/order.producer.js';
import { fetchPolyline } from '../utils/googleMaps.js';
import { getFirebaseDB } from '../../../../config/firebase.js';
import * as foodTransactionService from './foodTransaction.service.js';
import * as userWalletService from '../../user/services/userWallet.service.js';
import { calculateOrderPricing } from './order-pricing.service.js';
import * as paymentService from './order-payment.service.js';
import {
  enqueueOrderEvent,
  haversineKm,
  sanitizeOrderForExternal,
  notifyOwnersSafely,
  notifyOwnerSafely,
  buildOrderIdentityFilter,
  toGeoPoint,
  pushStatusHistory,
  normalizeOrderForClient,
  applyAggregateRating,
  buildDeliverySocketPayload,
  notifyRestaurantNewOrder,
  isStatusAdvance,
  broadcastNewOrderToAdmin,
  broadcastCancelledOrderToAdmin,
} from './order.helpers.js';




const COMMISSION_CACHE_MS = 10 * 1000;
let commissionRulesCache = null;
let commissionRulesLoadedAt = 0;
const ORDER_ACCEPTANCE_WINDOW_SECONDS = 240;

function normalizeAcceptanceWindowSeconds(minutes) {
  const numeric = Number(minutes);
  if (!Number.isFinite(numeric)) return ORDER_ACCEPTANCE_WINDOW_SECONDS;
  const roundedMinutes = Math.round(numeric);
  if (roundedMinutes < 1 || roundedMinutes > 20) return ORDER_ACCEPTANCE_WINDOW_SECONDS;
  return roundedMinutes * 60;
}

async function getOrderAcceptanceWindowSeconds() {
  try {
    const settings = await FoodBusinessSettings.findOne()
      .select('orderAcceptanceTimeMinutes')
      .lean();
    return normalizeAcceptanceWindowSeconds(settings?.orderAcceptanceTimeMinutes);
  } catch (err) {
    logger.warn(`Failed to load order acceptance setting: ${err?.message || err}`);
    return ORDER_ACCEPTANCE_WINDOW_SECONDS;
  }
}

function buildAcceptanceDeadline(date = new Date(), windowSeconds = ORDER_ACCEPTANCE_WINDOW_SECONDS) {
  const seconds = Number(windowSeconds);
  return new Date(date.getTime() + (Number.isFinite(seconds) && seconds > 0 ? seconds : ORDER_ACCEPTANCE_WINDOW_SECONDS) * 1000);
}

function buildCancellationRefundDescription(order, cancelledBy = 'system') {
  const orderReadableId = order?.order_id || order?._id;
  switch (String(cancelledBy || '').toLowerCase()) {
    case 'user':
      return `Refund for cancelled order #${orderReadableId}`;
    case 'restaurant':
      return `Refund for order #${orderReadableId} cancelled by restaurant`;
    case 'admin':
      return `Refund for order #${orderReadableId} cancelled by admin`;
    case 'auto_cancel':
    case 'timeout':
    case 'system':
      return `Refund for order #${orderReadableId} auto-cancelled by system`;
    default:
      return `Refund for cancelled order #${orderReadableId}`;
  }
}

async function applyCancellationRefund(order, { cancelledBy = 'system', refundAmount } = {}) {
  if (!order?.payment) {
    return { attempted: false, processed: false, reason: 'missing_payment' };
  }

  const paymentMethod = String(order.payment?.method || 'cash').toLowerCase();
  const paymentStatus = String(order.payment?.status || 'cod_pending').toLowerCase();
  const refundStatus = String(order.payment?.refund?.status || 'none').toLowerCase();
  const amount = Number(refundAmount ?? order?.pricing?.total ?? order?.payment?.amountDue ?? 0);

  if (!Number.isFinite(amount) || amount <= 0) {
    return { attempted: false, processed: false, reason: 'invalid_amount' };
  }

  if (paymentMethod === 'cash' || paymentMethod === 'cod') {
    return { attempted: false, processed: false, reason: 'cash_payment' };
  }

  if (paymentStatus === 'refunded' || refundStatus === 'processed') {
    return { attempted: false, processed: true, reason: 'already_refunded', method: paymentMethod };
  }

  if (paymentStatus !== 'paid') {
    return { attempted: false, processed: false, reason: `payment_status_${paymentStatus || 'unknown'}`, method: paymentMethod };
  }

  if (paymentMethod === 'razorpay') {
    const paymentId = String(order.payment?.razorpay?.paymentId || '').trim();
    if (!paymentId) {
      order.payment.refund = {
        status: 'failed',
        amount,
      };
      return { attempted: true, processed: false, reason: 'missing_razorpay_payment_id', method: paymentMethod };
    }

    const refundResult = await initiateRazorpayRefund(paymentId, amount);
    if (refundResult.success) {
      order.payment.status = 'refunded';
      order.payment.refund = {
        status: 'processed',
        amount,
        refundId: refundResult.refundId,
        processedAt: new Date(),
      };
      return { attempted: true, processed: true, method: paymentMethod, refundId: refundResult.refundId };
    }

    order.payment.refund = {
      status: 'failed',
      amount,
    };
    return {
      attempted: true,
      processed: false,
      reason: refundResult.error || 'razorpay_refund_failed',
      method: paymentMethod,
    };
  }

  if (paymentMethod === 'wallet') {
    await userWalletService.refundWalletBalance(
      order.userId,
      amount,
      buildCancellationRefundDescription(order, cancelledBy),
      { orderId: order._id, cancelledBy }
    );
    order.payment.status = 'refunded';
    order.payment.refund = {
      status: 'processed',
      amount,
      processedAt: new Date(),
    };
    return { attempted: true, processed: true, method: paymentMethod };
  }

  return { attempted: false, processed: false, reason: `unsupported_method_${paymentMethod}`, method: paymentMethod };
}

async function expireUnacceptedOrders(filter = {}) {
  const now = new Date();
  const baseFilter = {
    orderStatus: { $in: ["created", "confirmed"] },
    acceptanceDeadlineAt: { $ne: null, $lte: now },
    ...filter,
  };

  const docs = await FoodOrder.find(baseFilter).select("_id orderStatus").lean();
  if (!docs.length) return 0;

  for (const doc of docs) {
    const from = String(doc.orderStatus || "created");
    const updated = await FoodOrder.findOneAndUpdate(
      {
        _id: doc._id,
        orderStatus: { $in: ["created", "confirmed"] },
        acceptanceDeadlineAt: { $ne: null, $lte: now },
      },
      {
        $set: {
          orderStatus: "cancelled_by_restaurant",
          note: "Not accepted by restaurant",
        },
        $push: {
          statusHistory: {
            at: now,
            byRole: "SYSTEM",
            from,
            to: "cancelled_by_restaurant",
            note: "Not accepted by restaurant",
          },
        },
      },
      { new: true },
    );

    if (!updated) continue;

    try {
      await applyCancellationRefund(updated, { cancelledBy: 'auto_cancel' });
      await updated.save();
    } catch (err) {
      logger.warn(`expireUnacceptedOrders refund failed for ${updated._id}: ${err?.message || err}`);
    }

    try {
      const io = getIO();
      if (io) {
        const payload = {
          orderMongoId: updated._id?.toString?.(),
          orderId: updated._id.toString(),
          orderStatus: updated.orderStatus,
          note: "Not accepted by restaurant",
          message: "Order was not accepted by restaurant in time.",
        };
        io.to(rooms.user(updated.userId)).emit("order_status_update", payload);
        const rIds = updated.restaurantIds && updated.restaurantIds.length > 0 ? updated.restaurantIds : [updated.restaurantId].filter(Boolean);
        rIds.forEach(rId => {
          io.to(rooms.restaurant(rId)).emit("order_status_update", payload);
        });
        broadcastOrderUpdateToAdmin(updated._id.toString());
        broadcastCancelledOrderToAdmin(updated, { cancelledBy: "auto_cancel", reason: "Not accepted by restaurant in time" });
      }
    } catch (err) {
      logger.warn(`expireUnacceptedOrders socket emit failed: ${err?.message || err}`);
    }
  }

  return docs.length;
}

export async function expireUnacceptedOrderById(orderMongoId) {
  if (!orderMongoId || !mongoose.Types.ObjectId.isValid(String(orderMongoId))) {
    return 0;
  }
  return expireUnacceptedOrders({ _id: new mongoose.Types.ObjectId(String(orderMongoId)) });
}

async function getActiveCommissionRules() {
  const now = Date.now();
  if (
    commissionRulesCache &&
    now - commissionRulesLoadedAt < COMMISSION_CACHE_MS
  ) {
    return commissionRulesCache;
  }
  const list = await FoodDeliveryCommissionRule.find({
    status: { $ne: false },
  }).lean();
  commissionRulesCache = list || [];
  commissionRulesLoadedAt = now;
  return commissionRulesCache;
}

// 🗑️ Moved to foodTransaction.service.js to centralize finance logic.


async function getRiderEarning(distanceKm) {
  return 0;
}

/** Append-only food_order_payments row; never blocks main flow on failure */
// 🗑️ Deprecated in favor of FoodTransaction system.

// ----- Settings -----
export async function getDispatchSettings() {
  return { dispatchMode: "auto" };
}

export async function updateDispatchSettings(dispatchMode, adminId) {
  return { dispatchMode: "auto" };
}

// ----- Calculate (validation + return pricing from payload) -----
export async function calculateOrder(userId, dto) {
  return calculateOrderPricing(userId, dto);
}

// Helper to safely convert string to ObjectId or throw ValidationError (400)
function toObjectId(id, fieldName = 'ID') {
  if (!id) return null;
  if (id instanceof mongoose.Types.ObjectId) return id;
  if (typeof id !== 'string' || !/^[0-9a-fA-F]{24}$/.test(id)) {
    throw new ValidationError(`Invalid ${fieldName} format`);
  }
  return new mongoose.Types.ObjectId(id);
}

import { FoodItem } from '../../admin/models/food.model.js';
import { GroceryProduct } from '../../admin/models/groceryProduct.model.js';
import { AccessoriesProduct } from '../../../accessories/models/accessoriesProduct.model.js';


async function createUnifiedOrder(userId, dto) {
  // Enforce authoritative backend pricing for the entire cart before splitting
  const backendPricingResult = await calculateOrderPricing(userId, dto);
  if (dto.pricing?.couponCode && backendPricingResult.pricing.discount === 0) {
    throw new ValidationError("This coupon cannot be applied to this order.");
  }
  // Trust backend calculation over frontend
  dto.pricing = { ...dto.pricing, ...backendPricingResult.pricing };

  console.log('--- createUnifiedOrder backend payload ---', JSON.stringify(dto.items, null, 2));
  for (const item of dto.items) {
    const mod = item.moduleType || (dto.moduleType !== 'unified' ? dto.moduleType : null);
    if (!mod || !['food', 'grocery', 'accessories'].includes(mod)) {
      throw new Error(`Invalid or missing module type for item: ${item.name || item.itemId}`);
    }
    if (mod === 'food') {
      const dbItem = await FoodItem.findById(item.itemId);
      if (!dbItem || dbItem.isAvailable === false) {
        throw new Error(`Item Out of Stock: ${item.name}`);
      }
    } else if (mod === 'grocery') {
      const dbItem = await GroceryProduct.findById(item.itemId);
      if (!dbItem || dbItem.isActive === false) {
        throw new Error(`Item Out of Stock: ${item.name}`);
      }
    } else if (mod === 'accessories') {
      const dbItem = await AccessoriesProduct.findById(item.itemId);
      if (!dbItem || dbItem.isActive === false) {
        throw new Error(`Item Out of Stock: ${item.name}`);
      }
    }
  }

  const moduleItems = { food: [], grocery: [], accessories: [] };
  for (const item of dto.items) {
    const mod = item.moduleType || (dto.moduleType !== 'unified' ? dto.moduleType : null);
    if (mod && moduleItems[mod]) {
      moduleItems[mod].push(item);
    }
  }

  const createdOrders = [];
  let totalAmountForRazorpay = 0;
  const originalPaymentMethod = dto.paymentMethod;
  const masterOrderId = new mongoose.Types.ObjectId();

  const grandSubtotal = Number(dto.pricing.subtotal) || 1;
  const createdOrderIds = [];

  for (const mod of ['food', 'grocery', 'accessories']) {
    const items = moduleItems[mod];
    if (!items || items.length === 0) continue;

    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
    const ratio = subtotal / grandSubtotal;

    const subPricing = {
      subtotal: subtotal,
      tax: Number((Number(dto.pricing.tax) || 0) * ratio).toFixed(2) * 1,
      packagingFee: Number((Number(dto.pricing.packagingFee) || 0) * ratio).toFixed(2) * 1,
      deliveryFee: Number((Number(dto.pricing.deliveryFee) || 0) * ratio).toFixed(2) * 1,
      platformFee: Number((Number(dto.pricing.platformFee) || 0) * ratio).toFixed(2) * 1,
      discount: Number((Number(dto.pricing.discount) || 0) * ratio).toFixed(2) * 1,
      couponCode: dto.pricing.couponCode,
      currency: dto.pricing.currency
    };

    subPricing.total = Math.max(0, subtotal + subPricing.tax + subPricing.packagingFee + subPricing.deliveryFee + subPricing.platformFee - subPricing.discount);
    totalAmountForRazorpay += subPricing.total;

    const subDto = {
      ...dto,
      moduleType: mod,
      items: items,
      pricing: subPricing,
      paymentMethod: originalPaymentMethod
    };

    let orderObj;
    if (mod === 'grocery' || mod === 'accessories') {
      orderObj = await createGroceryOrder(userId, subDto, true);
    } else {
      orderObj = await createOrder(userId, subDto, true);
    }

    if (orderObj.order) orderObj = orderObj.order;
    createdOrders.push(orderObj);
    createdOrderIds.push(orderObj._id.toString());
  }

  let razorpayPayload = null;
  if (originalPaymentMethod === "razorpay") {
    const { isRazorpayConfigured } = await import('../helpers/razorpay.helper.js');
    if (isRazorpayConfigured()) {
      const amountPaise = Math.round(totalAmountForRazorpay * 100);
      if (amountPaise >= 100) {
        const { createRazorpayOrder, getRazorpayKeyId } = await import('../helpers/razorpay.helper.js');
        const rzOrder = await createRazorpayOrder(amountPaise, "INR", `unified_${masterOrderId.toString()}`);
        razorpayPayload = {
          key: getRazorpayKeyId(),
          amount: amountPaise,
          currency: "INR",
          name: "Unified Checkout",
          description: "Payment for multiple items",
          orderId: rzOrder.id,
        };

        const { FoodOrder } = await import('../models/order.model.js');
        const { GroceryOrder } = await import('../models/groceryOrder.model.js');

        for (const order of createdOrders) {
          order.payment.method = "razorpay";
          order.payment.status = "created";
          order.payment.razorpay = { orderId: rzOrder.id };
          order.orderStatus = "pending_payment";
          order.statusHistory.push({
            at: new Date(),
            byRole: "SYSTEM",
            from: "confirmed",
            to: "pending_payment",
            note: "Unified order created, awaiting payment"
          });

          if (order.moduleType === 'food') {
            await FoodOrder.updateOne({ _id: order._id }, { $set: { payment: order.payment, orderStatus: order.orderStatus, statusHistory: order.statusHistory } });
          } else {
            await GroceryOrder.updateOne({ _id: order._id }, { $set: { payment: order.payment, orderStatus: order.orderStatus, statusHistory: order.statusHistory } });
          }
        }
      }
    }
  }

  return {
    orderId: masterOrderId,
    _id: masterOrderId,
    subOrderIds: createdOrderIds,
    paymentMethod: originalPaymentMethod,
    razorpay: razorpayPayload,
    totalAmount: totalAmountForRazorpay
  };
}

// ----- Create order -----
export async function createOrder(userId, dto, bypassRazorpay = false) {
  if (dto.moduleType === 'all' || dto.moduleType === 'unified') {
    return await createUnifiedOrder(userId, dto);
  }

  // If this is a top-level single order call, enforce authoritative backend pricing
  if (!bypassRazorpay) {
    const backendPricingResult = await calculateOrderPricing(userId, dto);
    if (dto.pricing?.couponCode && backendPricingResult.pricing.discount === 0) {
      throw new ValidationError("This coupon cannot be applied to this order.");
    }
    // Trust backend calculation over frontend
    dto.pricing = { ...dto.pricing, ...backendPricingResult.pricing };
  }

  try {
    if (dto.moduleType === 'grocery' || dto.moduleType === 'accessories') {
      return await createGroceryOrder(userId, dto, bypassRazorpay);
    }

    if (!dto.items || dto.items.length === 0) {
      throw new ValidationError('At least one item must be ordered');
    }

    // Resolve restaurant IDs & names from database for all items
    const populatedItems = [];
    const restaurantIdsSet = new Set();
    
    if (Array.isArray(dto.items)) {
      for (const item of dto.items) {
        let rId = item.restaurantId;
        let rName = item.restaurantName;
        
        // Resolve restaurant ID from FoodItem if missing
        if (!rId && mongoose.Types.ObjectId.isValid(item.itemId)) {
          const foodItem = await mongoose.model('FoodItem').findById(item.itemId).lean();
          if (foodItem && foodItem.restaurantId) {
            rId = foodItem.restaurantId.toString();
          }
        }
        
        // Resolve restaurant name if missing
        if (rId && (!rName || String(rName).trim() === "")) {
          const restDoc = await mongoose.model('FoodRestaurant').findById(rId).select('restaurantName').lean();
          if (restDoc) {
            rName = restDoc.restaurantName;
          }
        }
        
        if (rId) {
          restaurantIdsSet.add(rId.toString());
        }
        
        populatedItems.push({
          ...item,
          itemId: toObjectId(item.itemId, 'Item ID'),
          restaurantId: rId ? toObjectId(rId, 'Restaurant ID') : undefined,
          restaurantName: rName || "Default Kitchen"
        });
      }
    }

    if (restaurantIdsSet.size === 0) {
      // Fallback default restaurant ID
      restaurantIdsSet.add('6a47438661bc505016a5ad33');
    }

    const distinctRestaurantIds = Array.from(restaurantIdsSet);
    const firstRestaurantId = distinctRestaurantIds[0];
    let restaurant = null;

    if (mongoose.Types.ObjectId.isValid(firstRestaurantId)) {
      restaurant = await mongoose.model('FoodRestaurant').findById(firstRestaurantId).lean();
    }

    if (!restaurant) {
      throw new ValidationError('Restaurant not found for the ordered items');
    }

    const settings = await getDispatchSettings();
    const dispatchMode = settings.dispatchMode;

    const deliveryAddress = {
      label: dto.address?.label || "Home",
      name: dto.address?.name || dto.address?.fullName || dto.customerName || "",
      fullName: dto.address?.fullName || dto.address?.name || dto.customerName || "",
      street: dto.address?.street || "",
      additionalDetails: dto.address?.additionalDetails || "",
      city: dto.address?.city || "",
      state: dto.address?.state || "",
      zipCode: dto.address?.zipCode || "",
      phone: dto.address?.phone || "",
      location: dto.address?.location?.coordinates
        ? { type: "Point", coordinates: dto.address.location.coordinates }
        : undefined,
    };

    const paymentMethod =
      dto.paymentMethod === "card" ? "razorpay" : dto.paymentMethod;
    const isCash = paymentMethod === "cash";
    const isWallet = paymentMethod === "wallet";

    // Ensure pricing is present and consistent.
    const computedSubtotal = (dto.items || []).reduce((sum, item) => {
      const price = Number(item?.price);
      const qty = Number(item?.quantity);
      if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum;
      return sum + Math.max(0, price) * Math.max(0, qty);
    }, 0);

    const normalizedPricing = {
      subtotal: Number(dto.pricing?.subtotal ?? computedSubtotal) || 0,
      tax: Number(dto.pricing?.tax ?? 0) || 0,
      packagingFee: Number(dto.pricing?.packagingFee ?? 0) || 0,
      deliveryFee: Number(dto.pricing?.deliveryFee ?? 0) || 0,
      platformFee: Number(dto.pricing?.platformFee ?? 0) || 0,
      discount: Number(dto.pricing?.discount ?? 0) || 0,
      couponCode: dto.pricing?.couponCode ? String(dto.pricing.couponCode).trim().toUpperCase() : null,
      total: Number(dto.pricing?.total ?? 0) || 0,
      currency: String(dto.pricing?.currency || "INR"),
    };

    const computedTotal = Math.max(
      0,
      (Number.isFinite(normalizedPricing.subtotal) ? normalizedPricing.subtotal : 0) +
      (Number.isFinite(normalizedPricing.tax) ? normalizedPricing.tax : 0) +
      (Number.isFinite(normalizedPricing.packagingFee) ? normalizedPricing.packagingFee : 0) +
      (Number.isFinite(normalizedPricing.deliveryFee) ? normalizedPricing.deliveryFee : 0) +
      (Number.isFinite(normalizedPricing.platformFee) ? normalizedPricing.platformFee : 0) -
      (Number.isFinite(normalizedPricing.discount) ? normalizedPricing.discount : 0),
    );

    if (!Number.isFinite(normalizedPricing.total) || normalizedPricing.total <= 0) {
      normalizedPricing.total = Math.round(computedTotal * 100) / 100;
    } else {
      normalizedPricing.total = Math.round(normalizedPricing.total * 100) / 100;
    }

    const payment = {
      method: paymentMethod,
      status: isCash ? "cod_pending" : isWallet ? "paid" : "created",
      amountDue: normalizedPricing.total || 0,
      razorpay: {},
      qr: {},
    };

    let rLat = restaurant.location?.coordinates?.[1] ?? restaurant.location?.latitude;
    let rLng = restaurant.location?.coordinates?.[0] ?? restaurant.location?.longitude;
    let dLat = dto.address?.latitude ?? dto.address?.location?.coordinates?.[1];
    let dLng = dto.address?.longitude ?? dto.address?.location?.coordinates?.[0];

    let distanceKm = null;
    if (
      typeof rLat === 'number' && typeof rLng === 'number' &&
      typeof dLat === 'number' && typeof dLng === 'number'
    ) {
      const d = haversineKm(rLat, rLng, dLat, dLng);
      distanceKm = Number.isFinite(d) ? d : null;
    }

    const riderEarning = await getRiderEarning(distanceKm) || 0;

    // Calculate restaurant commission from subtotal
    let restaurantCommission = 0;
    try {
      const snapshot = await foodTransactionService.getRestaurantCommissionSnapshot({
        items: populatedItems,
        pricing: normalizedPricing,
        restaurantIds: distinctRestaurantIds
      });
      restaurantCommission = Number(snapshot?.commissionAmount) || 0;
    } catch (err) {
      logger.error(`Commission calculation failed for order: ${err.message}`);
    }

    normalizedPricing.restaurantCommission = restaurantCommission;

    const platformProfit = Math.max(
      0,
      (Number.isFinite(normalizedPricing.deliveryFee) ? normalizedPricing.deliveryFee : 0) +
      (Number.isFinite(normalizedPricing.platformFee) ? normalizedPricing.platformFee : 0) +
      restaurantCommission -
      riderEarning,
    );

    // Prevent negative profit transactions
    if (platformProfit < 0) {
      throw new ValidationError("This coupon cannot be applied to this order as it exceeds allowed limits.");
    }

    const initialStatus = (paymentMethod === "razorpay" || paymentMethod === "card") ? "pending_payment" : "confirmed";

    // Pre-calculate coinsEarned when order is created based on active business settings
    let coinsEarned = 0;
    try {
      const { FoodBusinessSettings } = await import('../../admin/models/businessSettings.model.js');
      const settings = await FoodBusinessSettings.findOne().lean();
      if (settings?.coinSettings?.isActive) {
        const { minCoinsPerOrder, maxCoinsPerOrder } = settings.coinSettings;
        const min = Number(minCoinsPerOrder) || 0;
        const max = Number(maxCoinsPerOrder) || 0;
        coinsEarned = Math.floor(Math.random() * (max - min + 1)) + min;
      }
    } catch (err) {
      logger.error(`Failed to pre-calculate coinsEarned: ${err.message}`);
    }

    const order = new FoodOrder({
      userId: toObjectId(userId, 'User ID'),
      restaurantIds: distinctRestaurantIds.map(id => toObjectId(id, 'Restaurant ID')),
      moduleType: dto.moduleType || 'food',
      zoneId: dto.zoneId ? toObjectId(dto.zoneId, 'Zone ID') : (restaurant.zoneId ? toObjectId(restaurant.zoneId, 'Restaurant Zone ID') : null),
      items: populatedItems,
      deliveryAddress,
      deliveryDistance: distanceKm,
      deliveryLatitude: dLat,
      deliveryLongitude: dLng,
      originLatitude: rLat,
      originLongitude: rLng,
      originAddress: restaurant.location?.address || restaurant.location?.formattedAddress || "",
      customerName: String(dto.customerName || deliveryAddress.fullName || ""),
      customerPhone: String(dto.customerPhone || deliveryAddress.phone || ""),
      pricing: normalizedPricing,
      payment,
      orderStatus: initialStatus,
      dispatch: { modeAtCreation: dispatchMode, status: "unassigned" },
      statusHistory: [
        {
          at: new Date(),
          byRole: "SYSTEM",
          from: "",
          to: initialStatus,
          note: initialStatus === "pending_payment" ? "Order created, awaiting payment" : "Order placed",
        },
      ],
      note: String(dto.note || ""),
      sendCutlery: dto.sendCutlery !== false,
      deliveryFleet: String(dto.deliveryFleet || "standard"),
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      riderEarning: Number(riderEarning) || 0,
      platformProfit: Number(platformProfit) || 0,
      coinsEarned: Number(coinsEarned) || 0
    });

    let razorpayPayload = null;

    if (!bypassRazorpay && paymentMethod === "razorpay" && isRazorpayConfigured()) {
      const amountPaise = Math.round((normalizedPricing.total || 0) * 100);
      if (amountPaise < 100)
        throw new ValidationError("Amount too low for online payment");
      try {
        const rzOrder = await createRazorpayOrder(amountPaise, "INR", order._id.toString());
        razorpayPayload = {
          key: getRazorpayKeyId(),
          orderId: rzOrder.id,
          amount: rzOrder.amount,
          currency: rzOrder.currency || "INR",
        };
        payment.razorpay = { orderId: rzOrder.id, paymentId: "", signature: "" };
        payment.status = "created";
        // Update order payment state before saving
        order.payment = payment;
      } catch (err) {
        logger.error(`Razorpay order creation failed: ${err.message}`);
        throw new ValidationError(err?.message || "Payment gateway error");
      }
    }

    await order.save();
    await deductStock(order.items, 'food');

    if (isWallet) {
      try {
        await userWalletService.deductWalletBalance(userId, order.pricing.total, `Payment for order #${order.order_id || order._id}`, { orderId: order._id });
      } catch (err) {
        await FoodOrder.deleteOne({ _id: order._id });
        throw err;
      }
    }

    // Phase 2: Create initial transaction (Non-blocking but logged)
    try {
      await foodTransactionService.createInitialTransaction(order);
    } catch (err) {
      logger.error(`[CRITICAL] Initial transaction failed for order ${order._id}: ${err.message}`);
      // We don't throw here to avoid failing the whole order if transaction logging fails
    }

    // Realtime + push notifications.
    try {
      const isAwaitingOnlinePayment =
        String(paymentMethod || "").toLowerCase() === "razorpay" &&
        String(payment?.status || "").toLowerCase() !== "paid";

      let restaurantDisplayString = "ZinZooX";
      try {
        if (distinctRestaurantIds.length === 1) {
          restaurantDisplayString = restaurant?.restaurantName || "ZinZooX";
        } else if (distinctRestaurantIds.length > 1) {
          const restDocs = await mongoose.model('FoodRestaurant')
            .find({ _id: { $in: distinctRestaurantIds.map(id => toObjectId(id, 'Restaurant ID')) } })
            .select('restaurantName')
            .lean();
          const names = restDocs.map(r => r.restaurantName).filter(Boolean);
          if (names.length > 0) {
            restaurantDisplayString = names.join(", ");
          }
        }
      } catch (err) {
        logger.error(`Failed to resolve restaurant display string: ${err.message}`);
      }

      if (!isAwaitingOnlinePayment) {
        await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
          title: "Order Confirmed! 🍔",
          body: `Your order #${order.order_id || order._id} from ${restaurantDisplayString} has been placed successfully.`,
          image: "https://i.ibb.co/5GzXz7r/Zinzoox-Brand-Image.png",
          data: {
            type: "order_created",
            orderId: String(order._id),
            orderMongoId: order._id.toString(),
            link: `/food/user/orders/${order._id.toString()}`,
          },
        });
      }

      // Restaurant gets new-order request only when payment flow is eligible.
      await notifyRestaurantNewOrder(order);
      if (initialStatus === "confirmed") {
        broadcastNewOrderToAdmin(order);
      }
    } catch (err) {
      logger.warn(`Notifications failed for order ${order._id}: ${err.message}`);
    }

    // Handle Coupon usage (Only increment immediately if NOT awaiting online payment)
    const isAwaitingOnlinePaymentForCoupon = String(paymentMethod || "").toLowerCase() === "razorpay" && String(payment?.status || "").toLowerCase() !== "paid";
    
    if (!isAwaitingOnlinePaymentForCoupon) {
      const couponCode = dto.pricing?.couponCode ? String(dto.pricing.couponCode).trim().toUpperCase() : "";
      if (couponCode) {
        try {
          const offer = await FoodOffer.findOne({ couponCode }).lean();
          if (offer) {
            await FoodOffer.updateOne({ _id: offer._id }, { $inc: { usedCount: 1 } });
            await FoodOfferUsage.updateOne(
              { offerId: offer._id, userId: toObjectId(userId, 'User ID') },
              { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
              { upsert: true },
            );
            broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
          }
        } catch (err) {
          logger.error(`Coupon usage update failed: ${err.message}`);
        }
      }
    }

    const saved = normalizeOrderForClient(order);
    return { order: saved, razorpay: razorpayPayload };
  } catch (err) {
    logger.error(`Order placement error: ${err.message}`, { stack: err.stack, userId, dto });
    if (err instanceof ValidationError || err instanceof ForbiddenError || err instanceof NotFoundError) {
      throw err;
    }
    // Transform system errors to Generic validation error with 500 logging
    throw new ValidationError(err.message || "Something went wrong while placing your order. Please try again.");
  }
}

// ----- Verify payment -----
export async function verifyPayment(userId, dto) {
  if (dto.isUnified) {
    const valid = verifyPaymentSignature(
      dto.razorpayOrderId,
      dto.razorpayPaymentId,
      dto.razorpaySignature,
    );
    if (!valid) throw new ValidationError("Payment verification failed");

    // Unified order: find all sub-orders with this razorpayOrderId
    const foodOrders = await FoodOrder.find({
      "payment.razorpay.orderId": dto.razorpayOrderId,
      userId: new mongoose.Types.ObjectId(userId)
    });
    
    const groceryOrders = await GroceryOrder.find({
      "payment.razorpay.orderId": dto.razorpayOrderId,
      userId: new mongoose.Types.ObjectId(userId)
    });

    const allOrders = [...foodOrders, ...groceryOrders];
    if (allOrders.length === 0) throw new NotFoundError("Unified orders not found for this payment");

    let anyUpdated = false;
    let totalAmount = 0;

    for (const order of allOrders) {
      if (order.payment.status === "paid") continue;

      order.payment.status = "paid";
      order.payment.razorpay.paymentId = dto.razorpayPaymentId;
      order.payment.razorpay.signature = dto.razorpaySignature;

      const from = order.orderStatus;
      order.orderStatus = "confirmed";

      pushStatusHistory(order, {
        byRole: "USER",
        byId: userId,
        from: from,
        to: "confirmed",
        note: "Payment verified, order confirmed",
      });
      await order.save();
      anyUpdated = true;
      totalAmount += (order.payment.amountDue || 0);

      await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
        status: 'captured',
        razorpayPaymentId: dto.razorpayPaymentId,
        razorpaySignature: dto.razorpaySignature,
        recordedByRole: "USER",
        recordedById: new mongoose.Types.ObjectId(userId)
      });

      // Notify relevant restaurant/admin
      await notifyRestaurantNewOrder(order);
      broadcastNewOrderToAdmin(order);

      // Handle Coupon usage exactly once upon successful payment
      const couponCode = order.pricing?.couponCode ? String(order.pricing.couponCode).trim().toUpperCase() : "";
      if (couponCode) {
        try {
          const offer = await FoodOffer.findOne({ couponCode }).lean();
          if (offer) {
            await FoodOffer.updateOne({ _id: offer._id }, { $inc: { usedCount: 1 } });
            await FoodOfferUsage.updateOne(
              { offerId: offer._id, userId: toObjectId(userId, 'User ID') },
              { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
              { upsert: true },
            );
            broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
          }
        } catch (err) {
          logger.error(`Coupon usage update failed in unified verifyPayment: ${err.message}`);
        }
      }
    }

    if (anyUpdated) {
      // Notify Customer about payment success
      await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
        title: "Payment Successful! ✅",
        body: `We have received your payment of ₹${totalAmount} for your Unified Order.`,
        image: "https://i.ibb.co/5GzXz7r/Zinzoox-Brand-Image.png",
        data: {
          type: "payment_success",
          orderId: "unified"
        },
      });
    }

    return { order: { isUnified: true }, payment: { status: 'paid' } };
  }

  // --- Normal Single Order Flow ---
  const identity = buildOrderIdentityFilter(dto.orderId);
  if (!identity) throw new ValidationError("Order id required");

  let order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!order) {
    order = await GroceryOrder.findOne({
      ...identity,
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  if (!order) throw new NotFoundError("Order not found");
  if (order.payment.status === "paid")
    return { order: normalizeOrderForClient(order), payment: order.payment };

  const valid = verifyPaymentSignature(
    dto.razorpayOrderId,
    dto.razorpayPaymentId,
    dto.razorpaySignature,
  );
  if (!valid) throw new ValidationError("Payment verification failed");

  order.payment.status = "paid";
  order.payment.razorpay.paymentId = dto.razorpayPaymentId;
  order.payment.razorpay.signature = dto.razorpaySignature;

  const from = order.orderStatus;
  order.orderStatus = "confirmed";

  pushStatusHistory(order, {
    byRole: "USER",
    byId: userId,
    from: from,
    to: "confirmed",
    note: "Payment verified, order confirmed",
  });
  await order.save();

  await foodTransactionService.updateTransactionStatus(order._id, 'captured', {
    status: 'captured',
    razorpayPaymentId: dto.razorpayPaymentId,
    razorpaySignature: dto.razorpaySignature,
    recordedByRole: "USER",
    recordedById: new mongoose.Types.ObjectId(userId)
  });

  // After online payment is verified, now notify restaurant about the new order.
  await notifyRestaurantNewOrder(order);
  broadcastNewOrderToAdmin(order);

  // Handle Coupon usage exactly once upon successful payment
  const couponCode = order.pricing?.couponCode ? String(order.pricing.couponCode).trim().toUpperCase() : "";
  if (couponCode) {
    try {
      const offer = await FoodOffer.findOne({ couponCode }).lean();
      if (offer) {
        await FoodOffer.updateOne({ _id: offer._id }, { $inc: { usedCount: 1 } });
        await FoodOfferUsage.updateOne(
          { offerId: offer._id, userId: toObjectId(userId, 'User ID') },
          { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
          { upsert: true },
        );
        broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
      }
    } catch (err) {
      logger.error(`Coupon usage update failed in single verifyPayment: ${err.message}`);
    }
  }

  // Notify Customer about payment success
  await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
    title: "Payment Successful! ✅",
    body: `We have received your payment of ₹${order.payment.amountDue} for Order #${order._id.toString()}.`,
    image: "https://i.ibb.co/5GzXz7r/Zinzoox-Brand-Image.png",
    data: {
      type: "payment_success",
      orderId: String(order._id.toString()),
      orderMongoId: String(order._id),
    },
  });

  return { order: normalizeOrderForClient(order), payment: order.payment };
}

// ----- Auto-assign -----

/**
 * Start or continue a smart cascading dispatch.
 * @param {string} orderId - Mongo ID of the order.
 * @param {object} options - Options (retry count, etc)
 */
export async function tryAutoAssign(orderId, options = {}) {
  return null;
}

/**
 * Triggered by worker after 60 seconds of zero response.
 */
export async function processDispatchTimeout(orderId, partnerId, options = {}) {
  return null;
}

// ----- User: list, get, cancel -----
export async function listOrdersUser(userId, query) {
  await expireUnacceptedOrders();
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = {
    userId: new mongoose.Types.ObjectId(userId),
    orderStatus: { $ne: 'pending_payment' }
  };

  const [foodDocs, groceryDocs] = await Promise.all([
    FoodOrder.find(filter)
      .populate("dispatch.deliveryPartnerId", "name phone rating totalRatings")
      .lean(),
    GroceryOrder.find(filter)
      .populate("dispatch.deliveryPartnerId", "name phone rating totalRatings")
      .lean()
  ]);

  const allDocs = [
    ...foodDocs.map((doc) => ({ ...normalizeOrderForClient(doc), moduleType: doc.moduleType || 'food' })),
    ...groceryDocs.map((doc) => ({ ...normalizeOrderForClient(doc), moduleType: doc.moduleType || 'grocery' }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const total = allDocs.length;
  const paginatedDocs = allDocs.slice(skip, skip + limit);

  return buildPaginatedResult({
    docs: paginatedDocs,
    total,
    page,
    limit,
  });
}

async function createGroceryOrder(userId, dto, bypassRazorpay = false) {
  // If this is a top-level single order call, enforce authoritative backend pricing
  if (!bypassRazorpay) {
    const backendPricingResult = await calculateOrderPricing(userId, dto);
    if (dto.pricing?.couponCode && backendPricingResult.pricing.discount === 0) {
      throw new ValidationError("This coupon cannot be applied to this order.");
    }
    // Trust backend calculation over frontend
    dto.pricing = { ...dto.pricing, ...backendPricingResult.pricing };
  }

  const deliveryAddress = {
    label: dto.address?.label || "Home",
    name: dto.address?.name || dto.address?.fullName || dto.customerName || "",
    fullName: dto.address?.fullName || dto.address?.name || dto.customerName || "",
    street: dto.address?.street || "",
    additionalDetails: dto.address?.additionalDetails || "",
    city: dto.address?.city || "",
    state: dto.address?.state || "",
    zipCode: dto.address?.zipCode || "",
    phone: dto.address?.phone || "",
    location: dto.address?.location?.coordinates
      ? { type: "Point", coordinates: dto.address.location.coordinates }
      : undefined,
  };

  const paymentMethod = dto.paymentMethod === "card" ? "razorpay" : dto.paymentMethod;
  const isCash = paymentMethod === "cash";
  const isWallet = paymentMethod === "wallet";

  const computedSubtotal = (dto.items || []).reduce((sum, item) => {
    const price = Number(item?.price);
    const qty = Number(item?.quantity);
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum;
    return sum + Math.max(0, price) * Math.max(0, qty);
  }, 0);

  const normalizedPricing = {
    subtotal: Number(dto.pricing?.subtotal ?? computedSubtotal) || 0,
    tax: Number(dto.pricing?.tax ?? 0) || 0,
    packagingFee: Number(dto.pricing?.packagingFee ?? 0) || 0,
    deliveryFee: Number(dto.pricing?.deliveryFee ?? 0) || 0,
    platformFee: Number(dto.pricing?.platformFee ?? 0) || 0,
    discount: Number(dto.pricing?.discount ?? 0) || 0,
    couponCode: dto.pricing?.couponCode ? String(dto.pricing.couponCode).trim().toUpperCase() : null,
    total: Number(dto.pricing?.total ?? 0) || 0,
    currency: String(dto.pricing?.currency || "INR"),
  };

  const computedTotal = Math.max(
    0,
    (Number.isFinite(normalizedPricing.subtotal) ? normalizedPricing.subtotal : 0) +
    (Number.isFinite(normalizedPricing.tax) ? normalizedPricing.tax : 0) +
    (Number.isFinite(normalizedPricing.packagingFee) ? normalizedPricing.packagingFee : 0) +
    (Number.isFinite(normalizedPricing.deliveryFee) ? normalizedPricing.deliveryFee : 0) +
    (Number.isFinite(normalizedPricing.platformFee) ? normalizedPricing.platformFee : 0) -
    (Number.isFinite(normalizedPricing.discount) ? normalizedPricing.discount : 0)
  );

  if (!Number.isFinite(normalizedPricing.total) || normalizedPricing.total <= 0) {
    normalizedPricing.total = Math.round(computedTotal * 100) / 100;
  } else {
    normalizedPricing.total = Math.round(normalizedPricing.total * 100) / 100;
  }

  const payment = {
    method: paymentMethod,
    status: isCash ? "cod_pending" : isWallet ? "paid" : "created",
    amountDue: normalizedPricing.total || 0,
    razorpay: {},
    qr: {},
  };

  // Estimate platform profit to prevent negative profit transactions.
  // Since grocery may not have a rider earning natively calculated yet, assume 0 for check.
  let platformProfit = Math.max(0, 
    (Number.isFinite(normalizedPricing.deliveryFee) ? normalizedPricing.deliveryFee : 0) +
    (Number.isFinite(normalizedPricing.platformFee) ? normalizedPricing.platformFee : 0) -
    (Number.isFinite(normalizedPricing.discount) ? normalizedPricing.discount : 0)
  );
  
  if (platformProfit < 0) {
    throw new ValidationError("This coupon cannot be applied to this order as it exceeds allowed limits.");
  }

  const initialStatus = (paymentMethod === "razorpay" || paymentMethod === "card") ? "pending_payment" : "confirmed";

  const { FoodAdmin } = await import('../../../../core/admin/admin.model.js');
  const storeAdmin = await FoodAdmin.findOne({ adminType: 'super_admin' }).lean();
  let originLat = storeAdmin?.latitude || null;
  let originLng = storeAdmin?.longitude || null;
  let originAddress = storeAdmin?.address || '';

  let dLat = dto.address?.latitude ?? dto.address?.location?.coordinates?.[1];
  let dLng = dto.address?.longitude ?? dto.address?.location?.coordinates?.[0];

  let distanceKm = null;
  if (
    typeof originLat === 'number' && typeof originLng === 'number' &&
    typeof dLat === 'number' && typeof dLng === 'number'
  ) {
    const d = haversineKm(originLat, originLng, dLat, dLng);
    distanceKm = Number.isFinite(d) ? d : null;
  }

  const order = new GroceryOrder({
    userId: toObjectId(userId, 'User ID'),
    moduleType: dto.moduleType || 'grocery',
    zoneId: dto.zoneId ? toObjectId(dto.zoneId, 'Zone ID') : null,
    items: (dto.items || []).map(item => ({
      itemId: String(item.itemId || item.id),
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      unit: item.unit || '',
      image: item.image || '',
      notes: item.notes || ''
    })),
    deliveryAddress,
    deliveryDistance: distanceKm,
    deliveryLatitude: dLat,
    deliveryLongitude: dLng,
    originLatitude: originLat,
    originLongitude: originLng,
    originAddress: originAddress,
    customerName: String(dto.customerName || deliveryAddress.fullName || ""),
    customerPhone: String(dto.customerPhone || deliveryAddress.phone || ""),
    pricing: normalizedPricing,
    payment,
    orderStatus: initialStatus,
    statusHistory: [
      {
        at: new Date(),
        byRole: "SYSTEM",
        from: "",
        to: initialStatus,
        note: initialStatus === "pending_payment" ? "Order created, awaiting payment" : "Order placed",
      },
    ],
    note: String(dto.note || "")
  });

  let razorpayPayload = null;

  if (!bypassRazorpay && paymentMethod === "razorpay" && isRazorpayConfigured()) {
    const amountPaise = Math.round((normalizedPricing.total || 0) * 100);
    if (amountPaise < 100)
      throw new ValidationError("Amount too low for online payment");
    try {
      const rzOrder = await createRazorpayOrder(amountPaise, "INR", order._id.toString());
      razorpayPayload = {
        key: getRazorpayKeyId(),
        orderId: rzOrder.id,
        amount: rzOrder.amount,
        currency: rzOrder.currency || "INR",
      };
      payment.razorpay = { orderId: rzOrder.id, paymentId: "", signature: "" };
      payment.status = "created";
      order.payment = payment;
    } catch (err) {
      logger.error(`Razorpay order creation failed: ${err.message}`);
      throw new ValidationError(err?.message || "Payment gateway error");
    }
  }

  await order.save();
  await foodTransactionService.createInitialTransaction(order);
  await deductStock(order.items, order.moduleType);

  if (isWallet) {
    try {
      await userWalletService.deductWalletBalance(userId, order.pricing.total, `Payment for grocery order #${order.order_id || order._id}`, { orderId: order._id });
    } catch (err) {
      await GroceryOrder.deleteOne({ _id: order._id });
      throw err;
    }
  }

  try {
    const isAwaitingOnlinePayment =
      String(paymentMethod || "").toLowerCase() === "razorpay" &&
      String(payment?.status || "").toLowerCase() !== "paid";

    if (!isAwaitingOnlinePayment) {
      await notifyOwnersSafely([{ ownerType: "USER", ownerId: userId }], {
        title: "Grocery Order Confirmed! 🛒",
        body: `Your grocery order #${order.order_id || order._id} has been placed successfully.`,
        image: "https://i.ibb.co/5GzXz7r/Zinzoox-Brand-Image.png",
        data: {
          type: "order_created",
          orderId: String(order._id),
          orderMongoId: order._id.toString(),
          link: `/food/user/orders/${order._id.toString()}`,
        },
      });
    }
    if (initialStatus === "confirmed") {
      broadcastNewOrderToAdmin(order);
    }
  } catch (err) {
    logger.warn(`Notifications failed for grocery order ${order._id}: ${err.message}`);
  }

  // Handle Coupon usage (Only increment immediately if NOT awaiting online payment)
  const isAwaitingOnlinePaymentForCoupon = String(paymentMethod || "").toLowerCase() === "razorpay" && String(payment?.status || "").toLowerCase() !== "paid";

  if (!isAwaitingOnlinePaymentForCoupon) {
    const couponCode = dto.pricing?.couponCode ? String(dto.pricing.couponCode).trim().toUpperCase() : "";
    if (couponCode) {
      try {
        const offer = await FoodOffer.findOne({ couponCode }).lean();
        if (offer) {
          await FoodOffer.updateOne({ _id: offer._id }, { $inc: { usedCount: 1 } });
          await FoodOfferUsage.updateOne(
            { offerId: offer._id, userId: toObjectId(userId, 'User ID') },
            { $inc: { count: 1 }, $set: { lastUsedAt: new Date() } },
            { upsert: true },
          );
          broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
        }
      } catch (err) {
        logger.error(`Coupon usage update failed: ${err.message}`);
      }
    }
  }

  return { order: normalizeOrderForClient(order), razorpay: razorpayPayload };
}

export async function getOrderById(
  orderId,
  { userId, restaurantId, deliveryPartnerId, admin } = {},
) {
  await expireUnacceptedOrders();
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");
  let order = await FoodOrder.findOne(identity)
    .populate("dispatch.deliveryPartnerId", "name fullName phone phoneNumber rating totalRatings profileImage avatar")
    .populate("userId", "name fullName phone email")
    .populate("restaurantId", "restaurantName primaryContactNumber ownerPhone location address area city state pincode landmark")
    .populate("restaurantIds", "restaurantName primaryContactNumber ownerPhone location address area city state pincode landmark")
    .select("+deliveryOtp")
    .lean();

  if (order) {
    order.moduleType = order.moduleType || 'food';
  } else {
    order = await GroceryOrder.findOne(identity)
      .populate("dispatch.deliveryPartnerId", "name fullName phone phoneNumber rating totalRatings profileImage avatar")
      .populate("userId", "name fullName phone email")
      .select("+deliveryOtp")
      .lean();

    if (order) {
      order.moduleType = order.moduleType || 'grocery';
    }
  }

  if (!order) throw new NotFoundError("Order not found");

  // If order document has 0 coinsEarned, dynamically resolve it from the user's wallet transactions
  if (!order.coinsEarned || order.coinsEarned === 0) {
    try {
      const { FoodUserWallet } = await import('../../user/models/userWallet.model.js');
      const orderUserOid = order.userId?._id || order.userId;
      if (orderUserOid) {
        const wallet = await FoodUserWallet.findOne({ userId: orderUserOid });
        if (wallet && wallet.coinTransactions) {
          const match = wallet.coinTransactions.find(tx =>
            tx.type === 'earned' &&
            (tx.description?.includes(String(order._id)) || (order.order_id && tx.description?.includes(order.order_id)))
          );
          if (match) {
            order.coinsEarned = match.amount;
          }
        }
      }
    } catch (err) {
      console.error('Failed to resolve coinsEarned for order details:', err);
    }
  }

  if (admin) return normalizeOrderForClient(order);

  const orderUserId = order.userId?._id?.toString() || order.userId?.toString();
  const orderPartnerId = order.dispatch?.deliveryPartnerId?._id?.toString() || order.dispatch?.deliveryPartnerId?.toString();

  // Resolve all restaurant IDs on the order (both legacy field and restaurantIds array)
  const rIds = (order.restaurantIds || []).map(id => id?.toString?.() || String(id));
  if (order.restaurantId) {
    rIds.push(order.restaurantId?._id?.toString() || order.restaurantId?.toString());
  }

  if (userId && orderUserId !== userId.toString())
    throw new ForbiddenError("Not your order");
  if (restaurantId && !rIds.includes(restaurantId.toString()))
    throw new ForbiddenError("Not your restaurant order");
  if (deliveryPartnerId && orderPartnerId !== deliveryPartnerId.toString())
    throw new ForbiddenError("Not assigned to you");

  if (deliveryPartnerId || restaurantId) {
    return sanitizeOrderForExternal(order);
  }

  if (userId) {
    const out = normalizeOrderForClient(order);
    
    // Fallback for older orders without platformGstNumber
    if (out.pricing && !out.pricing.platformGstNumber) {
      try {
        const { FoodFeeSettings } = await import('../../admin/models/feeSettings.model.js');
        const feeSettings = await FoodFeeSettings.findOne().select('gstNumber').lean();
        if (feeSettings && feeSettings.gstNumber) {
          out.pricing.platformGstNumber = feeSettings.gstNumber;
        }
      } catch (err) {
        console.error('Failed to attach fallback platformGstNumber:', err);
      }
    }

    out.deliveryVerification = {
      dropOtp: {
        required: false,
        verified: false
      }
    };

    // Attach current coin settings min/max to allow frontend range display before delivery
    try {
      const { FoodBusinessSettings } = await import('../../admin/models/businessSettings.model.js');
      const settings = await FoodBusinessSettings.findOne().select('coinSettings').lean();
      if (settings?.coinSettings?.isActive) {
        out.coinSettings = {
          minCoinsPerOrder: settings.coinSettings.minCoinsPerOrder,
          maxCoinsPerOrder: settings.coinSettings.maxCoinsPerOrder
        };
      }
    } catch (err) {
      console.error('Failed to attach coinSettings to order details:', err);
    }

    return out;
  }

  return sanitizeOrderForExternal(order);
}

export async function getDropOtpUser(orderId, userId) {
  throw new ValidationError("Delivery OTP verification is discontinued.");
}

/**
 * Watchdog: Recovers orders stuck in 'assigned' or 'preparing' status for too long.
 * Should be called on server startup.
 */
export async function recoverStuckOrders() {
  const now = new Date();
  const FIVE_MIN = 5 * 60 * 1000;
  const TWO_MIN = 2 * 60 * 1000;

  try {
    // 1. Stuck in 'assigned' (partner never accepted) for > 2m
    const stuckAssigned = await FoodOrder.find({
      'dispatch.status': 'assigned',
      'dispatch.acceptedAt': { $exists: false },
      'dispatch.assignedAt': { $lt: new Date(now - TWO_MIN) },
      orderStatus: { $nin: ['delivered', 'cancelled_by_user', 'cancelled_by_restaurant'] }
    });

    if (stuckAssigned.length > 0) {
      logger.info(`Watchdog: Healing ${stuckAssigned.length} stuck assigned orders.`);
      for (const order of stuckAssigned) {
        // Reset status to unassigned
        order.dispatch.status = 'unassigned';
        order.dispatch.deliveryPartnerId = null;
        await order.save();
      }
    }

    // 2. Clear old dispatching locks (cleanup in case of crash)
    await FoodOrder.updateMany(
      { 'dispatch.dispatchingAt': { $lt: new Date(now - FIVE_MIN) } },
      { $unset: { 'dispatch.dispatchingAt': '' } }
    );

  } catch (err) {
    logger.error(`Watchdog recovery error: ${err.message}`);
  }
}

export async function resyncState(userId, role) {
  if (role === "USER") {
    const order = await FoodOrder.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      orderStatus: {
        $nin: [
          "delivered",
          "cancelled_by_user",
          "cancelled_by_restaurant",
          "cancelled_by_admin",
        ],
      },
    })
      .select("+deliveryOtp")
      .sort({ createdAt: -1 })
      .lean();

    if (order) {
      const out = normalizeOrderForClient(order);
      // Re-add handover OTP if order is picked up
      if (
        (order.deliveryState?.currentPhase === "at_drop" || order.orderStatus === "picked_up") &&
        !order.deliveryVerification?.dropOtp?.verified &&
        order.deliveryOtp
      ) {
        out.handoverOtp = order.deliveryOtp;
      }
      return { activeOrder: out };
    }
    return { activeOrder: null };
  }

  if (role === "DELIVERY_PARTNER") {
    const order = await FoodOrder.findOne({
      "dispatch.deliveryPartnerId": new mongoose.Types.ObjectId(userId),
      "dispatch.status": { $in: ["assigned", "accepted"] },
      orderStatus: {
        $nin: ["delivered", "cancelled_by_user", "cancelled_by_restaurant"],
      },
    })
      .lean();
    return { activeOrder: order ? sanitizeOrderForExternal(order) : null };
  }

  return {};
}

export async function cancelOrder(orderId, userId, reason) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  let order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });

  if (!order) {
    order = await GroceryOrder.findOne({
      ...identity,
      userId: new mongoose.Types.ObjectId(userId),
    });
  }

  if (!order) throw new NotFoundError("Order not found");

  const allowed = ["confirmed"];
  if (!allowed.includes(order.orderStatus))
    throw new ValidationError("Order cannot be cancelled after processing has started.");

  const from = order.orderStatus;
  order.orderStatus = "cancelled_by_user";
  pushStatusHistory(order, {
    byRole: "USER",
    byId: userId,
    from,
    to: "cancelled_by_user",
    note: reason || "",
  });

  const paymentMethod = String(order.payment?.method || "cash").toLowerCase();
  const paymentStatus = String(order.payment?.status || "cod_pending").toLowerCase();
  try {
    await applyCancellationRefund(order, { cancelledBy: 'user' });
  } catch (err) {
    console.error(`Refund processing error for Order ${orderId}:`, err);
    order.payment.refund = { status: "failed", amount: order.pricing.total };
  }

  // Rollback coupon usage exactly once if it was committed

  const wasUsageCommitted = (paymentMethod !== "razorpay") || (paymentMethod === "razorpay" && paymentStatus === "paid");
  
  if (wasUsageCommitted && order.pricing?.couponCode) {
    try {
      const couponCode = String(order.pricing.couponCode).trim().toUpperCase();
      const offer = await FoodOffer.findOne({ couponCode }).lean();
      if (offer) {
        await FoodOffer.updateOne({ _id: offer._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
        await FoodOfferUsage.updateOne(
          { offerId: offer._id, userId: new mongoose.Types.ObjectId(userId), count: { $gt: 0 } },
          { $inc: { count: -1 } }
        );
        broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
      }
    } catch (err) {
      logger.error(`Failed to rollback coupon usage on cancellation: ${err.message}`);
    }
  }

  await order.save();

  enqueueOrderEvent("order_cancelled_by_user", {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    userId,
    reason: reason || "",
  });

  // Sync transaction status
  try {
    const finalPaymentMethod = String(order.payment?.method || paymentMethod || "cash").toLowerCase();
    const finalPaymentStatus = String(order.payment?.status || paymentStatus || "cod_pending").toLowerCase();
    const isOnlinePaid =
      (finalPaymentMethod === "razorpay" || finalPaymentMethod === "wallet") &&
      (finalPaymentStatus === "paid" || finalPaymentStatus === "refunded");
    await foodTransactionService.updateTransactionStatus(order._id, 'cancelled_by_user', {
      status: isOnlinePaid ? 'refunded' : 'failed',
      note: `Order cancelled by user: ${reason || "No reason"}`,
      recordedByRole: 'USER',
      recordedById: userId
    });
  } catch (err) {
    logger.warn(`cancelOrder transaction sync failed: ${err?.message || err}`);
  }

  // Notify User and Restaurant about the cancellation
  const finalPaymentMethod = String(order.payment?.method || paymentMethod || "cash").toLowerCase();
  const finalPaymentStatus = String(order.payment?.status || paymentStatus || "cod_pending").toLowerCase();
  
  let refundDetail = "";
  if (finalPaymentStatus === "paid" || finalPaymentStatus === "refunded") {
    if (finalPaymentMethod === "wallet") {
      refundDetail = ` Your refund of ₹${order.pricing.total} has been credited to your wallet.`;
    } else if (finalPaymentMethod === "razorpay") {
      refundDetail = ` Your refund of ₹${order.pricing.total} is being processed and will be credited to your original payment method.`;
    }
  }

  await notifyOwnersSafely(
    [
      { ownerType: "USER", ownerId: userId },
      { ownerType: "RESTAURANT", ownerId: order.restaurantId },
    ],
    {
      title: "Order Cancelled ",
      body: `Order #${order.order_id || order._id} has been cancelled successfully.${refundDetail}`,
      image: "https://i.ibb.co/5GzXz7r/Zinzoox-Brand-Image.png",
      data: {
        type: "order_cancelled",
        orderId: String(order._id.toString()),
        orderMongoId: String(order._id),
      },
    },
  );

  // Notify Admin about order cancellation (MongoDB Notification + FCM Push + Socket Alert Sound)
  await broadcastCancelledOrderToAdmin(order, { cancelledBy: "user", reason });

  // Real-time: status update via socket
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        message: `Order #${order.order_id || order._id} has been cancelled successfully.${refundDetail}`
      };
      io.to(rooms.user(userId)).emit("order_status_update", payload);
      const rIds = order.restaurantIds && order.restaurantIds.length > 0 ? order.restaurantIds : [order.restaurantId].filter(Boolean);
      rIds.forEach(rId => {
        io.to(rooms.restaurant(rId)).emit("order_status_update", payload);
      });
      broadcastOrderUpdateToAdmin(order._id.toString());
    }
  } catch (err) {
    logger.warn(`cancelOrder socket emit failed: ${err?.message || err}`);
  }

  return normalizeOrderForClient(order);
}

export async function updateOrderInstructions(orderId, userId, instructions) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  const order = await FoodOrder.findOne({
    ...identity,
    userId: new mongoose.Types.ObjectId(userId),
  });
  if (!order) throw new NotFoundError("Order not found");

  const allowedStatuses = ['created', 'confirmed', 'preparing'];
  if (!allowedStatuses.includes(order.orderStatus)) {
    throw new ValidationError("Instructions can no longer be updated for this order");
  }

  order.note = String(instructions || "").trim();
  await order.save();
  broadcastOrderUpdateToAdmin(order._id.toString());
  return order;
}

// ----- Restaurant -----
export async function listOrdersRestaurant(restaurantId, query) {
  await expireUnacceptedOrders({
    $or: [
      { restaurantId: new mongoose.Types.ObjectId(restaurantId) },
      { restaurantIds: new mongoose.Types.ObjectId(restaurantId) }
    ]
  });
  const { page, limit, skip } = buildPaginationOptions(query);
  const filter = {
    $and: [
      {
        $or: [
          { restaurantId: new mongoose.Types.ObjectId(restaurantId) },
          { restaurantIds: new mongoose.Types.ObjectId(restaurantId) }
        ]
      },
      {
        $or: [
          { "payment.method": { $in: ["cash", "wallet"] } },
          { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded"] } }
        ]
      }
    ]
  };
  const [docs, total] = await Promise.all([
    FoodOrder.find(filter)
      .populate("userId", "name phone email profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FoodOrder.countDocuments(filter),
  ]);
  return buildPaginatedResult({ docs: docs.map(d => normalizeOrderForClient(d)), total, page, limit });
}

export async function updateOrderStatusRestaurant(
  orderId,
  restaurantId,
  orderStatus,
  note = "",
) {
  await expireUnacceptedOrders({
    $or: [
      { restaurantId: new mongoose.Types.ObjectId(restaurantId) },
      { restaurantIds: new mongoose.Types.ObjectId(restaurantId) }
    ]
  });
  const identity = buildOrderIdentityFilter(orderId);
  let order = await FoodOrder.findOne({
    ...identity,
    $or: [
      { restaurantId: new mongoose.Types.ObjectId(restaurantId) },
      { restaurantIds: new mongoose.Types.ObjectId(restaurantId) }
    ]
  });
  if (!order) throw new NotFoundError("Order not found");

  const targetStatus = String(orderStatus || "").toLowerCase();
  if (targetStatus === "preparing" || targetStatus === "confirmed") {
    const now = new Date();
    const deadline = order.acceptanceDeadlineAt ? new Date(order.acceptanceDeadlineAt) : null;
    if (deadline && deadline.getTime() <= now.getTime()) {
      await expireUnacceptedOrders({ _id: order._id });
      throw new ValidationError("Order acceptance window has expired");
    }
  }
  const from = order.orderStatus;
  if (!isStatusAdvance(from, orderStatus)) {
    throw new ValidationError(
      `Current order status '${from}' is further ahead than '${orderStatus}'. Order cannot be moved backwards.`
    );
  }

  order.orderStatus = orderStatus;
  if (note && String(note).trim()) {
    order.note = String(note).trim();
  }

  const normalizedPaymentMethod = String(order.payment?.method || "cash").toLowerCase();
  const prevPaymentStatus = String(order.payment?.status || "cod_pending").toLowerCase();
  if (String(orderStatus) === "delivered" && normalizedPaymentMethod === "cash" && prevPaymentStatus === "cod_pending") {
    // COD should become paid once delivery is completed, even in restaurant-managed status updates.
    order.payment.status = "paid";
  }

  pushStatusHistory(order, {
    byRole: "RESTAURANT",
    byId: restaurantId,
    from,
    to: orderStatus,
    note: note || "",
  });

  if (String(orderStatus).includes("cancel")) {
    const paymentMethod = String(order.payment?.method || "cash").toLowerCase();
    const paymentStatus = String(order.payment?.status || "cod_pending").toLowerCase();
    const wasUsageCommitted = (paymentMethod !== "razorpay") || (paymentMethod === "razorpay" && paymentStatus === "paid");
    
    if (wasUsageCommitted && order.pricing?.couponCode) {
      try {
        const couponCode = String(order.pricing.couponCode).trim().toUpperCase();
        const offer = await FoodOffer.findOne({ couponCode }).lean();
        if (offer) {
          await FoodOffer.updateOne({ _id: offer._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
          await FoodOfferUsage.updateOne(
            { offerId: offer._id, userId: new mongoose.Types.ObjectId(order.userId), count: { $gt: 0 } },
            { $inc: { count: -1 } }
          );
          broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
        }
      } catch (err) {
        logger.error(`Failed to rollback coupon usage on restaurant cancellation: ${err.message}`);
      }
    }
  }

  await order.save();

  if (String(orderStatus) === "delivered") {
    try {
      const ledgerKind =
        normalizedPaymentMethod === "cash" && prevPaymentStatus === "cod_pending"
          ? "cod_marked_paid_on_delivery"
          : "payment_snapshot_sync";
      await foodTransactionService.updateTransactionStatus(order._id, ledgerKind, {
        status: "captured",
        recordedByRole: "RESTAURANT",
        recordedById: restaurantId,
        note: `Delivery completed from restaurant flow. Prev payment status: ${prevPaymentStatus}`,
      });
    } catch (err) {
      logger.warn(`updateOrderStatusRestaurant delivered transaction sync failed: ${err?.message || err}`);
    }

    try {
      await userWalletService.awardCoinsForOrder(order.userId, order._id);
    } catch (err) {
      logger.warn(`updateOrderStatusRestaurant award coins failed: ${err?.message || err}`);
    }
  }

  // Custom messages / titles for status updates
  let title = `Order ${order._id.toString()} updated`;
  let body = `Status changed to ${String(orderStatus).replace(/_/g, " ")}`;

  if (orderStatus === "confirmed") {
    title = "Order Accepted! 🧑‍🍳";
    body = "The restaurant has accepted your order and is starting to prepare it.";
  } else if (orderStatus === "preparing") {
    title = "Food is being prepared! 🍳";
    body = "Your food is currently being prepared by the restaurant.";
  } else if (orderStatus === "ready_for_pickup") {
    title = "Food is ready! 🛍️";
    body = "Your order is ready and waiting to be picked up.";
  } else if (String(orderStatus).includes("cancel")) {
    const isOnlinePaid = order.payment.method === "razorpay" && (order.payment.status === "paid" || order.payment.status === "refunded");
    const refundDetail = isOnlinePaid ? ` Your refund of ₹${order.pricing.total} is being processed and will be credited to your original payment method within 5-7 working days.` : "";

    title = "Order Cancelled ❌";
    body = (note && String(note).trim()) ? note : `Unfortunately, your order has been cancelled by the restaurant.${refundDetail}`;
  }

  // Real-time: status update to restaurant room.
  try {
    const io = getIO();
    if (io) {
      console.log(
        `[DEBUG] Emitting status update to restaurant ${restaurantId} and user ${order.userId}: ${orderStatus}`,
      );
      const payload = {
        orderMongoId: order._id?.toString?.(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        note: order.note || note || "",
        title,
        message: body,
      };

      const userRoom = rooms.user(order.userId);
      io.to(userRoom).emit("order_status_update", payload);

      const rIds = order.restaurantIds && order.restaurantIds.length > 0 ? order.restaurantIds : [restaurantId || order.restaurantId].filter(Boolean);
      rIds.forEach(rId => {
        io.to(rooms.restaurant(rId)).emit("order_status_update", payload);
      });

      // Notify assigned rider via socket if they exist
      const assignedRiderId = order.dispatch?.deliveryPartnerId;
      if (assignedRiderId) {
        const riderRoom = rooms.delivery(assignedRiderId);
        console.log(`[DEBUG] Emitting order_status_update to rider room: ${riderRoom}`);
        io.to(riderRoom).emit("order_status_update", payload);
      }
      broadcastOrderUpdateToAdmin(order._id.toString());
    }

    const notifyList = [
      { ownerType: "USER", ownerId: order.userId },
      { ownerType: "RESTAURANT", ownerId: restaurantId },
    ];

    const assignedRiderId = order.dispatch?.deliveryPartnerId;
    if (assignedRiderId) {
      notifyList.push({ ownerType: "DELIVERY_PARTNER", ownerId: assignedRiderId });
    }

    let riderTitle = `Order #${order.order_id || order._id} updated`;
    let riderBody = `The order status is now ${String(orderStatus).replace(/_/g, " ")}.`;

    if (String(orderStatus).includes("cancel")) {
      riderTitle = "Order Cancelled ❌";
      riderBody = `Order #${order.order_id || order._id} has been cancelled. Please stop your current task.`;

      // Sync transaction status
      try {
        const isOnlinePaid = order.payment.method === "razorpay" && (order.payment.status === "paid" || order.payment.status === "refunded");
        await foodTransactionService.updateTransactionStatus(order._id, 'cancelled_by_restaurant', {
          status: isOnlinePaid ? 'refunded' : 'failed',
          note: `Order cancelled by restaurant/admin`,
          recordedByRole: 'RESTAURANT',
          recordedById: restaurantId
        });
      } catch (err) {
        logger.warn(`updateOrderStatusRestaurant transaction sync failed: ${err?.message || err}`);
      }
    }

    await notifyOwnersSafely(
      notifyList,
      {
        title: title,
        body: body,
        image: "https://i.ibb.co/5GzXz7r/Zinzoox-Brand-Image.png",
        data: {
          type: "order_status_update",
          orderId: order._id.toString(),
          orderMongoId: order._id?.toString?.() || "",
          orderStatus: String(orderStatus || ""),
          link: `/food/user/orders/${order._id?.toString?.() || ""}`,
        },
      },
    );
  } catch (err) {
    console.error("[DEBUG] Error emitting status update to restaurant:", err);
  }

  // Real-time: delivery request / ready notifications.
  try {
    const io = getIO();
    if (io) {
      // On accept (confirmed or preparing) -> request delivery partners via central logic
      // Auto-assign block removed as delivery partner system is discontinued

      // When ready for pickup -> ping assigned delivery partner.
      if (String(orderStatus) === 'ready_for_pickup' && String(from) !== 'ready_for_pickup') {
        console.log(`[DEBUG] Order ${order._id.toString()} changed to 'ready_for_pickup'.`);
        const assignedId = order.dispatch?.deliveryPartnerId?.toString?.() || order.dispatch?.deliveryPartnerId;
        if (assignedId) {
          console.log(`[DEBUG] Notifying assigned partner ${assignedId} that order is ready.`);
          const restaurant = await FoodRestaurant.findById(order.restaurantId).select('restaurantName location area city state').lean();
          const payload = buildDeliverySocketPayload(order, restaurant);
          logger.info(
            `[DeliveryDispatch] Emitting order_ready to ${rooms.delivery(assignedId)} for order ${order._id.toString()}`,
          );
          io.to(rooms.delivery(assignedId)).emit('order_ready', payload);
        } else {
          console.log(`[DEBUG] Order ${order._id.toString()} is ready but no partner assigned.`);
        }
      }
    }
  } catch (err) {
    console.error('[DEBUG] Error in delivery notification logic:', err);
  }

  enqueueOrderEvent('restaurant_order_status_updated', {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    restaurantId,
    from,
    to: orderStatus
  });

  if (String(orderStatus).includes("cancel")) {
    try {
      await applyCancellationRefund(order, { cancelledBy: 'restaurant' });
    } catch (err) {
      console.error(`Automated refund failed for Order ${order._id.toString()} (Restaurant Cancel):`, err);
      order.payment.refund = { status: "failed", amount: order.pricing.total };
    }
    await order.save();
  }

  return normalizeOrderForClient(order);
}

/**
 * Manually re-trigger delivery partner search for a restaurant order.
 * Only allowed if status is preparing/ready and no partner has accepted yet.
 */
export async function resendDeliveryNotificationRestaurant(orderId, restaurantId) {
  return { success: false, message: "Delivery service disabled" };
}

export async function resendDeliveryNotificationAdmin(orderId) {
  return { success: false, message: "Delivery service disabled" };
}

export async function getCurrentTripDelivery(deliveryPartnerId) {
  return null;
}

// ----- Delivery: available, accept, reject, status -----
export async function listOrdersAvailableDelivery(deliveryPartnerId, query) {
  return { docs: [], total: 0, page: 1, limit: 10 };
}

export async function acceptOrderDelivery(orderId, deliveryPartnerId) {
  throw new ValidationError("Delivery service is disabled");
}

export async function rejectOrderDelivery(orderId, deliveryPartnerId) {
  throw new ValidationError("Delivery service is disabled");
}

export async function confirmReachedPickupDelivery(orderId, deliveryPartnerId) {
  throw new ValidationError("Delivery service is disabled");
}

/**
 * Slide to confirm pickup (Bill uploaded)
 */
export async function confirmPickupDelivery(
  orderId,
  deliveryPartnerId,
  billImageUrl,
) {
  throw new ValidationError("Delivery service is disabled");
}

export async function confirmReachedDropDelivery(orderId, deliveryPartnerId) {
  throw new ValidationError("Delivery service is disabled");
}

export async function verifyDropOtpDelivery(orderId, deliveryPartnerId, otp) {
  throw new ValidationError("Delivery service is disabled");
}

export async function completeDelivery(orderId, deliveryPartnerId, body = {}) {
  throw new ValidationError("Delivery service is disabled");
}

export async function updateOrderStatusDelivery(orderId, deliveryPartnerId, orderStatus) {
  throw new ValidationError("Delivery service is disabled");
}

// ----- COD QR collection -----
export async function createCollectQr(
  orderId,
  deliveryPartnerId,
  customerInfo = {},
) {
  return paymentService.createCollectQr(orderId, deliveryPartnerId, customerInfo);
}


export async function getPaymentStatus(orderId, deliveryPartnerId) {
  return paymentService.getPaymentStatus(orderId, deliveryPartnerId);
}

export async function switchToCash(orderId, deliveryPartnerId) {
  return paymentService.switchToCash(orderId, deliveryPartnerId);
}


// ----- Admin -----
async function resolveFoodOrdersItemRestaurants(ordersList) {
  if (!ordersList || !Array.isArray(ordersList) || ordersList.length === 0) return;
  
  const foodItemCache = new Map();
  const restaurantCache = new Map();

  for (const doc of ordersList) {
    if (doc.items && Array.isArray(doc.items)) {
      let changed = false;
      for (const item of doc.items) {
        if (!item.restaurantName || String(item.restaurantName).trim() === "") {
          const itemKey = String(item.itemId);
          let resolved = foodItemCache.get(itemKey);
          if (!resolved) {
            try {
              const foodItem = await mongoose.model('FoodItem').findById(item.itemId).lean();
              if (foodItem && foodItem.restaurantId) {
                const rId = String(foodItem.restaurantId);
                let rName = restaurantCache.get(rId);
                if (!rName) {
                  const restDoc = await mongoose.model('FoodRestaurant').findById(rId).select('restaurantName').lean();
                  rName = restDoc?.restaurantName || "ZinZooX";
                  restaurantCache.set(rId, rName);
                }
                resolved = { restaurantId: rId, restaurantName: rName };
                foodItemCache.set(itemKey, resolved);
              }
            } catch (err) {
              logger.warn(`Failed to dynamically resolve restaurant for item ${item.itemId}: ${err.message}`);
            }
          }

          if (resolved) {
            item.restaurantId = resolved.restaurantId;
            item.restaurantName = resolved.restaurantName;
            changed = true;
          }
        }
      }

      if (changed) {
        mongoose.model('FoodOrder').updateOne(
          { _id: doc._id },
          { $set: { items: doc.items } }
        ).catch(err => logger.warn(`Failed to self-heal items for order ${doc._id}: ${err.message}`));
      }
    }
  }
}

export async function listOrdersAdmin(query) {
  const { page, limit, skip } = buildPaginationOptions(query);
  const moduleType = query.moduleType || 'food';
  // Base payment filter: Allow cash/wallet immediately, but require Razorpay/QR to be paid/authorized
  const paymentFilter = {
    $or: [
      { "payment.method": { $in: ["cash", "wallet"] } },
      { "payment.status": { $in: ["paid", "authorized", "captured", "settled", "refunded", "cod_pending"] } },
    ],
  };

  const buildCollectionFilter = () => {
    const filter = { ...paymentFilter };
    const rawStatus = typeof query.status === "string" ? query.status.trim().toLowerCase() : "";
    const cancelledBy = typeof query.cancelledBy === "string" ? query.cancelledBy.trim().toLowerCase() : "";
    const zoneIdRaw = typeof query.zoneId === "string" ? query.zoneId.trim() : "";
    const startDateRaw = typeof query.startDate === "string" ? query.startDate.trim() : "";
    const endDateRaw = typeof query.endDate === "string" ? query.endDate.trim() : "";

    if (rawStatus && rawStatus !== "all") {
      switch (rawStatus) {
        case "pending":
          filter.orderStatus = { $in: ["created", "confirmed", "pending"] };
          break;
        case "accepted":
          filter.orderStatus = { $in: ["accepted", "confirmed"] };
          break;
        case "processing":
          filter.orderStatus = { $in: ["confirmed", "preparing", "processing"] };
          break;
        case "out-for-delivery":
        case "food-on-the-way":
          filter.orderStatus = { $in: ["picked_up", "out_for_delivery"] };
          break;
        case "delivered":
          filter.orderStatus = "delivered";
          break;
        case "canceled":
        case "cancelled":
          filter.orderStatus = {
            $in: [
              "cancelled",
              "canceled",
              "cancelled_by_user",
              "cancelled_by_restaurant",
              "cancelled_by_admin",
            ],
          };
          break;
        case "restaurant-cancelled":
          filter.orderStatus = "cancelled_by_restaurant";
          break;
        case "payment-failed":
          filter["payment.status"] = "failed";
          break;
        case "refunded":
          filter["payment.status"] = "refunded";
          break;
        case "offline-payments":
          filter["payment.method"] = "cash";
          filter.orderStatus = { $in: ["created", "confirmed", "delivered"] };
          break;
        case "scheduled":
          filter.scheduledAt = { $ne: null };
          break;
      }
    }

    if (cancelledBy) {
      if (cancelledBy === "restaurant") {
        filter.orderStatus = "cancelled_by_restaurant";
      } else if (cancelledBy === "user" || cancelledBy === "customer") {
        filter.orderStatus = "cancelled_by_user";
      }
    }

    if (zoneIdRaw && mongoose.Types.ObjectId.isValid(zoneIdRaw)) {
      filter.zoneId = new mongoose.Types.ObjectId(zoneIdRaw);
    }

    if (startDateRaw || endDateRaw) {
      const createdAt = {};
      const start = startDateRaw ? new Date(startDateRaw) : null;
      const end = endDateRaw ? new Date(endDateRaw) : null;
      if (start && !Number.isNaN(start.getTime())) {
        createdAt.$gte = start;
      }
      if (end && !Number.isNaN(end.getTime())) {
        createdAt.$lte = end;
      }
      if (Object.keys(createdAt).length > 0) {
        filter.createdAt = createdAt;
      }
    }
    return filter;
  };

  const filter = buildCollectionFilter();
  let docs = [];
  let total = 0;

  if (moduleType === 'food') {
    const foodFilter = { ...filter, $and: [{ ...paymentFilter }] };
    delete foodFilter.$or; // ensure the base payment filter is inside $and
    
    let additionalOr = null;
    
    if (query.restaurantId && mongoose.Types.ObjectId.isValid(query.restaurantId)) {
      const rIdObj = new mongoose.Types.ObjectId(query.restaurantId);
      additionalOr = [
        { restaurantId: rIdObj },
        { restaurantIds: rIdObj }
      ];
    }
    if (query.zoneId && mongoose.Types.ObjectId.isValid(query.zoneId)) {
      const zoneRestaurantIds = await FoodRestaurant.find({
        zoneId: new mongoose.Types.ObjectId(query.zoneId),
      }).distinct("_id");
      const zoneRIdObjs = zoneRestaurantIds.map(id => new mongoose.Types.ObjectId(id));
      if (additionalOr) {
        const filterRIdStr = String(query.restaurantId);
        const inZone = zoneRestaurantIds.some(id => String(id) === filterRIdStr);
        if (!inZone) {
          additionalOr = [{ restaurantId: null }, { restaurantIds: null }];
        }
      } else {
        additionalOr = [
          { restaurantId: { $in: zoneRIdObjs } },
          { restaurantIds: { $in: zoneRIdObjs } }
        ];
      }
    }

    if (additionalOr) {
      foodFilter.$and.push({ $or: additionalOr });
    }

    [docs, total] = await Promise.all([
      FoodOrder.find(foodFilter)
        .select("+deliveryOtp")
        .populate("userId", "name phone email")
        .populate("dispatch.deliveryPartnerId", "name phone")
        .populate("restaurantId", "restaurantName ownerPhone primaryContactNumber phone")
        .populate("restaurantIds", "restaurantName ownerPhone primaryContactNumber phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FoodOrder.countDocuments(foodFilter),
    ]);
    await resolveFoodOrdersItemRestaurants(docs);
  } else if (moduleType === 'grocery' || moduleType === 'accessories') {
    const groceryFilter = { ...filter };
    groceryFilter.moduleType = moduleType;

    [docs, total] = await Promise.all([
      GroceryOrder.find(groceryFilter)
        .select("+deliveryOtp")
        .populate("userId", "name phone email")
        .populate("dispatch.deliveryPartnerId", "name phone")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      GroceryOrder.countDocuments(groceryFilter),
    ]);
  } else {
    // moduleType === 'all'
    const foodFilter = { ...filter };
    if (query.zoneId && mongoose.Types.ObjectId.isValid(query.zoneId)) {
      const zoneRestaurantIds = await FoodRestaurant.find({
        zoneId: new mongoose.Types.ObjectId(query.zoneId),
      }).distinct("_id");
      foodFilter.restaurantId = { $in: zoneRestaurantIds };
    }

    const groceryFilter = { ...filter };

    const [foodDocs, groceryDocs] = await Promise.all([
      FoodOrder.find(foodFilter)
        .select("+deliveryOtp")
        .populate("userId", "name phone email")
        .populate("dispatch.deliveryPartnerId", "name phone")
        .populate("restaurantId", "restaurantName ownerPhone primaryContactNumber phone")
        .populate("restaurantIds", "restaurantName ownerPhone primaryContactNumber phone")
        .lean(),
      GroceryOrder.find(groceryFilter)
        .select("+deliveryOtp")
        .populate("userId", "name phone email")
        .populate("dispatch.deliveryPartnerId", "name phone")
        .lean(),
    ]);

    await resolveFoodOrdersItemRestaurants(foodDocs);

    const allDocs = [...foodDocs, ...groceryDocs].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    total = allDocs.length;
    docs = allDocs.slice(skip, skip + limit);
  }

  const paginated = buildPaginatedResult({ docs: docs.map(d => normalizeOrderForClient(d)), total, page, limit });
  return { ...paginated, orders: paginated.data };
}

export async function assignDeliveryPartnerAdmin(
  orderId,
  deliveryPartnerId,
  adminId,
) {
  const order = await FoodOrder.findById(orderId);
  if (!order) throw new NotFoundError("Order not found");
  if (order.dispatch.status === "accepted")
    throw new ValidationError("Order already accepted by partner");

  const partner = await FoodDeliveryPartner.findById(deliveryPartnerId)
    .select("status")
    .lean();
  if (!partner || partner.status !== "approved")
    throw new ValidationError("Delivery partner not available");

  order.dispatch.status = 'assigned';
  order.dispatch.deliveryPartnerId = new mongoose.Types.ObjectId(deliveryPartnerId);
  order.dispatch.assignedAt = new Date();
  pushStatusHistory(order, { byRole: 'ADMIN', byId: adminId, from: order.dispatch.status, to: 'assigned' });
  await order.save();
  enqueueOrderEvent('delivery_partner_assigned', {
    orderMongoId: order._id?.toString?.(),
    orderId: order._id.toString(),
    deliveryPartnerId,
    adminId
  });
  return normalizeOrderForClient(order);
}

export async function deleteOrderAdmin(orderId, adminId) {
  const identity = buildOrderIdentityFilter(orderId);
  if (!identity) throw new ValidationError("Order id required");

  let order = await FoodOrder.findOne(identity).lean();
  let isGrocery = false;

  if (!order) {
    order = await GroceryOrder.findOne(identity).lean();
    if (order) isGrocery = true;
  }

  if (!order) throw new NotFoundError("Order not found");

  const orderMongoId = order._id;
  const readableOrderId = String(order.orderId || order.order_id || orderMongoId.toString());

  // Keep support tickets but detach deleted order reference.
  const deletePromise = isGrocery
    ? GroceryOrder.deleteOne({ _id: orderMongoId })
    : FoodOrder.deleteOne({ _id: orderMongoId });

  await Promise.all([
    FoodSupportTicket.updateMany(
      { orderId: orderMongoId },
      { $set: { orderId: null } },
    ),
    FoodTransaction.deleteMany({
      $or: [{ orderId: orderMongoId }, { orderReadableId: readableOrderId }],
    }),
    deletePromise,
  ]);

  // Remove realtime tracking node if present.
  try {
    const db = getFirebaseDB();
    if (db && (order?.orderId || order?.order_id)) {
      await db.ref(`active_orders/${orderMongoId.toString()}`).remove();
    }
  } catch (err) {
    logger.warn(`Delete order firebase cleanup failed: ${err?.message || err}`);
  }

  // Notify connected apps so stale UI entries can disappear without refresh.
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: String(orderMongoId),
        orderId: readableOrderId,
        deletedBy: "ADMIN",
        adminId: adminId ? String(adminId) : null,
      };

      if (order.userId) io.to(rooms.user(order.userId)).emit("order_deleted", payload);
      const rIds = order.restaurantIds && order.restaurantIds.length > 0 ? order.restaurantIds : [order.restaurantId].filter(Boolean);
      rIds.forEach(rId => {
        io.to(rooms.restaurant(rId)).emit("order_deleted", payload);
      });
      if (order.dispatch?.deliveryPartnerId) {
        io.to(rooms.delivery(order.dispatch.deliveryPartnerId)).emit("order_deleted", payload);
      }
    }
  } catch (err) {
    logger.warn(`Delete order socket emit failed: ${err?.message || err}`);
  }

  enqueueOrderEvent("order_deleted_by_admin", {
    orderMongoId: String(orderMongoId),
    orderId: readableOrderId,
    adminId: adminId ? String(adminId) : null,
  });

  return {
    deleted: true,
    orderId: readableOrderId,
    orderMongoId: String(orderMongoId),
  };
}

export async function updateOrderStatusAdmin(orderId, orderStatus, note = "", adminId) {
  const identity = buildOrderIdentityFilter(orderId);
  let order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");

  const from = order.orderStatus;
  order.orderStatus = orderStatus;
  if (note && String(note).trim()) {
    order.note = String(note).trim();
  }

  const normalizedPaymentMethod = String(order.payment?.method || "cash").toLowerCase();
  const prevPaymentStatus = String(order.payment?.status || "cod_pending").toLowerCase();
  if (String(orderStatus) === "delivered" && normalizedPaymentMethod === "cash" && prevPaymentStatus === "cod_pending") {
    // Keep payment state consistent for COD if delivery is completed by admin override.
    order.payment.status = "paid";
  }

  pushStatusHistory(order, {
    byRole: "ADMIN",
    byId: adminId,
    from,
    to: orderStatus,
    note: note || "Status updated by admin",
  });

  if (String(orderStatus).includes("cancel")) {
      broadcastCancelledOrderToAdmin(order, { cancelledBy: "admin", reason: note || "Cancelled by admin" });
    try {
      await applyCancellationRefund(order, { cancelledBy: 'admin' });
    } catch (err) {
      logger.warn(`Admin cancellation refund failed for order ${order._id}: ${err?.message || err}`);
      order.payment.refund = { status: "failed", amount: order.pricing?.total || 0 };
    }

    const paymentMethod = String(order.payment?.method || "cash").toLowerCase();
    const paymentStatus = String(order.payment?.status || "cod_pending").toLowerCase();
    const wasUsageCommitted = (paymentMethod !== "razorpay") || (paymentMethod === "razorpay" && paymentStatus === "paid");
    
    if (wasUsageCommitted && order.pricing?.couponCode) {
      try {
        const couponCode = String(order.pricing.couponCode).trim().toUpperCase();
        const offer = await FoodOffer.findOne({ couponCode }).lean();
        if (offer) {
          await FoodOffer.updateOne({ _id: offer._id, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
          await FoodOfferUsage.updateOne(
            { offerId: offer._id, userId: new mongoose.Types.ObjectId(order.userId), count: { $gt: 0 } },
            { $inc: { count: -1 } }
          );
          broadcastPublicUpdate("offer:update", { action: "update", id: offer._id.toString() });
        }
      } catch (err) {
        logger.error(`Failed to rollback coupon usage on admin cancellation: ${err.message}`);
      }
    }
  }

  await order.save();

  if (String(orderStatus) === "delivered") {
    try {
      const ledgerKind =
        normalizedPaymentMethod === "cash" && prevPaymentStatus === "cod_pending"
          ? "cod_marked_paid_on_delivery"
          : "payment_snapshot_sync";
      await foodTransactionService.updateTransactionStatus(order._id, ledgerKind, {
        status: "captured",
        recordedByRole: "ADMIN",
        recordedById: adminId,
        note: `Delivery completed from admin flow. Prev payment status: ${prevPaymentStatus}`,
      });
    } catch (err) {
      logger.warn(`updateOrderStatusAdmin delivered transaction sync failed: ${err?.message || err}`);
    }

    try {
      await userWalletService.awardCoinsForOrder(order.userId, order._id);
    } catch (err) {
      logger.warn(`updateOrderStatusAdmin award coins failed: ${err?.message || err}`);
    }
  }

  // Notify all relevant parties
  const notifyList = [
    { ownerType: "USER", ownerId: order.userId },
    { ownerType: "RESTAURANT", ownerId: order.restaurantId },
  ];
  if (order.dispatch?.deliveryPartnerId) {
    notifyList.push({ ownerType: "DELIVERY_PARTNER", ownerId: order.dispatch.deliveryPartnerId });
  }

  let title = `Order Status Updated 📋`;
  let body = `Order #${order.order_id || order._id} status changed to ${String(orderStatus).replace(/_/g, " ")} by support.`;

  if (orderStatus === "confirmed") {
    title = "Order Accepted! 🧑‍🍳";
    body = "The order has been accepted and is starting to be prepared.";
  } else if (orderStatus === "preparing") {
    title = "Food is being prepared! 🍳";
    body = "Your food is currently being prepared by the restaurant.";
  } else if (orderStatus === "ready_for_pickup") {
    title = "Food is ready! 🛍️";
    body = "Your order is ready and waiting to be picked up.";
  } else if (String(orderStatus).includes("cancel")) {
    title = "Order Cancelled ❌";
    body = (note && String(note).trim()) ? note : `Unfortunately, your order has been cancelled by support.`;
  }

  await notifyOwnersSafely(notifyList, {
    title,
    body,
    data: {
      type: "order_status_update",
      orderId: order._id.toString(),
      orderStatus: String(orderStatus || ""),
    }
  });

  // Real-time update
  try {
    const io = getIO();
    if (io) {
      const payload = {
        orderMongoId: order._id.toString(),
        orderId: order._id.toString(),
        orderStatus: order.orderStatus,
        message: body,
        title: title,
        note: order.note || note || "",
      };
      io.to(rooms.user(order.userId)).emit("order_status_update", payload);
      const rIds = order.restaurantIds && order.restaurantIds.length > 0 ? order.restaurantIds : [order.restaurantId].filter(Boolean);
      rIds.forEach(rId => {
        io.to(rooms.restaurant(rId)).emit("order_status_update", payload);
      });
      if (order.dispatch?.deliveryPartnerId) {
        io.to(rooms.delivery(order.dispatch.deliveryPartnerId)).emit("order_status_update", payload);
      }
      broadcastOrderUpdateToAdmin(order._id.toString());

      // Auto-assign block removed as delivery partner system is discontinued
    }
  } catch (err) {
    logger.warn(`Admin status update socket emit failed: ${err?.message || err}`);
  }

  return normalizeOrderForClient(order);
}

export async function processRefundAdmin(orderId, amount, adminId) {
  const identity = buildOrderIdentityFilter(orderId);
  let order = await FoodOrder.findOne(identity);
  if (!order) throw new NotFoundError("Order not found");

  const currentPaymentStatus = String(order.payment?.status || "").toLowerCase();

  if (currentPaymentStatus === "refunded") {
    throw new ValidationError("Order is already refunded");
  }

  const refundAmount = Number(amount) || order.pricing?.total || 0;
  if (refundAmount <= 0) throw new ValidationError("Invalid refund amount");

  const refundResult = await applyCancellationRefund(order, {
    cancelledBy: 'admin',
    refundAmount,
  });

  if (!refundResult.processed) {
    if (order.isModified()) {
      await order.save();
    }
    if (refundResult.reason === 'cash_payment') {
      throw new ValidationError('Cash on Delivery orders do not require a refund');
    }
    throw new Error('Refund processing failed');
  }

  await order.save();

  try {
    await foodTransactionService.updateTransactionStatus(order._id, order.orderStatus, {
      status: 'refunded',
      note: `Refund of ₹${refundAmount} processed by admin`,
      recordedByRole: 'ADMIN',
      recordedById: adminId
    });
  } catch (err) {
    logger.warn(`Admin refund transaction sync failed: ${err?.message || err}`);
  }

  return { success: true, order: normalizeOrderForClient(order) };
}

async function deductStock(items, moduleType) {
  try {
    const db = mongoose.connection.db;
    let collectionName = '';
    if (moduleType === 'food') {
      collectionName = 'food_items';
    } else if (moduleType === 'grocery') {
      collectionName = 'grocery_products';
    } else if (moduleType === 'accessories') {
      collectionName = 'accessories_products';
    }

    if (!collectionName) return;

    for (const item of items) {
      const itemId = item.itemId || item.id || item._id;
      const qty = Number(item.quantity) || 0;
      if (itemId && qty > 0) {
        await db.collection(collectionName).updateOne(
          { _id: new mongoose.Types.ObjectId(String(itemId)) },
          { $inc: { quantity: -qty } }
        );
      }
    }
    try {
      const { invalidateCache } = await import('../../../../middleware/cache.js');
      void invalidateCache('restaurant_menu:*');
    } catch (_) { }
    broadcastPublicUpdate(`${moduleType}:product:update`, { action: 'update', quantityReduced: true });
  } catch (err) {
    logger.error(`Failed to deduct inventory for module ${moduleType}: ${err.message}`);
  }
}

export async function submitOrderRatings(orderId, userId, dto) {
  const filter = buildOrderIdentityFilter(orderId);
  filter.userId = userId;
  const order = await FoodOrder.findOne(filter);
  if (!order) {
    throw new NotFoundError('Order not found');
  }
  if (order.orderStatus !== 'delivered') {
    throw new ValidationError('You can only rate a delivered order');
  }

  const { restaurantId, restaurantRating, restaurantComment } = dto;
  
  const existingRating = order.ratings?.restaurants?.find(
    r => r.restaurantId?.toString() === restaurantId
  );
  if (existingRating) {
    throw new ValidationError('You have already rated this restaurant for this order');
  }

  const updatedOrder = await FoodOrder.findOneAndUpdate(
    filter,
    { 
      $push: { 
        'ratings.restaurants': { 
          restaurantId, 
          rating: restaurantRating, 
          comment: restaurantComment || '', 
          ratedAt: new Date() 
        } 
      } 
    },
    { new: true, runValidators: true }
  );

  if (restaurantRating && restaurantId) {
    await applyAggregateRating(FoodRestaurant, restaurantId, restaurantRating);
  }

  return normalizeOrderForClient(updatedOrder, 'user');
}

