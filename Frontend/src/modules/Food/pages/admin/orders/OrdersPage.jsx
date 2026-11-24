import { useState, useEffect, useRef, useCallback, useMemo } from "react"
import { useSearchParams } from "react-router-dom"
import io from "socket.io-client"
import { FileText, Calendar, Package } from "lucide-react"
import { adminAPI } from "@food/api"
import { API_BASE_URL } from "@food/api/config"
import { toast } from "sonner"
import OrdersTopbar from "@food/components/admin/orders/OrdersTopbar"
import OrdersTable from "@food/components/admin/orders/OrdersTable"
import FilterPanel from "@food/components/admin/orders/FilterPanel"
import ViewOrderDialog from "@food/components/admin/orders/ViewOrderDialog"
import SettingsDialog from "@food/components/admin/orders/SettingsDialog"
import RefundModal from "@food/components/admin/orders/RefundModal"
import { useOrdersManagement } from "@food/components/admin/orders/useOrdersManagement"
import { Loader2 } from "lucide-react"
import { OrdersDashboardSkeleton } from "@food/components/ui/loading-skeletons"
import { useDelayedLoading } from "@food/hooks/useDelayedLoading"
import { adminAlertSound } from "@food/utils/adminAlertSound"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}


// Status configuration with titles, colors, and icons
const statusConfig = {
  "all": { title: "All Orders", color: "emerald", icon: FileText },
  "pending": { title: "Pending Orders", color: "amber", icon: Package },
  "accepted": { title: "Accepted Orders", color: "green", icon: Package },
  "processing": { title: "Processing Orders", color: "orange", icon: Package },
  "out-for-delivery": { title: "Out For Delivery", color: "blue", icon: Package },
  "delivered": { title: "Delivered Orders", color: "emerald", icon: Package },
  "canceled": { title: "Canceled Orders", color: "rose", icon: Package },
}

export default function OrdersPage({ statusKey = "all" }) {
  const config = statusConfig[statusKey] || statusConfig["all"]
  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedModule, setSelectedModule] = useState("all")
  const [processingRefund, setProcessingRefund] = useState(null)
  const [processingActionOrderId, setProcessingActionOrderId] = useState(null)
  const [deletingOrderId, setDeletingOrderId] = useState(null)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null)
  const showLoadingSkeleton = useDelayedLoading(isLoading, { delay: 120, minDuration: 360 })
  const seenOrderIdsRef = useRef(new Set())
  const isFirstLoadRef = useRef(true)
  const fetchInFlightRef = useRef(false)
  const fallbackAudioRef = useRef(null)
  const notificationAudioRef = useRef(null)
  const audioContextRef = useRef(null)
  const audioUnlockedRef = useRef(false)
  const socketRef = useRef(null)
  const recentRealtimeOrderRef = useRef(new Map())
  const activeOrderAlertRef = useRef(null)
  const alertLoopTimerRef = useRef(null)
  const alertLoopStartedAtRef = useRef(0)
  const ALERT_LOOP_INTERVAL_MS = 4500
  const ALERT_LOOP_MAX_MS = 120000
  const sanitizeNotificationText = useCallback((value) => {
    const raw = String(value || "")
    if (!raw) return ""
    const repaired = (() => {
      if (!/[ðÃÂâ]/.test(raw)) return raw
      try {
        const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0) & 0xff)
        return new TextDecoder("utf-8", { fatal: false }).decode(bytes) || raw
      } catch {
        return raw
      }
    })()
    return repaired
      .replace(/^\s*(?:[\uD800-\uDBFF][\uDC00-\uDFFF]\s*)*\[(user|shop|restaurant|delivery|admin)\]\s*/i, "")
      .replace(/[ÂÃâð][^\s]{0,3}/g, " ")
      .replace(/[^\x20-\x7E\n\r\t]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  }, [])

  const resolveAudioSource = useCallback((source, cacheKey = "admin-alert") => {
    if (!source) return source
    if (!import.meta.env.DEV) return source
    const separator = source.includes("?") ? "&" : "?"
    return `${source}${separator}devcache=${cacheKey}`
  }, [])

  const playDefaultRing = useCallback((orderId) => {
    adminAlertSound.playAlert({
      id: orderId || activeOrderAlertRef.current?.orderId || "admin-order",
      loop: true,
      maxDurationMs: ALERT_LOOP_MAX_MS,
    })
  }, [])

  const stopAlertLoop = useCallback(() => {
    adminAlertSound.stopAlert()
    if (alertLoopTimerRef.current) {
      clearInterval(alertLoopTimerRef.current)
      alertLoopTimerRef.current = null
    }
    alertLoopStartedAtRef.current = 0
  }, [])

  const startAlertLoop = useCallback(() => {
    playDefaultRing()
  }, [playDefaultRing])

  const showBrowserNotification = useCallback(async (title, body, tag) => {
    if (typeof window === "undefined" || typeof Notification === "undefined") return
    if (Notification.permission !== "granted") return

    try {
      const cleanTitle = sanitizeNotificationText(title) || "New update"
      const cleanBody = sanitizeNotificationText(body)
      const options = {
        body: cleanBody,
        tag: tag || undefined,
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [200, 100, 200, 100, 300],
        icon: "/favicon.ico",
        data: { targetUrl: "/admin/orders/all" },
      }

      if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration()
        if (registration) {
          await registration.showNotification(cleanTitle, options)
          return
        }
      }

      const notification = new Notification(cleanTitle, options)
      notification.onclick = () => {
        window.focus()
        notification.close()
      }
    } catch (_) {}
  }, [sanitizeNotificationText])

  // Unlock audio on first user gesture so rings can play reliably later
  useEffect(() => {
    const unlockAudio = async () => {
      if (audioUnlockedRef.current) return

      try {
        if (!fallbackAudioRef.current) {
          fallbackAudioRef.current = new Audio(alertSound)
          fallbackAudioRef.current.preload = "auto"
          fallbackAudioRef.current.volume = 1
        }

        // Prime media element playback permission
        fallbackAudioRef.current.muted = true
        await fallbackAudioRef.current.play()
        fallbackAudioRef.current.pause()
        fallbackAudioRef.current.currentTime = 0
        fallbackAudioRef.current.muted = false

        if (!notificationAudioRef.current) {
          const selectedSound = localStorage.getItem("delivery_alert_sound") || "zomato_tone"
          const soundFile = selectedSound === "original"
            ? resolveAudioSource(originalSound, "admin-original")
            : resolveAudioSource(alertSound, "admin-alert")
          notificationAudioRef.current = new Audio(soundFile)
          notificationAudioRef.current.preload = "auto"
          notificationAudioRef.current.volume = 1
        }
        notificationAudioRef.current.muted = true
        await notificationAudioRef.current.play()
        notificationAudioRef.current.pause()
        notificationAudioRef.current.currentTime = 0
        notificationAudioRef.current.muted = false

        // Prime WebAudio permission
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        if (AudioCtx && !audioContextRef.current) {
          audioContextRef.current = new AudioCtx()
        }
        if (audioContextRef.current?.state === "suspended") {
          await audioContextRef.current.resume()
        }
        if (audioContextRef.current?.state === "running") {
          await audioContextRef.current.suspend()
        }

        audioUnlockedRef.current = true
      } catch {
        // Ignore unlock errors; we'll retry on next gesture implicitly
      }
    }

    window.addEventListener("pointerdown", unlockAudio, { passive: true })
    window.addEventListener("keydown", unlockAudio)
    window.addEventListener("touchstart", unlockAudio, { passive: true })
    document.addEventListener("click", unlockAudio, { passive: true })
    document.addEventListener("touchstart", unlockAudio, { passive: true })

    return () => {
      window.removeEventListener("pointerdown", unlockAudio)
      window.removeEventListener("keydown", unlockAudio)
      window.removeEventListener("touchstart", unlockAudio)
      document.removeEventListener("click", unlockAudio)
      document.removeEventListener("touchstart", unlockAudio)
    }
  }, [])

  useEffect(() => {
    return () => {
      stopAlertLoop()
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {})
      }
      if (notificationAudioRef.current) {
        notificationAudioRef.current.pause()
        notificationAudioRef.current = null
      }
    }
  }, [stopAlertLoop])

  useEffect(() => {
    if (statusKey !== "all") return
    if (typeof window === "undefined" || typeof Notification === "undefined") return
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {})
    }
  }, [statusKey])

  // Orders are loaded in two ways:
  //  - "full":   walks every page (500/request) so the table has all orders.
  //              Used on first load, filter change and after admin actions.
  //  - "latest": fetches only the newest 50 and merges them in. Used by the 5s
  //              poll and socket events so we don't re-download every order
  //              each time (that was what made the API time out / hit limits).
  const getOrderKey = (order) => String(order?._id || order?.id || order?.orderId || "")

  const buildOrderParams = useCallback(() => ({
    moduleType: statusKey === "all" ? "all" : "food",
    status:
      statusKey === "all"
        ? undefined
        : statusKey === "restaurant-cancelled"
          ? "cancelled"
          : statusKey,
    cancelledBy: statusKey === "restaurant-cancelled" ? "restaurant" : undefined,
  }), [statusKey])

  const fullLoadGenRef = useRef(0)

  const fetchOrders = useCallback(async (options = {}) => {
    const { silent = false, withRingCheck = false, mode = "full" } = options
    const params = buildOrderParams()

    if (mode === "latest") {
      // Skip overlapping light refreshes and don't run them during a full load.
      if (fetchInFlightRef.current) return
      fetchInFlightRef.current = true
      try {
        const response = await adminAPI.getOrders({ ...params, page: 1, limit: 50 })
        if (!response?.data?.success) return
        const payload = response.data.data || {}
        const latest = Array.isArray(payload.orders)
          ? payload.orders
          : Array.isArray(payload.data) ? payload.data : []

        if (withRingCheck && !isFirstLoadRef.current && statusKey === "all") {
          const hasNewOrder = latest.some((o) => {
            const key = getOrderKey(o)
            return key && !seenOrderIdsRef.current.has(key)
          })
          if (hasNewOrder) {
            activeOrderAlertRef.current = { orderId: "polling-new-order" }
            playDefaultRing()
            startAlertLoop()
            if (typeof document !== "undefined" && document.visibilityState === "hidden") {
              showBrowserNotification(
                "New order received",
                "A new order arrived",
                `admin-order-poll-${Date.now()}`,
              )
            }
            toast.info("New order received")
          }
        }
        latest.forEach((o) => {
          const key = getOrderKey(o)
          if (key) seenOrderIdsRef.current.add(key)
        })

        setOrders((prev) => {
          const latestByKey = new Map(latest.map((o) => [getOrderKey(o), o]))
          const merged = prev.map((o) => latestByKey.get(getOrderKey(o)) || o)
          const existing = new Set(prev.map(getOrderKey))
          const fresh = latest.filter((o) => !existing.has(getOrderKey(o)))
          if (fresh.length === 0) return merged
          return [...fresh, ...merged].sort(
            (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
          )
        })
      } catch (error) {
        debugError("Error refreshing latest orders:", error)
      } finally {
        fetchInFlightRef.current = false
      }
      return
    }

    // Full load – newer call cancels any older one still paging.
    const gen = ++fullLoadGenRef.current
    const isCancelled = () => gen !== fullLoadGenRef.current
    fetchInFlightRef.current = true
    if (!silent) setIsLoading(true)
    let firstPageShown = false

    try {
      const { orders: allOrders, cancelled } = await adminAPI.getAllOrders(params, {
        pageSize: 500,
        isCancelled,
        onPage: (soFar) => {
          if (isCancelled()) return
          soFar.forEach((o) => {
            const key = getOrderKey(o)
            if (key) seenOrderIdsRef.current.add(key)
          })
          // Render the first page immediately; keep paging in the background.
          if (!firstPageShown || silent) {
            firstPageShown = true
            if (!silent) setIsLoading(false)
          }
          setOrders(soFar)
        },
      })
      if (cancelled || isCancelled()) return
      setOrders(allOrders)
      isFirstLoadRef.current = false
    } catch (error) {
      if (isCancelled()) return
      debugError("Error fetching orders:", error)
      if (!silent) {
        toast.error(error.response?.data?.message || error.message || "Failed to fetch orders")
      }
      // Keep whatever was already loaded instead of wiping the table.
    } finally {
      if (!isCancelled()) {
        fetchInFlightRef.current = false
        if (!silent) setIsLoading(false)
      }
    }
  }, [statusKey, buildOrderParams, playDefaultRing, showBrowserNotification, startAlertLoop])

  const normalizedOrders = useMemo(() => {
    const safeOrders = Array.isArray(orders) ? orders : []

    return safeOrders.filter(Boolean).map((order) => {
      const createdAtRaw = order.createdAt || order.created_at || order.orderDate || null
      const createdAtCandidate = createdAtRaw ? new Date(createdAtRaw) : null
      const createdAt =
        createdAtCandidate && !Number.isNaN(createdAtCandidate.getTime())
          ? createdAtCandidate
          : null
      const date = createdAt
        ? createdAt.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }).toUpperCase()
        : ""
      const time = createdAt
        ? createdAt.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          }).toUpperCase()
        : ""

      const pricing = order.pricing || {}
      const subtotal = Number(pricing.subtotal || 0)
      const deliveryFee = Number(pricing.deliveryFee || 0)
      const platformFee = Number(pricing.platformFee || 0)
      const taxAmount = Number(pricing.tax || 0)
      const discountAmount = Number(pricing.discount || 0)
      const computedTotal = subtotal + deliveryFee + platformFee + taxAmount - discountAmount
      const totalAmount = Number(
        pricing.total != null ? pricing.total : computedTotal
      )

      const paymentMethod = order.payment?.method || order.paymentMethod || ""
      let paymentType = order.paymentType
      if (!paymentType) {
        if (paymentMethod === "cash" || paymentMethod === "cod") paymentType = "Cash on Delivery"
        else if (paymentMethod === "wallet") paymentType = "Wallet"
        else if (paymentMethod) paymentType = "Online"
        else paymentType = "N/A"
      }

      const backendStatus = String(order.orderStatus || "").toLowerCase()

      const paymentStatusRaw = order.payment?.status || ""
      let paymentStatus = order.paymentStatus
      if (!paymentStatus) {
        const s = String(paymentStatusRaw || "").toLowerCase()
        
        if (s === "refunded") {
          paymentStatus = "Refunded"
        } else if (s === "paid" || s === "authorized" || s === "captured" || s === "settled") {
          paymentStatus = (paymentType === "Cash on Delivery") ? "Collected" : "Paid"
        } else if (paymentType === "Cash on Delivery" && backendStatus === "delivered") {
          paymentStatus = "Collected"
        } else if (s === "failed") {
          paymentStatus = "Failed"
        } else {
          paymentStatus = "Pending"
        }
      }

      let displayStatus = order.orderStatus
      if (!backendStatus || backendStatus === "created") {
        displayStatus = "Pending"
      } else if (backendStatus === "pending_payment") {
        displayStatus = "Payment Pending"
      } else if (backendStatus === "confirmed") {
        displayStatus = "Accepted"
      } else if (backendStatus === "preparing") {
        displayStatus = "Processing"
      } else if (backendStatus === "ready_for_pickup" || backendStatus === "ready") {
        displayStatus = "Ready"
      } else if (backendStatus === "picked_up") {
        displayStatus = "Out For Delivery"
      } else if (backendStatus === "delivered") {
        displayStatus = "Delivered"
      } else if (backendStatus.includes("cancel")) {
        displayStatus = "Canceled"
      }

      const dp = order.dispatch?.deliveryPartnerId
      const deliveryPartnerName =
        order.deliveryPartnerName ||
        dp?.name ||
        ""
      const deliveryPartnerPhone =
        order.deliveryPartnerPhone ||
        dp?.phone ||
        ""

      const items = Array.isArray(order.items)
        ? order.items.map((item) => ({
            quantity: item.quantity || 1,
            name: item.name || item.foodName || item.title || "Item",
            price: item.price || 0,
            restaurantName: item.restaurantName
              ? item.restaurantName
              : (order.restaurant && !order.restaurant.includes(",")
                  ? order.restaurant
                  : (order.restaurantName && !order.restaurantName.includes(",")
                      ? order.restaurantName
                      : "")),
            restaurantId: item.restaurantId || order.restaurantId || ""
          }))
        : []

      const customerName = order.customerName || order.userId?.name || "N/A"
      const customerPhone = order.customerPhone || order.userId?.phone || "N/A"
      const rawModule = String(order.moduleType || (order.category ? order.category.toLowerCase() : "food")).toLowerCase()
      const moduleType = rawModule === "accessories" ? "accessories" : rawModule === "grocery" ? "grocery" : "food"
      const category = order.category || (moduleType === "grocery" ? "Grocery" : moduleType === "accessories" ? "Accessories" : "Food")
      const restaurant =
        order.restaurant ||
        order.restaurantName ||
        order.restaurantId?.restaurantName ||
        (moduleType === "grocery" ? "Grocery Store" : moduleType === "accessories" ? "Accessories Store" : "")

      return {
        ...order,
        id: order._id || order.id,
        orderId: order.orderId || order.id,
        moduleType,
        category,
        date,
        time,
        customerName,
        customerPhone,
        restaurant,
        items,
        subtotal,
        totalItemAmount: subtotal,
        couponDiscount: discountAmount,
        itemDiscount: 0,
        deliveryCharge: deliveryFee,
        vatTax: taxAmount,
        platformFee,
        totalAmount,
        paymentType,
        paymentStatus,
        orderStatus: displayStatus,
        deliveryPartnerName,
        deliveryPartnerPhone,
        deliveryType: order.deliveryType || "Home Delivery",
        orderOtp: order.deliveryOtp,
        address: order.address || order.customerAddress || order.deliveryAddress,
        refundStatus: order.payment?.refund?.status || (order.payment?.status === 'refunded' ? 'processed' : null)
      }
    })
  }, [orders])

  const {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredOrders,
    count,
    activeFiltersCount,
    restaurants,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  } = useOrdersManagement(normalizedOrders, statusKey, config.title, statusKey === "all" ? "all" : "food")

  const moduleCounts = useMemo(() => {
    const counts = { all: filteredOrders.length, food: 0, grocery: 0, accessories: 0 }
    filteredOrders.forEach((o) => {
      const mod = String(o.moduleType || "food").toLowerCase()
      if (counts[mod] !== undefined) counts[mod]++
      else counts.food++
    })
    return counts
  }, [filteredOrders])

  const displayedOrders = useMemo(() => {
    if (statusKey !== "all" || selectedModule === "all") return filteredOrders
    return filteredOrders.filter((o) => String(o.moduleType || "food").toLowerCase() === selectedModule)
  }, [filteredOrders, statusKey, selectedModule])

  useEffect(() => {
    isFirstLoadRef.current = true
    seenOrderIdsRef.current = new Set()
    fetchOrders({ silent: false, withRingCheck: false })
    // Stop any in-progress page walk when leaving / switching tabs.
    return () => { fullLoadGenRef.current += 1; fetchInFlightRef.current = false }
  }, [fetchOrders])

  useEffect(() => {
    if (statusKey !== "all") return undefined

    const pollId = setInterval(() => {
      fetchOrders({ silent: true, withRingCheck: true, mode: "latest" })
    }, 5000)

    return () => clearInterval(pollId)
  }, [statusKey, fetchOrders])

  useEffect(() => {
    if (statusKey !== "all") return undefined

    const backendUrl = import.meta.env?.VITE_SOCKET_URL || API_BASE_URL.replace(/\/api(\/v\d+)?\/?$/, "")
    // Backend disconnected - do not open Socket.IO (new backend in progress)
    if ((!import.meta.env?.VITE_SOCKET_URL && !API_BASE_URL) || !backendUrl || !backendUrl.startsWith("http")) {
      return undefined
    }

    const token = localStorage.getItem("admin_accessToken") || localStorage.getItem("accessToken") || ""
    const socket = io(backendUrl, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: { token },
      query: { token },
    })
    socketRef.current = socket

    const handleIncomingRealtimeOrder = (payload = {}) => {
      const orderId = payload?.orderId || payload?.orderMongoId || ""
      if (!orderId) {
        activeOrderAlertRef.current = payload || { orderId: "socket-new-order" }
        playDefaultRing()
        startAlertLoop()
        toast.info("New order received")
        showBrowserNotification(
          "New order received",
          "A new order arrived",
          `admin-order-socket-${Date.now()}`,
        )
        fetchOrders({ silent: true, withRingCheck: false, mode: "latest" })
        window.dispatchEvent(new Event("adminNotificationsUpdated"))
        return
      }

      const now = Date.now()
      const lastHandledAt = recentRealtimeOrderRef.current.get(orderId) || 0
      if (now - lastHandledAt < 8000) return
      recentRealtimeOrderRef.current.set(orderId, now)

      const title = "New order received"
      const body = payload?.restaurantName
        ? `${payload.restaurantName} • ${orderId}`
        : `Order ${orderId}`

      activeOrderAlertRef.current = payload || { orderId }
      playDefaultRing()
      startAlertLoop()
      toast.info(title, { id: `admin-order-${orderId}`, description: body })
      showBrowserNotification(title, body, `admin-order-${orderId}`)
      fetchOrders({ silent: true, withRingCheck: false, mode: "latest" })
      window.dispatchEvent(new Event("adminNotificationsUpdated"))
    }

    const handleIncomingRealtimeOrderUpdate = (payload = {}) => {
      fetchOrders({ silent: true, withRingCheck: false, mode: "latest" })
      window.dispatchEvent(new Event("adminNotificationsUpdated"))
    }

    socket.on("connect", () => {
      socket.emit("join-admin-orders")
    })
    socket.on("admin_new_order", handleIncomingRealtimeOrder)
    socket.on("admin_order_update", handleIncomingRealtimeOrderUpdate)
    socket.on("play_notification_sound", handleIncomingRealtimeOrder)

    return () => {
      socket.off("admin_new_order", handleIncomingRealtimeOrder)
      socket.off("admin_order_update", handleIncomingRealtimeOrderUpdate)
      socket.off("play_notification_sound", handleIncomingRealtimeOrder)
      socket.disconnect()
      socketRef.current = null
    }
  }, [statusKey, fetchOrders, playDefaultRing, showBrowserNotification, startAlertLoop])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (typeof document === "undefined") return
      if (document.visibilityState !== "hidden") return
      if (!activeOrderAlertRef.current) return

      playDefaultRing()
      showBrowserNotification(
        "New order received",
        "A new order arrived",
        `admin-order-hidden-${Date.now()}`,
      )
    }

    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [playDefaultRing, showBrowserNotification])

  const [searchParams] = useSearchParams()
  const orderIdFromUrl = searchParams.get("orderId")

  useEffect(() => {
    if (isViewOrderOpen) {
      adminAlertSound.stopAlert()
    }
  }, [isViewOrderOpen])

  useEffect(() => {
    if (orderIdFromUrl && normalizedOrders.length > 0) {
      const order = normalizedOrders.find(o => o.id === orderIdFromUrl || o._id === orderIdFromUrl || o.orderId === orderIdFromUrl)
      if (order) {
        handleViewOrder(order)
      }
    }
  }, [orderIdFromUrl, normalizedOrders, handleViewOrder])

  const handleAcceptOrder = async (order) => {
    adminAlertSound.stopAlert()
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.acceptOrder(orderIdToUse)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} accepted`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to accept order")
      }
    } catch (error) {
      debugError("Error accepting order:", error)
      toast.error(error.response?.data?.message || "Failed to accept order")
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleUpdateStatus = async (order, status) => {
    adminAlertSound.stopAlert()
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.updateOrderStatus(orderIdToUse, { orderStatus: status })
      if (response.data?.success || response.status === 200) {
        toast.success(`Order status updated`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to update order status")
      }
    } catch (error) {
      debugError("Error updating order status:", error)
      toast.error(error.response?.data?.message || "Failed to update order status")
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleRejectOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    const reason = prompt(
      `Enter rejection reason for order ${order.orderId}:`,
      "Order rejected by admin",
    )

    if (reason === null) return

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.rejectOrder(orderIdToUse, reason)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} rejected`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to reject order")
      }
    } catch (error) {
      debugError("Error rejecting order:", error)
      toast.error(error.response?.data?.message || "Failed to reject order")
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleCancelOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    const reason = prompt(
      `Enter cancellation reason for order ${order.orderId}:`,
      "Order cancelled by admin",
    )

    if (reason === null) return

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.rejectOrder(orderIdToUse, reason)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} cancelled`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to cancel order")
      }
    } catch (error) {
      debugError("Error cancelling order:", error)
      toast.error(error.response?.data?.message || "Failed to cancel order")
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleDeassignAndResend = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    const confirmed = window.confirm(
      `Deassign the current delivery partner from order ${order.orderId} and resend it to other eligible delivery partners?`,
    )
    if (!confirmed) return

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.deassignAndResendOrder(orderIdToUse)
      toast.success(
        response?.data?.message ||
          "Delivery partner deassigned and order dispatch restarted",
      )
      await fetchOrders({ silent: true, withRingCheck: false })
    } catch (error) {
      debugError("Error reassigning order:", error)
      toast.error(
        error?.response?.data?.message || "Failed to deassign and resend order",
      )
      await fetchOrders({ silent: true, withRingCheck: false })
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleResendNotification = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    try {
      setProcessingActionOrderId(order.id || order.orderId)
      const response = await adminAPI.resendDeliveryNotification(orderIdToUse)
      toast.success(
        response?.data?.message ||
          "Notification resent to delivery partners successfully",
      )
      await fetchOrders({ silent: true, withRingCheck: false })
    } catch (error) {
      debugError("Error resending notification:", error)
      toast.error(
        error?.response?.data?.message || "Failed to resend notification",
      )
      await fetchOrders({ silent: true, withRingCheck: false })
    } finally {
      setProcessingActionOrderId(null)
    }
  }

  const handleDeleteOrder = async (order) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found")
      return
    }

    const shouldDelete = confirm(
      `Delete order ${order.orderId} permanently?\n\nThis will remove it from customer and delivery apps as well.`,
    )

    if (!shouldDelete) return

    try {
      setDeletingOrderId(order.id || order.orderId)
      const response = await adminAPI.deleteOrder(orderIdToUse)
      if (response.data?.success) {
        toast.success(response.data?.message || `Order ${order.orderId} deleted`)
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to delete order")
      }
    } catch (error) {
      debugError("Error deleting order:", error)
      toast.error(error.response?.data?.message || "Failed to delete order")
    } finally {
      setDeletingOrderId(null)
    }
  }

  // Handle refund button click - show modal for wallet payments, confirm dialog for others
  const handleRefund = (order) => {
    const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet";
    
    if (isWalletPayment) {
      // Show modal for wallet refunds
      setSelectedOrderForRefund(order)
      setRefundModalOpen(true)
    } else {
      // For non-wallet payments, use the old confirm dialog flow
      const confirmMessage = `Are you sure you want to process refund for order ${order.orderId}?\n\nThis will initiate a Razorpay refund to the customer's original payment method.`;
      
      if (!confirm(confirmMessage)) {
        return
      }
      
      processRefund(order, null) // null amount means use default
    }
  }

  // Process refund with amount
  const processRefund = async (order, refundAmount = null) => {
    // Try using MongoDB _id first (more reliable for route matching), then fallback to orderId string
    // Backend accepts either MongoDB ObjectId (24 chars) or orderId string
    // Using MongoDB _id is more reliable for route matching (no dashes/special chars)
    const orderIdToUse = order.id || order._id || order.orderId
    
    if (!orderIdToUse) {
      debugError('? No orderId found in order object:', order)
      toast.error('Order ID not found. Please refresh the page and try again.')
      return
    }
    
    debugLog('?? Order details for refund:', {
      orderIdString: order.orderId,
      mongoId: order.id,
      orderIdToUse,
      willUse: order.orderId ? 'orderId string' : 'MongoDB _id',
      refundAmount
    })

    try {
      setProcessingRefund(orderIdToUse)
      
      debugLog('?? Processing refund for order:', {
        orderId: order.orderId,
        id: order.id,
        _id: order._id,
        orderIdToUse,
        refundAmount,
        url: `/api/admin/orders/${orderIdToUse}/refund`
      })
      
      // Include refundAmount in request body if provided (ensure it's a number)
      const requestData = refundAmount !== null ? { refundAmount: parseFloat(refundAmount) } : {}
      debugLog('?? Request data being sent:', requestData)
      const response = await adminAPI.processRefund(orderIdToUse, requestData)
      
      if (response.data?.success) {
        const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet";
        toast.success(response.data?.message || (isWalletPayment 
          ? `Wallet refund of \u20B9${refundAmount || order.totalAmount} processed successfully for order ${order.orderId}`
          : `Refund sent to the original payment method for order ${order.orderId}`))
        // Update the order in the local state immediately to show "Refunded" status
        setOrders(prevOrders => 
          prevOrders.map(o => 
            (o.id === order.id || o.orderId === order.orderId)
              ? { ...o, refundStatus: 'processed' } // Wallet refunds are instant, so mark as processed
              : o
          )
        )
        // Refresh the orders list to get updated data
        await fetchOrders({ silent: true, withRingCheck: false })
      } else {
        toast.error(response.data?.message || "Failed to process refund")
      }
    } catch (error) {
      debugError("? Error processing refund:", error)
      
      // Log full error details for debugging
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
        baseURL: error.config?.baseURL,
        fullURL: error.config?.baseURL + error.config?.url,
        orderId: orderIdToUse,
        refundAmount: refundAmount,
        order: {
          id: order.id,
          orderId: order.orderId,
          _id: order._id
        },
        stack: error.stack
      }
      debugError("? Error details:", JSON.stringify(errorDetails, null, 2))
      
      // Show more specific error message
      let errorMessage = "Failed to process refund"
      
      if (error.response) {
        // Server responded with error
        if (error.response.status === 404) {
          errorMessage = `Order not found (ID: ${orderIdToUse}). Please check if the order exists.`
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.message || "Invalid request. Please check the refund amount."
        } else if (error.response.status === 500) {
          errorMessage = error.response.data?.message || "Server error. Please try again later."
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message
        } else {
          errorMessage = `Error ${error.response.status}: ${error.response.statusText || "Unknown error"}`
        }
      } else if (error.request) {
        // Request was made but no response received
        errorMessage = "Network error. Please check your internet connection and try again."
      } else {
        // Error in setting up the request
        errorMessage = error.message || "Failed to process refund"
      }
      
      debugError("? Final error message:", errorMessage)
      toast.error(errorMessage)
    } finally {
      setProcessingRefund(null)
      setRefundModalOpen(false)
      setSelectedOrderForRefund(null)
    }
  }

  // Handle refund confirmation from modal
  const handleRefundConfirm = (amount) => {
    if (selectedOrderForRefund) {
      processRefund(selectedOrderForRefund, amount)
    }
  }

  if (showLoadingSkeleton) {
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50 p-4 lg:p-6">
        <OrdersDashboardSkeleton />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <OrdersTopbar 
        title={config.title} 
        count={displayedOrders.length} 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />
      {statusKey === "all" && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {[
            { id: "all", label: "All Orders", count: moduleCounts.all },
            { id: "food", label: "Food", count: moduleCounts.food },
            { id: "grocery", label: "Grocery", count: moduleCounts.grocery },
            { id: "accessories", label: "Accessories", count: moduleCounts.accessories },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedModule(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center gap-2 transition-all ${
                selectedModule === tab.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                selectedModule === tab.id
                  ? "bg-slate-700 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}
      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={restaurants}
      />
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={{
          si: "Serial Number",
          orderId: "Order ID",
          orderDate: "Order Date",
          customer: "Customer Information",
          foodItems: "Food Items",
          totalAmount: "Total Amount",
          paymentType: "Payment Type",
          paymentCollectionStatus: "Payment Status",
          orderStatus: "Order Status",
          actions: "Actions",
        }}
      />
      <ViewOrderDialog
        isOpen={isViewOrderOpen}
        onOpenChange={setIsViewOrderOpen}
        order={selectedOrder}
      />
      <RefundModal
        isOpen={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        order={selectedOrderForRefund}
        onConfirm={handleRefundConfirm}
        isProcessing={processingRefund !== null}
      />
      <OrdersTable 
        orders={displayedOrders} 
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        onRefund={handleRefund}
        onDeleteOrder={handleDeleteOrder}
        onAcceptOrder={handleAcceptOrder}
        onUpdateStatus={handleUpdateStatus}
        onRejectOrder={handleRejectOrder}
        onDeassignAndResend={handleDeassignAndResend}
        onResendNotification={handleResendNotification}
        onCancelOrder={handleCancelOrder}
        actionLoadingOrderId={processingActionOrderId}
        deletingOrderId={deletingOrderId}
        showAssignedDeliveryPartner={statusKey === "all"}
      />
    </div>
  )
}
