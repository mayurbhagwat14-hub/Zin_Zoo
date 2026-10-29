import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import io from "socket.io-client";
import { toast } from "sonner";
import { API_BASE_URL } from "@food/api/config";
import { adminAPI } from "@food/api";
import { adminAlertSound } from "@food/utils/adminAlertSound";

export default function AdminNotificationManager() {
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const recentAlertsRef = useRef(new Map());
  const isFirstPollRef = useRef(true);

  useEffect(() => {
    // Request notification permission on mount if supported and not denied
    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      const askPermission = () => {
        Notification.requestPermission().catch(() => {});
      };
      window.addEventListener("click", askPermission, { once: true });
    }

    const backendUrl =
      import.meta.env?.VITE_SOCKET_URL ||
      (API_BASE_URL ? API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "") : "");

    if (!backendUrl || !backendUrl.startsWith("http")) {
      return undefined;
    }

    const token =
      localStorage.getItem("admin_accessToken") ||
      localStorage.getItem("accessToken") ||
      "";

    console.log("[AdminNotificationManager] Initializing socket connection to:", backendUrl, "hasToken:", Boolean(token));

    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { token },
      query: { token }
    });

    socketRef.current = socket;

    const handleIncomingRealtimeOrder = (payload = {}) => {
      const orderId =
        payload?.orderId ||
        payload?.orderMongoId ||
        payload?.metaData?.orderId ||
        payload?._id ||
        `order-${Date.now()}`;

      const now = Date.now();
      const lastHandledAt = recentAlertsRef.current.get(orderId) || 0;
      if (now - lastHandledAt < 10000) {
        return;
      }
      recentAlertsRef.current.set(orderId, now);

      // Clean up old entries from deduplication map
      for (const [id, time] of recentAlertsRef.current.entries()) {
        if (now - time > 60000) {
          recentAlertsRef.current.delete(id);
        }
      }

      const moduleType = String(payload?.moduleType || payload?.category || "food").toLowerCase();
      let defaultLink = "/admin/food/orders/all";
      if (moduleType === "grocery") defaultLink = "/admin/food/grocery-orders/all";
      else if (moduleType === "accessories") defaultLink = "/admin/food/accessories-orders/all";

      const targetLink = payload?.link || defaultLink;
      const title = payload?.title || "New Order Received";
      const restaurantName = payload?.restaurantName || payload?.metaData?.restaurantName || "";
      const description =
        payload?.message ||
        (restaurantName ? `${restaurantName} • #${orderId}` : `Order #${orderId}`);

      // 1. Play real-time alert sound (continuous looping until dismissed or accepted)
      adminAlertSound.playAlert({
        id: orderId,
        loop: true,
        maxDurationMs: 45000,
      });

      // 2. Display actionable Sonner toast (error style for cancellations, info for new orders)
      const isCancelled =
        String(payload?.status || "").toLowerCase() === "cancelled" ||
        String(title).toLowerCase().includes("cancel") ||
        String(description).toLowerCase().includes("cancel");
      const toastFn = isCancelled ? toast.error : toast.info;

      toastFn(title, {
        id: `admin-order-${orderId}`,
        description,
        duration: 30000,
        action: {
          label: "View Order",
          onClick: () => {
            adminAlertSound.stopAlert();
            navigate(targetLink);
          },
        },
        onDismiss: () => {
          adminAlertSound.stopAlert();
        },
        onAutoClose: () => {
          adminAlertSound.stopAlert();
        },
      });

      // 3. Trigger native browser push notification if permitted
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(title, {
            body: description,
            tag: `admin-order-${orderId}`,
          });
        } catch {
          // Ignore notification display failures
        }
      }

      // 4. Notify Navbar unread badge and active order tables
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("adminNotificationsUpdated"));
        window.dispatchEvent(new CustomEvent("adminNewOrderReceived", { detail: payload }));
      }
    };

    const handleIncomingNotificationUpdate = () => {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("adminNotificationsUpdated"));
      }
    };

    socket.on("connect", () => {
      console.log("[AdminNotificationManager] Socket connected successfully. Joining admin-orders room.");
      socket.emit("join-admin-orders");
    });

    socket.on("admin-room-joined", (data) => {
      console.log("[AdminNotificationManager] Verified in admin room:", data?.room);
    });

    socket.on("connect_error", (err) => {
      console.warn("[AdminNotificationManager] Socket connect_error:", err.message);
    });

    socket.on("admin_new_order", handleIncomingRealtimeOrder);
    socket.on("play_notification_sound", handleIncomingRealtimeOrder);
    socket.on("adminNotificationsUpdated", handleIncomingNotificationUpdate);
    socket.on("admin_order_update", handleIncomingNotificationUpdate);

    // Fallback polling every 15s to guarantee new orders are alerted even if WebSocket disconnects
    const pollInterval = setInterval(async () => {
      try {
        const res = await adminAPI.getAdminNotificationsHistory({ page: 1, limit: 5 });
        const notifications = res?.data?.data?.notifications || res?.data?.notifications || [];

        if (isFirstPollRef.current) {
          // Seed existing unread IDs so we don't play historical audio on page load
          notifications.forEach((n) => {
            const id = n._id || n.metaData?.orderId;
            if (id) recentAlertsRef.current.set(id, Date.now());
          });
          isFirstPollRef.current = false;
          return;
        }

        const now = Date.now();
        for (const n of notifications) {
          if (n.type === "order" && !n.isRead) {
            const orderId = n.metaData?.orderId || n._id;
            const createdAtMs = new Date(n.createdAt).getTime();
            // If created within the last 60 seconds and hasn't been alerted yet
            if (now - createdAtMs < 60000 && !recentAlertsRef.current.has(orderId)) {
              handleIncomingRealtimeOrder({
                orderId: n.metaData?.orderId || n._id,
                title: n.title,
                message: n.message,
                moduleType: n.category || "food",
                link: n.link,
                metaData: n.metaData,
              });
            }
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 15000);

    const stopAlertHandler = () => {
      adminAlertSound.stopAlert();
    };
    window.addEventListener("adminStopAlertSound", stopAlertHandler);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("adminStopAlertSound", stopAlertHandler);
      adminAlertSound.stopAlert();

      if (socket) {
        socket.off("connect");
        socket.off("admin-room-joined");
        socket.off("connect_error");
        socket.off("admin_new_order", handleIncomingRealtimeOrder);
        socket.off("play_notification_sound", handleIncomingRealtimeOrder);
        socket.off("adminNotificationsUpdated", handleIncomingNotificationUpdate);
        socket.off("admin_order_update", handleIncomingNotificationUpdate);
        socket.disconnect();
      }
    };
  }, [navigate]);

  return null;
}
