import { useCallback, useEffect, useMemo, useState } from "react";
import { adminAPI, groceryAdminAPI, accessoriesAdminAPI } from "@food/api";

const STORAGE_KEY = "admin_notifications_dismissed_v1";
const UPDATE_EVENT = "adminNotificationsUpdated";

const safeParse = (value, fallback) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const getDismissedIds = () => {
  if (typeof localStorage === "undefined") return [];
  const parsed = safeParse(localStorage.getItem(STORAGE_KEY) || "[]", []);
  return Array.isArray(parsed) ? parsed : [];
};

const saveDismissedIds = (ids) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(ids) ? ids : []));
};

export const dispatchAdminNotificationsUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(UPDATE_EVENT));
};

const toDateValue = (value) => {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : 0;
};

const toDateLabel = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

const uniqueById = (items = []) => {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return [...map.values()];
};

const joinMeta = (...parts) => parts.filter(Boolean).join(" • ");

// ── Pending Orders (Food / Grocery / Accessories) ──
const mapPendingOrders = (rows = [], moduleType = "food") => {
  const list = Array.isArray(rows) ? rows : (rows?.orders || rows?.docs || rows?.data || []);
  return (Array.isArray(list) ? list : []).map((item) => {
    const totalAmount = item?.pricing?.total ?? item?.totalAmount ?? 0;
    const orderId = item?.orderId ?? item?.id ?? item?._id ?? "N/A";
    const customer = item?.customerName ?? item?.userId?.name ?? item?.userId?.fullName ?? "Customer";
    
    let path = "/admin/food/orders";
    if (moduleType === "grocery") path = "/admin/food/grocery-orders";
    if (moduleType === "accessories") path = "/admin/food/accessories-orders";

    return {
      id: `pending-order-${String(item?._id || item?.id || "")}`,
      title: `New ${moduleType === "food" ? "Food" : (moduleType === "grocery" ? "Grocery" : "Accessories")} Order`,
      message: `Order #${orderId} was placed. Total: ₹${Number(totalAmount).toFixed(2)}. Status: Pending.`,
      type: "order",
      category: "pending_order",
      path,
      createdAt: item?.createdAt || item?.updatedAt,
      timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
      metaLabel: joinMeta(orderId, customer, `₹${Number(totalAmount).toFixed(2)}`),
    };
  });
};

// ── User Support Tickets (Open / In-Progress) ──
const mapUserSupport = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.tickets ||
    payload?.items ||
    payload?.data ||
    response?.data?.tickets ||
    [];

  return (Array.isArray(rows) ? rows : [])
    .filter((item) => !["resolved", "closed"].includes(String(item?.status || "").toLowerCase()))
    .map((item) => {
      const userName = item?.user?.name || item?.userId?.name || "User";
      const issueType = item?.issueType || item?.type || "General";
      const status = item?.status || "open";

      return {
        id: `support-main-${String(item?._id || item?.id || "")}`,
        title: "User Support Ticket",
        message: `${userName} raised a support ticket. Issue: ${issueType}. Status: ${status}.`,
        type: "support",
        category: "support",
        path: "/admin/food/support-tickets",
        createdAt: item?.createdAt || item?.updatedAt,
        timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
        metaLabel: joinMeta(userName, item?.user?.phone, issueType, status),
      };
    });
};

// ── User Feedback / Experience ──
const mapUserFeedback = (response) => {
  const payload = response?.data?.data;
  const rows =
    payload?.feedbacks ||
    payload?.items ||
    payload?.data ||
    response?.data?.feedbacks ||
    [];

  return (Array.isArray(rows) ? rows : []).map((item) => {
    const userName = item?.name || item?.userName || item?.user?.name || "User";
    const rating = item?.rating ?? item?.stars ?? "";
    const message = item?.message || item?.feedback || item?.comment || "No message";

    return {
      id: `feedback-${String(item?._id || item?.id || "")}`,
      title: "New User Feedback",
      message: `${userName} submitted feedback${rating ? ` (${rating}★)` : ""}. "${message.length > 60 ? message.slice(0, 60) + "…" : message}"`,
      type: "feedback",
      category: "user_feedback",
      path: "/admin/food/feedback-experiences",
      createdAt: item?.createdAt || item?.updatedAt,
      timeLabel: toDateLabel(item?.createdAt || item?.updatedAt),
      metaLabel: joinMeta(userName, rating ? `${rating}★` : null, item?.email || item?.phone),
    };
  });
};

export default function useAdminNotifications(options = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(Boolean(options?.autoload !== false));

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const dismissed = new Set(getDismissedIds());

      const [
        supportRes,
        feedbackRes,
        foodOrdersRes,
        groceryOrdersRes,
        accessoriesOrdersRes,
      ] = await Promise.all([
        adminAPI.getSupportTicketsAdmin({ page: 1, limit: 50, source: "all" }).catch(() => null),
        adminAPI.getFeedbackExperiences({ page: 1, limit: 20 }).catch(() => null),
        adminAPI.getOrders({ status: "pending", limit: 20 }).catch(() => null),
        groceryAdminAPI.getOrders({ status: "pending", limit: 20 }).catch(() => null),
        accessoriesAdminAPI.getOrders({ status: "pending", limit: 20 }).catch(() => null),
      ]);

      const foodOrdersRows = foodOrdersRes?.data?.data?.data || foodOrdersRes?.data?.data?.orders || foodOrdersRes?.data?.orders || foodOrdersRes?.data?.data?.docs || foodOrdersRes?.data?.data || [];
      const groceryOrdersRows = groceryOrdersRes?.data?.data?.data || groceryOrdersRes?.data?.data?.orders || groceryOrdersRes?.data?.orders || groceryOrdersRes?.data?.data?.docs || groceryOrdersRes?.data?.data || [];
      const accessoriesOrdersRows = accessoriesOrdersRes?.data?.data?.data || accessoriesOrdersRes?.data?.data?.orders || accessoriesOrdersRes?.data?.orders || accessoriesOrdersRes?.data?.data?.docs || accessoriesOrdersRes?.data?.data || [];

      const aggregated = uniqueById([
        ...mapPendingOrders(foodOrdersRows, "food"),
        ...mapPendingOrders(groceryOrdersRows, "grocery"),
        ...mapPendingOrders(accessoriesOrdersRows, "accessories"),
        ...mapUserSupport(supportRes),
        ...mapUserFeedback(feedbackRes),
      ])
        .filter((item) => !dismissed.has(item.id))
        .sort((a, b) => toDateValue(b.createdAt) - toDateValue(a.createdAt));

      setItems(aggregated);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (options?.autoload === false) return;
    loadNotifications();
  }, [loadNotifications, options?.autoload]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handler = () => {
      loadNotifications();
    };
    window.addEventListener(UPDATE_EVENT, handler);
    return () => window.removeEventListener(UPDATE_EVENT, handler);
  }, [loadNotifications]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadNotifications();
    }, 15 * 1000);
    return () => window.clearInterval(timer);
  }, [loadNotifications]);

  const dismissOne = useCallback((id) => {
    if (!id) return;
    const dismissed = [...new Set([...getDismissedIds(), id])];
    saveDismissedIds(dismissed);
    setItems((prev) => prev.filter((item) => item.id !== id));
    dispatchAdminNotificationsUpdated();
  }, []);

  const clearAll = useCallback(() => {
    const ids = items.map((item) => item.id).filter(Boolean);
    saveDismissedIds([...new Set([...getDismissedIds(), ...ids])]);
    setItems([]);
    dispatchAdminNotificationsUpdated();
  }, [items]);

  return useMemo(
    () => ({
      items,
      loading,
      unreadCount: items.length,
      refresh: loadNotifications,
      dismissOne,
      clearAll,
    }),
    [clearAll, dismissOne, items, loadNotifications, loading]
  );
}

