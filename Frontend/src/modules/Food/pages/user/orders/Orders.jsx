import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Search, MoreVertical, ChevronRight, Star, RotateCcw, AlertCircle, Loader2, Clock, X, Share2, MessageCircle, Send, Copy, Mail, MessagesSquare, Link2 } from "lucide-react"
import { orderAPI } from "@food/api"
import { useCart } from "@food/context/CartContext"
import { toast } from "sonner"
import { getCompanyNameAsync } from "@food/utils/businessSettings"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const toNum = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}


export default function Orders() {
  const navigate = useNavigate()
  const { replaceCart } = useCart()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState("all")
  const [activeMenuOrderId, setActiveMenuOrderId] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [sharePayload, setSharePayload] = useState(null)
  const [countdowns, setCountdowns] = useState({})

  // Calculate countdown for an order
  const calculateCountdown = (order) => {
    if (!order ||
      order.status === 'delivered' ||
      String(order.status).toLowerCase().includes('cancel')) {
      return null
    }

    const createdAt = new Date(order.createdAt)
    const now = new Date()
    const elapsedMinutes = Math.floor((now - createdAt) / (1000 * 60))

    // Get max ETA (use eta.max if available, otherwise estimatedDeliveryTime)
    const maxETA = order.eta?.max || order.estimatedDeliveryTime || 30
    const remainingMinutes = Math.max(0, maxETA - elapsedMinutes)

    return remainingMinutes > 0 ? remainingMinutes : null
  }

  // Update countdowns for all active orders
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns = {}
      orders.forEach(order => {
        const remaining = calculateCountdown(order)
        if (remaining !== null) {
          newCountdowns[order.id] = remaining
        }
      })
      setCountdowns(newCountdowns)
    }

    updateCountdowns()
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return
      updateCountdowns()
    }, 10000) // Update every 10 seconds for better UX

    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        updateCountdowns()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [orders])

  // Get order status text
  const getOrderStatus = (order) => {
    const status = order.status
    if (status === 'delivered' || status === 'completed') return 'delivered'
    if (status === 'out_for_delivery' || status === 'outForDelivery') return 'outForDelivery'
    if (status === 'ready' || status === 'preparing') return 'preparing'
    if (String(status).toLowerCase().includes('cancel')) return 'cancelled'
    return status || 'confirmed'
  }



  // Fetch orders from backend API
  useEffect(() => {
    const FETCH_LIMIT = 100

    const fetchAllOrders = async () => {
      const firstResponse = await orderAPI.getOrders({
        limit: FETCH_LIMIT,
        page: 1,
      })

      // Check multiple possible response structures
      let firstPageOrders = []
      let totalPages = 1

      if (firstResponse?.data?.success && firstResponse?.data?.data?.orders) {
        firstPageOrders = firstResponse.data.data.orders || []
        totalPages = firstResponse.data.data?.pagination?.pages || 1
      } else if (firstResponse?.data?.orders) {
        firstPageOrders = firstResponse.data.orders || []
        totalPages = firstResponse.data?.pagination?.pages || 1
      } else if (
        firstResponse?.data?.data &&
        Array.isArray(firstResponse.data.data)
      ) {
        firstPageOrders = firstResponse.data.data || []
      }

      if (totalPages <= 1) {
        return firstPageOrders
      }

      const pagePromises = []
      for (let p = 2; p <= totalPages; p += 1) {
        pagePromises.push(orderAPI.getOrders({ limit: FETCH_LIMIT, page: p }))
      }

      const pageResponses = await Promise.all(pagePromises)
      const remainingOrders = pageResponses.flatMap((resp) => {
        if (resp?.data?.success && resp?.data?.data?.orders) {
          return resp.data.data.orders || []
        }
        if (resp?.data?.orders) {
          return resp.data.orders || []
        }
        if (resp?.data?.data && Array.isArray(resp.data.data)) {
          return resp.data.data || []
        }
        return []
      })

      return [...firstPageOrders, ...remainingOrders]
    }

    const fetchOrders = async () => {
      try {
        setLoading(true)
        const ordersData = await fetchAllOrders()

        if (ordersData.length > 0) {
          debugLog('?? Raw orders from API:', ordersData.slice(0, 3).map(o => ({
            id: o.orderId || o._id,
            status: o.orderStatus || o.status,
            restaurantRating: o.ratings?.restaurant?.rating || null,
            deliveryPartnerRating: o.ratings?.deliveryPartner?.rating || null,
            deliveredAt: o.deliveredAt,
            restaurant: o.restaurantId?.restaurantName || o.restaurantId?.name || o.restaurantName
          })))

          // Transform API orders to match UI structure
          const transformedOrders = ordersData.map(order => {
            const createdAt = order.createdAt ? new Date(order.createdAt) : new Date()

            // Check if cancelled by restaurant or user
            const backendStatus = order.orderStatus || order.status
            const isCancelled =
              backendStatus === 'cancelled' ||
              backendStatus === 'cancelled_by_user' ||
              backendStatus === 'cancelled_by_restaurant' ||
              backendStatus === 'cancelled_by_admin'
            const cancellationReason = order.cancellationReason || ''
            // Check cancelledBy field first, then fallback to cancellation reason pattern
            const isRestaurantCancelled = isCancelled && (
              order.cancelledBy === 'restaurant' ||
              /rejected by restaurant|restaurant rejected|restaurant cancelled|restaurant is too busy|item not available|outside delivery area|kitchen closing|technical issue|order not accepted within time limit|restaurant did not respond/i.test(cancellationReason)
            )
            const isUserCancelled = isCancelled && order.cancelledBy === 'user'

            // Get original status from backend before transformation
            const originalStatus = backendStatus
            const restaurantRating = order.ratings?.restaurant?.rating || null
            const deliveryPartnerRating = order.ratings?.deliveryPartner?.rating || null

            const pricing = order.pricing || {}
            const itemSubtotal = (order.items || []).reduce((sum, item) => {
              const qty = toNum(item?.quantity || 1)
              const price = toNum(item?.price || item?.unitPrice || 0)
              return sum + (qty * price)
            }, 0)
            const subtotal = toNum(pricing.subtotal ?? pricing.itemTotal ?? pricing.itemsTotal ?? itemSubtotal)
            const deliveryFee = toNum(pricing.deliveryFee ?? pricing.deliveryCharge ?? pricing.shippingFee ?? 0)
            const packagingFee = toNum(pricing.packagingFee ?? pricing.packagingCharges ?? 0)
            const platformFee = toNum(pricing.platformFee ?? pricing.serviceFee ?? pricing.convenienceFee ?? 0)
            const tax = toNum(pricing.tax ?? pricing.taxesAndCharges ?? pricing.taxAndCharges ?? 0)
            const discount = toNum(pricing.discount ?? 0)
            const computedTotal = Math.max(0, subtotal + deliveryFee + packagingFee + platformFee + tax - discount)
            const total = toNum(pricing.total ?? order.total ?? computedTotal) || computedTotal

            return {
              id: order._id?.toString() || order.orderId || `ORD-${order._id}`,
              mongoId: order._id,
              orderId: order.orderId || order._id?.toString(), // Keep orderId for display
              status: isRestaurantCancelled ? 'restaurant_cancelled' : getOrderStatus({ ...order, status: backendStatus }),
              originalStatus: originalStatus, // Keep original status for reference
              createdAt: createdAt.toISOString(),
              address: order.address || order.deliveryAddress || {},
              items: (order.items || []).map(item => ({
                itemId: item.itemId || item._id || item.id,
                name: item.name || item.foodName || 'Item',
                variantName: item.variantName || '',
                quantity: item.quantity || 1,
                price: item.price || 0,
                image: item.image || null,
                description: item.description || null,
                isVeg: item.isVeg !== undefined ? item.isVeg : (item.category === 'veg' || item.type === 'veg'),
                _id: item._id || item.id,
                id: item.id || item._id
              })),
              total,
              subtotal,
              deliveryFee,
              packagingFee,
              platformFee,
              tax,
              pricing: { ...pricing, discount }, // Keep full pricing object for discounts, coupons
              payment: order.payment || {},
              paymentMethod: order.payment?.method || order.paymentMethod,
              restaurant: order.restaurantId?.restaurantName || order.restaurantId?.name || order.restaurantName || (order.items?.[0]?.name ? `${order.items[0].name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}` : 'Order'),
              restaurantId: order.restaurantId?._id || order.restaurantId,
              restaurantSlug: order.restaurantId?.slug || null,
              restaurantImage: order.restaurantId?.profileImage?.url || order.restaurantId?.profileImage || null,
              restaurantLocation: order.restaurantId?.location?.area || order.restaurantId?.location?.city || order.address?.city || order.deliveryAddress?.city || '',
              restaurantRating,
              deliveryPartnerRating,
              ratings: order.ratings || {},
              rating: restaurantRating || null,
              review: order.review || null,
              tracking: order.tracking || {},
              cancellationReason: cancellationReason,
              isRestaurantCancelled: isRestaurantCancelled,
              isUserCancelled: isUserCancelled,
              cancelledBy: order.cancelledBy,
              eta: order.eta || { min: order.estimatedDeliveryTime || 30, max: order.estimatedDeliveryTime || 30 },
              estimatedDeliveryTime: order.estimatedDeliveryTime || 30,
              preparationTime: order.preparationTime || 0,
              deliveredAt: order.deliveredAt || null,
              deliveryPartnerId: order.deliveryPartnerId?._id || order.deliveryPartnerId || null,
              deliveryPartnerName: 'Vishnu',
              deliveryPartnerPhone: '8225874798',
              note: order.note || null,
              moduleType: order.moduleType || 'food'
            }
          })

          // Sort by date (newest first)
          transformedOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

          debugLog('? Orders fetched and transformed:', {
            total: transformedOrders.length,
            delivered: transformedOrders.filter(o => o.status === 'delivered' || o.originalStatus === 'delivered').length,
            withRating: transformedOrders.filter(o => o.restaurantRating && (!o.deliveryPartnerId || o.deliveryPartnerRating)).length,
            sample: transformedOrders.slice(0, 2).map(o => ({
              id: o.id,
              status: o.status,
              originalStatus: o.originalStatus,
              restaurantRating: o.restaurantRating,
              deliveryPartnerRating: o.deliveryPartnerRating,
              deliveredAt: o.deliveredAt
            }))
          })

          setOrders(transformedOrders)
        } else {
          debugLog('?? No orders data in response')
          setOrders([])
        }
      } catch (error) {
        debugError('Error fetching user orders:', error)
        let errorMessage = 'Failed to load orders'
        if (error?.response?.status === 401) {
          errorMessage = 'Please login to view your orders'
        } else if (error?.response?.data?.message) {
          errorMessage = error.response.data.message
        }
        toast.error(errorMessage)
        setOrders([])
      } finally {
        setLoading(false)
      }
    }

    fetchOrders()

    // Poll for order updates every 20 seconds to detect delivered orders.
    // Pause polling in background tabs to reduce unnecessary CPU/network usage.
    const pollInterval = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return
      fetchOrders()
    }, 20000) // Poll every 20 seconds

    // When user returns to tab, refresh immediately for fresh status.
    const handleVisibilityChange = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchOrders()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      clearInterval(pollInterval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [])

  // Format date helper
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const day = date.getDate().toString().padStart(2, '0')
    const month = date.toLocaleDateString('en-US', { month: 'short' })
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    const displayHours = hours % 12 || 12

    return `${day} ${month}, ${displayHours}:${minutes}${ampm}`
  }

  // Filter orders based on search query and active filter
  const filteredOrders = orders.filter(order => {
    // Check moduleType filter
    if (activeFilter !== 'all') {
      const orderModule = order.moduleType || 'food'; // Default to food if missing
      if (orderModule !== activeFilter) return false;
    }

    if (!searchQuery.trim()) return true

    const query = searchQuery.toLowerCase()
    const restaurantMatch = order.restaurant?.toLowerCase().includes(query)
    const itemsMatch = order.items.some(item =>
      (item.name || item.foodName || '').toLowerCase().includes(query)
    )

    return restaurantMatch || itemsMatch
  })


  // Handle reorder
  const handleReorder = (order) => {
    const isGroceryOrAccessories = 
      order?.moduleType === 'grocery' || 
      order?.moduleType === 'accessories' || 
      String(order?.orderId || order?.order_id || "").startsWith("GRO-") || 
      String(order?.orderId || order?.order_id || "").startsWith("ACC-")

    // Safely extract string restaurantId — may be a populated Mongoose object
    const rawRestaurantId = order.restaurantId;
    const restaurantIdStr = rawRestaurantId
      ? (typeof rawRestaurantId === 'object' && rawRestaurantId !== null
          ? (rawRestaurantId._id?.toString() || rawRestaurantId.restaurantId?.toString() || null)
          : String(rawRestaurantId))
      : null;

    const restaurantTarget = order.restaurantSlug || restaurantIdStr

    if ((!isGroceryOrAccessories && !restaurantTarget) || !order.items?.length) {
      toast.info('Order items or restaurant information not available')
      return
    }

    // Detect order-level moduleType
    const orderModuleType = order.moduleType || 
      (String(order?.orderId || '').startsWith('GRO-') ? 'grocery' :
       String(order?.orderId || '').startsWith('ACC-') ? 'accessories' : 'food');

    const reorderItems = order.items
      .map((item, index) => {
        const itemId = item.itemId || item.id || item._id
        if (!itemId) return null

        // Per-item moduleType (for combined orders), fall back to order-level
        const itemModuleType = item.moduleType || orderModuleType;

        return {
          id: String(itemId),
          itemId: String(itemId),
          name: item.name || item.foodName || "Item",
          price: Number(item.price) || 0,
          image: item.image || "",
          restaurant: order.restaurant || order.restaurantName || item.restaurantName || "Restaurant",
          restaurantId: itemModuleType === 'food' ? restaurantIdStr : undefined,
          description: item.description || "",
          isVeg: item.isVeg !== false,
          quantity: Math.max(1, Number(item.quantity) || 1),
          moduleType: itemModuleType,
          category: itemModuleType,
          reorderIndex: index,
        }
      })
      .filter(Boolean)

    if (!reorderItems.length) {
      toast.error("No reorderable items found in this order")
      return
    }

    replaceCart(reorderItems)
    toast.success("Items added to cart")
    navigate("/food/user/cart")
  }


  // Three-dots menu handlers
  const toggleMenuForOrder = (orderId) => {
    setActiveMenuOrderId((current) => (current === orderId ? null : orderId))
  }

  const openShareModal = (payload) => {
    setSharePayload(payload)
    setShowShareModal(true)
  }

  const tryNativeShare = async (payload) => {
    if (typeof navigator === "undefined" || !navigator.share) return false
    try {
      await navigator.share(payload)
      return true
    } catch (error) {
      if (error?.name === "AbortError") return true
      return false
    }
  }

  const copyToClipboard = async (text) => {
    const textArea = document.createElement("textarea")
    textArea.value = text
    textArea.style.position = "fixed"
    textArea.style.opacity = "0"
    document.body.appendChild(textArea)
    textArea.select()
    try {
      document.execCommand("copy")
      toast.success("Link copied to clipboard!")
    } catch (err) {
      toast.error("Failed to copy link")
    }
    document.body.removeChild(textArea)
  }

  const openShareTarget = (target) => {
    if (!sharePayload?.url) return

    const text = sharePayload.text || ""
    const url = sharePayload.url
    const encodedText = encodeURIComponent(text)
    const encodedUrl = encodeURIComponent(url)

    let shareLink = ""

    if (target === "whatsapp") {
      shareLink = `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "telegram") {
      shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`
    } else if (target === "email") {
      shareLink = `mailto:?subject=${encodeURIComponent(sharePayload.title || "Check this out")}&body=${encodeURIComponent(`${text}\n\n${url}`)}`
    } else if (target === "sms") {
      shareLink = `sms:?body=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "facebook") {
      shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`
    } else if (target === "x") {
      shareLink = `https://twitter.com/intent/tweet?text=${encodeURIComponent(`${text} ${url}`)}`
    } else if (target === "linkedin") {
      shareLink = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`
    }

    if (shareLink) {
      window.open(shareLink, "_blank", "noopener,noreferrer")
      setShowShareModal(false)
    }
  }

  const copyShareLink = async () => {
    if (!sharePayload?.url) return
    await copyToClipboard(sharePayload.url)
    setShowShareModal(false)
  }

  const handleSystemShareFromModal = async () => {
    if (!sharePayload) return
    const shared = await tryNativeShare(sharePayload)
    if (shared) {
      setShowShareModal(false)
      toast.success("Shared successfully")
    }
  }

  const handleShareRestaurant = async (order) => {
    if (!order) return
    const companyName = await getCompanyNameAsync()
    const restaurantName = order.restaurant || "this restaurant"
    const restaurantSlug = order.restaurantSlug || order.restaurantId

    // Share URL points directly to the app vercel URL
    const shareUrl = "https://zin-zoo.vercel.app/"
    const shareText = `Check out ${restaurantName} on ${companyName}! They have amazing food.`

    const payload = {
      title: restaurantName,
      text: shareText,
      url: shareUrl,
    }

    try {
      const shared = await tryNativeShare(payload)
      if (shared) {
        toast.success("Restaurant shared successfully")
        return
      }

      openShareModal(payload)
    } catch (error) {
      if (error?.name !== "AbortError") {
        debugError("Error sharing restaurant:", error)
        toast.error("Failed to share restaurant")
      }
    } finally {
      setActiveMenuOrderId(null)
    }
  }

  const handleViewOrderDetails = (order) => {
    setActiveMenuOrderId(null)
    navigate(`/user/orders/${order.id}/details`)
  }



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-10">
        <div className="bg-[var(--module-theme-color,#F84E04)] p-4 flex items-center shadow-sm sticky top-0 z-10">
          <Link to="/user" className="hover:bg-white/20 p-2 -ml-2 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white cursor-pointer" />
          </Link>
          <h1 className="ml-2 text-xl font-bold text-white">Your Orders</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#F84E04] animate-spin" />
        </div>
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-10">
        <div className="bg-[var(--module-theme-color,#F84E04)] p-4 flex items-center shadow-sm sticky top-0 z-10">
          <Link to="/user" className="hover:bg-white/20 p-2 -ml-2 rounded-full transition-colors">
            <ArrowLeft className="w-6 h-6 text-white cursor-pointer" />
          </Link>
          <h1 className="ml-2 text-xl font-bold text-white">Your Orders</h1>
        </div>
        <div className="px-4 py-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">You haven't placed any orders yet</p>
          <Link to="/user">
            <button className="mt-4 text-[#F84E04] font-medium">Start Ordering</button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-10 font-sans">
      {/* Header */}
      <div className="bg-[var(--module-theme-color,#F84E04)] p-4 flex items-center shadow-sm sticky top-0 z-10">
        <Link to="/user" className="hover:bg-white/20 p-2 -ml-2 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-white cursor-pointer" />
        </Link>
        <h1 className="ml-2 text-xl font-bold text-white">Your Orders</h1>
      </div>

      {/* Search Bar */}
        <div className="p-4 bg-white dark:bg-slate-900 mt-1">
          <div className="flex items-center bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 shadow-sm mb-4">
            <Search className="w-5 h-5 text-[#F84E04]" />
            <input
              type="text"
              placeholder="Search by restaurant or dish"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 ml-3 outline-none text-gray-600 dark:text-gray-200 bg-transparent placeholder-gray-400"
            />
          </div>

          {/* Module Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            {['all', 'food', 'grocery', 'accessories'].map((filterType) => (
              <button
                key={filterType}
                onClick={() => setActiveFilter(filterType)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors ${
                  activeFilter === filterType
                    ? 'bg-[#F84E04] text-white shadow-md'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
              </button>
            ))}
          </div>
        </div>

      {/* Orders List */}
      <div className="px-4 py-2 space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 p-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">No orders found matching your search</p>
          </div>
        ) : (
          filteredOrders.map((order) => {
            // Check payment method - COD/wallet orders have 'pending' status which is normal
            const isCodOrWallet = order.payment?.method === 'cash' ||
              order.payment?.method === 'cod' ||
              order.payment?.method === 'wallet' ||
              order.paymentMethod === 'cash' ||
              order.paymentMethod === 'cod' ||
              order.paymentMethod === 'wallet'

            // Payment failed only for online payments (razorpay) that actually failed
            // Don't show payment failed for COD/wallet or cancelled orders
            const isCancelled = order.status === 'cancelled' || order.status === 'restaurant_cancelled'
            const paymentFailed = !isCodOrWallet &&
              !isCancelled &&
              (order.payment?.status === 'failed')

            const isDelivered = order.status === 'delivered'
            const isRestaurantCancelled = order.isRestaurantCancelled || order.status === 'restaurant_cancelled'
            const isUserCancelled = order.isUserCancelled || (isCancelled && order.cancelledBy === 'user')
            // Prefer food image from first item; fallback to restaurant image, then generic food photo
            const firstItemImage = order.items?.[0]?.image
            const restaurantImage = firstItemImage
              || order.restaurantImage
              || "https://images.unsplash.com/photo-1604908176997-125188eb3c52?auto=format&fit=crop&w=200&q=80"
            const location = order.restaurantLocation || `${order.address?.city || ''}, ${order.address?.state || ''}`.trim() || 'Location not available'

            return (
              <div 
                key={order.id} 
                className="relative bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-gray-100 dark:border-slate-800 overflow-hidden cursor-pointer hover:border-gray-300 dark:hover:border-slate-600 transition-colors"
                onClick={() => navigate(`/user/orders/${order.id}`)}
              >
                {/* Card Header: Restaurant Info */}
                <div className="flex items-start justify-between p-4 pb-2">
                  <div className="flex gap-3">
                    {/* Restaurant Image */}
                    <div className="w-14 h-14 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                      <img
                        src={restaurantImage}
                        alt={order.restaurant}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=100&q=80"
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-800 dark:text-white text-lg leading-tight">{order.restaurant}</h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                        Order ID: <span className="font-semibold text-gray-700 dark:text-gray-300">{order.orderId || order.id}</span>
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{location}</p>
                      {order.deliveryPartnerName && (
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          <span className="font-medium">Delivery:</span> {order.deliveryPartnerName}
                          {order.deliveryPartnerPhone && ` | ${order.deliveryPartnerPhone}`}
                        </p>
                      )}
                      {/* {order.restaurantId && (
                        <Link 
                          to={`/user/restaurants/${order.restaurantId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button className="text-xs text-[#F84E04] font-medium flex items-center mt-1 hover:text-[#D94F0C]">
                            View menu <span className="ml-0.5">&gt;</span>
                          </button>
                        </Link>
                      )} */}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenuForOrder(order.id);
                    }}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                  >
                    <MoreVertical className="w-5 h-5 text-gray-400" />
                  </button>
                </div>

                {/* Three-dots dropdown menu */}
                {activeMenuOrderId === order.id && (
                  <div className="absolute right-3 top-10 z-20 w-40 rounded-xl bg-white dark:bg-slate-800 shadow-lg border border-gray-100 dark:border-slate-700 py-1 text-xs">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleShareRestaurant(order); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      Share restaurant
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleViewOrderDetails(order); }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-800 dark:text-gray-200"
                    >
                      Order details
                    </button>
                  </div>
                )}

                {/* Minimal Footer */}
                <div className="px-4 py-3 flex items-center justify-between border-t border-gray-100 dark:border-slate-800">
                  <span className={`text-xs font-medium ${
                    order.status === 'delivered' ? 'text-green-600' :
                    (order.isRestaurantCancelled || order.status === 'restaurant_cancelled' || order.status === 'cancelled' || order.isUserCancelled) ? 'text-red-500' :
                    'text-[#F84E04]'
                  }`}>
                    {order.status === 'delivered' ? 'Delivered' :
                     (order.isRestaurantCancelled || order.status === 'restaurant_cancelled') ? 'Restaurant Cancelled' :
                     order.isUserCancelled ? 'Cancelled by you' :
                     order.status === 'cancelled' ? 'Cancelled' :
                     order.status === 'preparing' ? 'Preparing' :
                     order.status === 'outForDelivery' ? 'Out for delivery' :
                     order.status === 'confirmed' ? 'Order confirmed' : 'Pending'}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Branding */}
      <div className="flex justify-center mt-8 mb-4">
        <h1 className="text-4xl font-black text-gray-200 dark:text-zinc-900 tracking-tighter italic capitalize">ZinZoo</h1>
      </div>



      {showShareModal && sharePayload && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-4 pt-10 sm:items-center backdrop-blur-[2px]"
          onClick={() => setShowShareModal(false)}
        >
          <div 
            className="w-full max-w-sm rounded-3xl bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-zinc-800 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">Share App</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Native share available ho to sab supported apps wahan dikhenge</p>
              </div>
              <button
                type="button"
                onClick={() => setShowShareModal(false)}
                className="rounded-full p-2 text-gray-500 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800"
                aria-label="Close share modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-5 py-5 space-y-3">
              {typeof navigator !== "undefined" && navigator.share && (
                <button
                  type="button"
                  onClick={handleSystemShareFromModal}
                  className="w-full rounded-2xl bg-[#F84E04] px-4 py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 hover:bg-[#D94F0C] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share via apps
                </button>
              )}

              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => openShareTarget("whatsapp")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <MessageCircle className="w-5 h-5 text-green-600" />
                  WhatsApp
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("telegram")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <Send className="w-5 h-5 text-sky-500" />
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("email")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <Mail className="w-5 h-5 text-rose-500" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("sms")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <MessagesSquare className="w-5 h-5 text-violet-500" />
                  SMS
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("facebook")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <Share2 className="w-5 h-5 text-blue-600" />
                  Facebook
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("x")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <Link2 className="w-5 h-5 text-gray-900 dark:text-white" />
                  X
                </button>
                <button
                  type="button"
                  onClick={() => openShareTarget("linkedin")}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <Share2 className="w-5 h-5 text-blue-700" />
                  LinkedIn
                </button>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="rounded-2xl border border-gray-200 dark:border-zinc-800 px-3 py-4 text-xs font-medium text-gray-700 dark:text-gray-300 flex flex-col items-center gap-2 hover:bg-gray-50 dark:hover:bg-zinc-800"
                >
                  <Copy className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                  Copy link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
