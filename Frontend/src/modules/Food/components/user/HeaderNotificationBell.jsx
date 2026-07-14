import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, CheckCircle2, Tag, Gift, AlertCircle } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from "@food/components/ui/popover";
import { Badge } from "@food/components/ui/badge";
import useNotificationInbox from "@food/hooks/useNotificationInbox";

const ICON_MAP = {
  CheckCircle2,
  Tag,
  Gift,
  AlertCircle
};

export default function HeaderNotificationBell({ className = "", triggerClass = "" }) {
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('food_user_notifications');
    return saved ? JSON.parse(saved) : [];
  });
  const isAuthenticated = localStorage.getItem("user_authenticated") === "true" || !!localStorage.getItem("user_accessToken");

  const {
    items: broadcastNotifications,
    unreadCount: broadcastUnreadCount,
    dismiss: dismissBroadcastNotification,
  } = useNotificationInbox("user", { 
    limit: 20, 
    autoload: isAuthenticated 
  });

  useEffect(() => {
    const syncNotifications = () => {
      const saved = localStorage.getItem('food_user_notifications');
      setNotifications(saved ? JSON.parse(saved) : []);
    };

    window.addEventListener('notificationsUpdated', syncNotifications);
    return () => window.removeEventListener('notificationsUpdated', syncNotifications);
  }, []);

  const mergedNotifications = useMemo(() => {
    const localItems = Array.isArray(notifications)
      ? notifications.map((item) => ({ ...item, source: "local" }))
      : [];
    const broadcastItems = (broadcastNotifications || []).map((item) => ({
      ...item,
      source: "broadcast",
      time: item.createdAt
        ? new Date(item.createdAt).toLocaleString("en-IN", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
        : "Just now",
      type: "broadcast",
      icon: "Bell",
      iconColor: "text-blue-600",
    }));

    return [...broadcastItems, ...localItems].sort(
      (a, b) =>
        new Date(b.createdAt || b.timestamp || 0).getTime() -
        new Date(a.createdAt || a.timestamp || 0).getTime()
    );
  }, [broadcastNotifications, notifications]);

  const unreadCount = notifications.filter(n => !n.read).length + broadcastUnreadCount;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className={`h-8 w-8 relative flex items-center justify-center rounded-lg bg-white/10 border border-white/10 cursor-pointer active:scale-95 hover:bg-white/20 transition-all ${triggerClass}`}>
          <Bell className={`h-5 w-5 ${className || "text-white"}`} />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-orange-500 border border-white dark:border-zinc-900 animate-pulse" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden border border-gray-100 dark:border-zinc-800 shadow-2xl rounded-2xl mt-2 z-[9999]" align="end">
        <div className="bg-white dark:bg-zinc-900">
          <div className="p-4 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between bg-gray-50/50 dark:bg-zinc-900/50">
            <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
              Notifications
              {unreadCount > 0 && (
                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border-none text-[10px] h-4">
                  {unreadCount} New
                </Badge>
              )}
            </h3>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {mergedNotifications.length > 0 ? (
              mergedNotifications.slice(0, 5).map((notif) => {
                const Icon = ICON_MAP[notif.icon] || Bell;
                return (
                  <div key={notif.id} className="p-4 flex items-start gap-3 border-b border-gray-50 dark:border-zinc-800/50 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors">
                    <div className="mt-1 p-2 rounded-full bg-gray-100 dark:bg-zinc-800 text-orange-600 dark:text-orange-400">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{notif.title}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{notif.message}</p>
                      <span className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 block">{notif.time || "Just now"}</span>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="p-8 text-center flex flex-col items-center gap-2">
                <BellOff className="h-10 w-10 text-gray-300 dark:text-zinc-700" />
                <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">All caught up!</p>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-gray-100 dark:border-zinc-800 text-center bg-gray-50/30 dark:bg-zinc-900/30">
            <Link
              to="/food/user/notifications"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-350 transition-colors inline-block w-full"
            >
              View All Notifications
            </Link>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
