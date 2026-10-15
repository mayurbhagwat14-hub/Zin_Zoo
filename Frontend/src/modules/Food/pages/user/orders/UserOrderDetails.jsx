import { useEffect, useState, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import useAppBackNavigation from "@food/hooks/useAppBackNavigation"
import {
  ArrowLeft,
  ShoppingBag,
  Phone,
  Copy,
  Download,
  User,
  CreditCard,
  Calendar,
  MapPin,
  RotateCcw,
  FileText,
  Coins,
  Star,
  Loader2,
  X
} from "lucide-react"
import { orderAPI, restaurantAPI } from "@food/api"
import apiClient from "@/services/api/axios"
import { useCart } from "@food/context/CartContext"
import { toast } from "sonner"
import { getCompanyNameAsync, getCachedSettings } from "@food/utils/businessSettings"
import { generateThermalInvoice } from "@food/utils/generateThermalInvoice"
import { suppressForegroundNotification } from "@food/utils/firebaseMessaging"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


export default function UserOrderDetails() {
  const navigate = useNavigate()
  const goBack = useAppBackNavigation()
  const { replaceCart } = useCart()
  const { orderId } = useParams()
  const [order, setOrder] = useState(null)
  const [restaurant, setRestaurant] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isSubmittingRating, setIsSubmittingRating] = useState(false)
  const [hoveredStars, setHoveredStars] = useState({})
  const [submittedRatings, setSubmittedRatings] = useState({})

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellationReason, setCancellationReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)
  const isCancellingRef = useRef(false)

  useEffect(() => {
    if (order?.ratings?.restaurants && Array.isArray(order.ratings.restaurants)) {
      const initialRatings = {};
      order.ratings.restaurants.forEach(r => {
        if (r.restaurantId) {
          initialRatings[r.restaurantId] = r.rating;
        }
      });
      setSubmittedRatings(initialRatings);
    }
  }, [order?.ratings?.restaurants])

  const handleRateRestaurant = async (restaurantId, rating) => {
    if (isSubmittingRating || submittedRatings[restaurantId]) return;
    setIsSubmittingRating(true);
    try {
      const response = await apiClient.post(`/food/orders/${orderId}/ratings`, { restaurantId, restaurantRating: rating });
      if (response.data.success) {
        setSubmittedRatings(prev => ({ ...prev, [restaurantId]: rating }));
        toast.success("Thank you for rating the restaurant!");
      }
    } catch (error) {
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || "Failed to submit rating";
      toast.error(errorMessage);
    } finally {
      setIsSubmittingRating(false);
    }
  }

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true)
        // Fetch using the ID from params (which will now be the MongoDB _id)
        const response = await orderAPI.getOrderDetails(orderId)

        let orderData = null
        if (response?.data?.success && response.data.data?.order) {
          orderData = response.data.data.order
        } else if (response?.data?.order && typeof response.data.order === 'object') {
          orderData = response.data.order
        } else {
          toast.error("Order not found")
          navigate("/user/orders")
          return
        }

        setOrder(orderData)

        // If restaurantId is just a string (not populated), fetch restaurant details separately
        const restaurantId = orderData.restaurantId
        if (restaurantId && typeof restaurantId === 'string' && !orderData.restaurant) {
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(restaurantId)
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              setRestaurant(restaurantResponse.data.data.restaurant)
            } else if (restaurantResponse?.data?.restaurant) {
              setRestaurant(restaurantResponse.data.restaurant)
            }
          } catch (restaurantError) {
            debugWarn("Failed to fetch restaurant details:", restaurantError)
            // Don't show error toast, just log it - order details can still be shown
          }
        }
        } catch (error) {
          debugError("Error fetching order details:", error)
          const errMsg = error?.response?.data?.error || error?.response?.data?.message
          toast.error(
            errMsg || "Failed to load order details"
          )
          navigate("/user/orders")
        } finally {
        setLoading(false)
      }
    }

    fetchOrderDetails()
  }, [orderId, navigate])

  const handleCopyOrderId = async () => {
    if (!order) return
    const id = order.orderId || order._id || orderId
    try {
      await navigator.clipboard.writeText(String(id))
      toast.success("Order ID copied")
    } catch {
      toast.error("Failed to copy Order ID")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-400 text-sm">Loading order details...</p>
      </div>
    )
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium">Order not found</p>
          <button
            onClick={() => navigate("/user/orders")}
            className="px-4 py-2 rounded-lg bg-[#F84E04] text-white text-sm font-semibold"
          >
            Back to Orders
          </button>
        </div>
      </div>
    )
  }

  const orderIdDisplay = order.orderId || order._id || orderId
  // Use fetched restaurant data if available, otherwise use order.restaurantId or order.restaurant
  const restaurantObj = restaurant || order.restaurantId || order.restaurant || {}
  const restaurantName =
    order.restaurantName || restaurantObj.restaurantName || restaurantObj.name || (order.items?.[0]?.name ? `${order.items[0].name}${order.items.length > 1 ? ` + ${order.items.length - 1} more` : ''}` : "Order")

  // Build restaurant address (try restaurant fields first, then fall back)
  const restaurantLocation = (() => {
    const loc = restaurantObj.location || {}

    // Priority 1: direct address on restaurant object
    if (restaurantObj.address) return restaurantObj.address

    // Priority 2: formattedAddress from location
    if (loc.formattedAddress) return loc.formattedAddress

    // Priority 3: generic address / street-style fields
    if (loc.address) return loc.address

    if (loc.street || loc.city) {
      const parts = [
        loc.street,
        loc.area,
        loc.city,
        loc.state,
        loc.zipCode || loc.pincode || loc.postalCode,
      ].filter(Boolean)
      if (parts.length) return parts.join(", ")
    }

    // Priority 4: area/landmark fallback
    if (loc.area || loc.landmark) {
      const parts = [
        loc.landmark,
        loc.area,
        loc.city,
        loc.state,
      ].filter(Boolean)
      if (parts.length) return parts.join(", ")
    }

    // Priority 5: order-level restaurantAddress if present
    if (order.restaurantAddress) return order.restaurantAddress

    // Don't fallback to user delivery address - show empty or "Address not available"
    return "Address not available"
  })()

  const items = Array.isArray(order.items) ? order.items : []
  const pricing = order.pricing || {}
  const sendsCutlery = order.sendCutlery !== false

  const userName = order.customerName || order.userName || order.userId?.name || order.userId?.fullName || ""
  const userPhone = order.customerPhone || order.userPhone || order.userId?.phone || ""
  const paymentMethod = order.payment?.method || "Online"
  const paymentDate = order.createdAt
    ? new Date(order.createdAt).toLocaleString("en-IN", {
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
    : ""

  const addressText =
    order.deliveryAddress?.formattedAddress ||
    order.address?.formattedAddress ||
    [
      order.deliveryAddress?.street || order.address?.street,
      order.deliveryAddress?.city || order.address?.city,
      order.deliveryAddress?.state || order.address?.state,
      order.deliveryAddress?.zipCode || order.address?.zipCode
    ]
      .filter(Boolean)
      .join(", ")

  const savings =
    (pricing.discount || 0) +
    (pricing.originalItemTotal || 0) -
    (pricing.subtotal || 0)

  const isGroceryOrAccessories =
    order?.moduleType === 'grocery' ||
    order?.moduleType === 'accessories' ||
    String(order?.orderId || order?.order_id || "").startsWith("GRO-") ||
    String(order?.orderId || order?.order_id || "").startsWith("ACC-")

  const getCallNumber = () => {
    if (isGroceryOrAccessories) {
      const settings = getCachedSettings()
      if (settings?.phone?.number) {
        const country = settings.phone.countryCode || ""
        const num = settings.phone.number
        return `${country}${num}`.replace(/[^\d+]/g, '')
      }
      return ""
    }

    // Check if order has a populated restaurantIds array (from backend)
    const orderRestaurant = Array.isArray(order?.restaurantIds) && order.restaurantIds.length > 0
      ? order.restaurantIds[0]
      : null;

    return (
      orderRestaurant?.primaryContactNumber ||
      orderRestaurant?.phone ||
      restaurantObj.primaryContactNumber ||
      restaurantObj.phone ||
      restaurantObj.ownerPhone ||
      restaurantObj.contactNumber ||
      order.restaurantPhone ||
      ""
    )
  }

  const callNumber = getCallNumber()

  const handleCallRestaurant = () => {
    if (!callNumber) {
      toast.error(isGroceryOrAccessories ? "Admin phone number not available" : "Restaurant phone number not available")
      return
    }
    window.location.href = `tel:${callNumber}`
  }
  const handleDownloadSummary = async () => {
    try {
      await generateThermalInvoice(order, "food", null, { hideGst: true });
      toast.success("Invoice downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to download invoice");
    }
  }

  const handleCancelOrder = () => {
    if (!order) return;
    if (order?.status !== 'confirmed') {
      toast.error('Order processing has started and it cannot be cancelled.');
      return;
    }
    setShowCancelDialog(true);
  };

  const handleConfirmCancel = async () => {
    if (isCancellingRef.current || isCancelling) return;
    if (!cancellationReason.trim()) {
      toast.error('Please provide a reason for cancellation');
      return;
    }

    isCancellingRef.current = true;
    setIsCancelling(true);
    const targetOrderId = order?._id || order?.id || orderId;
    try {
      const response = await orderAPI.cancelOrder(targetOrderId, { reason: cancellationReason.trim() });
      if (response.data?.success) {
        if (targetOrderId) {
          suppressForegroundNotification(targetOrderId, 'order_cancelled', 6000);
          if (order?.orderId && order.orderId !== targetOrderId) {
            suppressForegroundNotification(order.orderId, 'order_cancelled', 6000);
          }
        }
        toast.success('Order cancelled successfully', { id: `order-cancelled-${targetOrderId}` });
        setShowCancelDialog(false);
        setCancellationReason('');

        // Update local state to reflect cancellation instantly
        setOrder(prev => ({
          ...prev,
          status: 'cancelled_by_user',
          orderStatus: 'cancelled_by_user'
        }));
      } else {
        toast.error(response.data?.message || 'Failed to cancel order');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to cancel order');
    } finally {
      isCancellingRef.current = false;
      setIsCancelling(false);
    }
  };

  const handleReorder = (currentOrder) => {
    // Safely extract string restaurantId — restaurantObj/_id may be a populated Mongoose object
    const rawId = restaurantObj._id || restaurantObj.restaurantId ||
      (typeof currentOrder?.restaurantId === "object" && currentOrder?.restaurantId !== null
        ? (currentOrder.restaurantId._id || currentOrder.restaurantId.restaurantId)
        : currentOrder?.restaurantId);
    
    const restaurantIdStr = rawId
      ? (typeof rawId === 'object' && rawId !== null
          ? (rawId._id?.toString() || rawId.restaurantId?.toString() || rawId.id?.toString() || null)
          : String(rawId))
      : null;

    const restaurantTarget = restaurantObj.slug || restaurantIdStr;

    if ((!isGroceryOrAccessories && !restaurantTarget) || !items.length) {
      toast.error("Order items or restaurant information not available")
      return
    }

    // Detect order-level moduleType
    const orderModuleType = currentOrder?.moduleType || order?.moduleType ||
      (String(currentOrder?.orderId || '').startsWith('GRO-') ? 'grocery' :
       String(currentOrder?.orderId || '').startsWith('ACC-') ? 'accessories' : 'food');

    const reorderItems = items
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
          restaurant: restaurantName,
          restaurantId: itemModuleType === 'food' ? restaurantIdStr : undefined,
          description: item.description || "",
          isVeg: item.isVeg !== false,
          quantity: Math.max(1, Number(item.quantity || item.qty) || 1),
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


  const orderRestaurants = (() => {
    if (!order?.items || !Array.isArray(order.items)) {
      // fallback for old orders
      const rId = order?.restaurantId || (typeof order?.restaurant === 'object' ? order.restaurant?._id : order?.restaurant);
      if (rId) return [{ restaurantId: rId, restaurantName: restaurantName || "Restaurant" }];
      return [];
    }
    const map = new Map();
    order.items.forEach(item => {
      const rId = item.restaurantId;
      if (rId && !map.has(rId.toString())) {
        map.set(rId.toString(), {
          restaurantId: rId,
          restaurantName: item.restaurantName || "Restaurant"
        });
      }
    });
    // Fallback if no items have restaurantId but order does
    if (map.size === 0) {
      const mainRId = order?.restaurantId || (typeof order?.restaurant === 'object' ? order.restaurant?._id : order?.restaurant);
      if (mainRId) {
        map.set(mainRId.toString(), {
          restaurantId: mainRId,
          restaurantName: restaurantName || "Restaurant"
        });
      }
    }
    return Array.from(map.values());
  })();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24 font-sans relative">
      {/* Header */}
      <div className="bg-[var(--module-theme-color,#F84E04)] p-4 flex items-center sticky top-0 z-20 shadow-md">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
          <button
            type="button"
            onClick={goBack}
            className="p-2 -ml-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-white cursor-pointer" />
          </button>
          <h1 className="text-lg font-bold text-white">Order Details</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl flex flex-col gap-3 shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="bg-gray-100 dark:bg-zinc-800 p-2 rounded-lg">
              <ShoppingBag className="w-6 h-6 text-gray-600 dark:text-gray-400" />
            </div>
            <div>
              <h2 className="font-semibold text-gray-800 dark:text-white">
                {order.status === "delivered"
                  ? "Order was delivered"
                  : "Order status: " + (order.status || "Processing")}
              </h2>
              {order.status === "delivered" && order.coinsEarned > 0 ? (
                <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  <Coins className="w-3.5 h-3.5" />
                  <span>Earned {order.coinsEarned} Coins</span>
                </div>
              ) : (
                order.status !== "delivered" && order.coinSettings?.minCoinsPerOrder != null && order.coinSettings?.maxCoinsPerOrder != null && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <Coins className="w-3.5 h-3.5" />
                    <span>Earn {order.coinSettings.minCoinsPerOrder}-{order.coinSettings.maxCoinsPerOrder} Coins</span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Rating Section - Multiple Restaurants */}
          {order.status === "delivered" && orderRestaurants.length > 0 && (
            <div className="border-t border-dashed border-gray-200 dark:border-zinc-800 pt-3 mt-1 flex flex-col gap-4">
              {orderRestaurants.map((rest) => {
                const rId = rest.restaurantId.toString();
                const currentSubmitted = submittedRatings[rId];
                const currentHovered = hoveredStars[rId] || 0;

                return (
                  <div key={rId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 dark:border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                        {currentSubmitted ? `Rated ${rest.restaurantName}` : `Rate ${rest.restaurantName}`}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {currentSubmitted ? "Thanks for your feedback!" : "How was the food from here?"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const isActive = star <= (currentHovered || currentSubmitted);
                        return (
                          <button
                            key={star}
                            disabled={isSubmittingRating || !!currentSubmitted}
                            onMouseEnter={() => !currentSubmitted && setHoveredStars(prev => ({ ...prev, [rId]: star }))}
                            onMouseLeave={() => !currentSubmitted && setHoveredStars(prev => ({ ...prev, [rId]: 0 }))}
                            onClick={() => handleRateRestaurant(rId, star)}
                            className={`p-1 transition-all duration-200 ${currentSubmitted ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
                          >
                            <Star
                              className={`w-6 h-6 sm:w-7 sm:h-7 transition-colors duration-200 ${isActive
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-gray-100 text-gray-200 dark:fill-zinc-800 dark:text-zinc-700'
                                }`}
                            />
                          </button>
                        );
                      })}
                      {isSubmittingRating && <Loader2 className="w-4 h-4 ml-2 animate-spin text-amber-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Restaurant Info Card */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-zinc-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800 dark:text-white">{restaurantName}</h3>

            {/* Call button hidden for food orders as per user request, visible for grocery/accessories */}
            {isGroceryOrAccessories && (
              <button
                type="button"
                onClick={handleCallRestaurant}
                className="w-8 h-8 rounded-full border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-[#F84E04] hover:bg-orange-50 dark:hover:bg-orange-950/30"
              >
                <Phone className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              Order ID: #{orderIdDisplay}
            </span>
            <button type="button" onClick={handleCopyOrderId}>
              <Copy className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-pointer" />
            </button>
          </div>

          {order.status !== "delivered" && (
            <div className="flex items-center gap-2 mb-4">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${sendsCutlery
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800"
                  : "bg-orange-50 text-orange-700 border border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800"
                  }`}
              >
                {sendsCutlery ? "Send cutlery" : "Don't send cutlery"}
              </span>
            </div>
          )}

          <div className="border-t border-dashed border-gray-200 dark:border-zinc-800 my-3" />

          {/* Items */}
          {items.map((item, idx) => (
            <div key={idx} className="flex justify-between items-start mt-2">
              <div className="flex items-center gap-2">
                {(!order?.moduleType || order.moduleType !== 'accessories') && !String(order?.orderId || order?.order_id || "").startsWith("ACC-") && (
                  <div
                    className="w-3 h-3 md:w-4 md:h-4 border shrink-0 flex items-center justify-center"
                    style={{ borderColor: item.isVeg !== false && item.foodType !== 'Non-Veg' ? "#16a34a" : "#F84E04" }}
                  >
                    <div
                      className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full"
                      style={{ backgroundColor: item.isVeg !== false && item.foodType !== 'Non-Veg' ? "#16a34a" : "#F84E04" }}
                    />
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                    {item.quantity || item.qty || 1} x {item.name}{item.variantName ? ` (${item.variantName})` : ""}
                  </span>
                  {item.restaurantName && (
                    <span className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                      From: {item.restaurantName}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                ₹{(item.price || 0).toFixed(2)}
              </span>
            </div>
          ))}
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-sm overflow-hidden border border-gray-100 dark:border-zinc-800">
          <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-800 dark:text-white">Bill Summary</h3>
            </div>
          </div>

          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Item total</span>
              <div>
                {pricing.originalItemTotal && (
                  <span className="text-gray-400 dark:text-gray-600 line-through mr-1">
                    ₹{Number(pricing.originalItemTotal).toFixed(2)}
                  </span>
                )}
                <span className="text-gray-800 dark:text-gray-200">
                  ₹{Number(pricing.subtotal || pricing.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">GST (govt. taxes)</span>
              <span className="text-gray-800 dark:text-gray-200">
                ₹{Number(pricing.tax || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400 dark:text-gray-500 font-medium">Delivery fee</span>
              {pricing.deliveryFee === 0 && (
                <span className="text-[#F84E04] text-[10px] font-bold border border-[#F84E04] px-1 rounded ml-1">
                  FREE
                </span>
              )}
              <span className="text-[#F84E04] font-medium uppercase">
                {pricing.deliveryFee ? `₹${Number(pricing.deliveryFee).toFixed(2)}` : "Free"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Platform fee</span>
              <span className="text-gray-800 dark:text-gray-200">
                ₹{Number(pricing.platformFee || 0).toFixed(2)}
              </span>
            </div>


            <div className="border-t border-gray-100 dark:border-zinc-800 my-2 pt-2 flex justify-between items-center">
              <span className="font-bold text-gray-800 dark:text-white">Paid</span>
              <span className="font-bold text-gray-800 dark:text-white">
                ₹{Number(pricing.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Savings Banner */}
          {savings > 0 && (
            <div className="relative bg-orange-50 dark:bg-orange-950/20 p-3 pb-4 mt-2">
              <div className="absolute -top-1.5 left-0 w-full overflow-hidden leading-none">
                <svg
                  className="relative block w-[calc(100%+1.3px)] h-[8px]"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 1200 120"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0,0V46.29c47,0,47,69.5,94,69.5s47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5V0Z"
                    fill="currentColor"
                    className="text-white dark:text-zinc-900"
                  />
                </svg>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 text-[#F84E04] font-bold text-sm">
                <span>??</span>
                <span>
                  You saved ₹{Number(savings).toFixed(2)} on this order!
                </span>
              </div>
            </div>
          )}
        </div>

        {/* User & Delivery Details */}
        <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl shadow-sm space-y-5 border border-gray-100 dark:border-zinc-800">
          {/* User */}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-zinc-800 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                {userName || "Customer"}
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs">{userPhone}</p>
            </div>
          </div>

          {/* Payment */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                Payment method
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                Paid via: {paymentMethod.toUpperCase()}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                Payment date
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{paymentDate}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                Delivery address
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 leading-relaxed">
                {addressText || "Address not available"}
              </p>
            </div>
          </div>

          {/* Delivery Partner (Fixed: Vishnu - 8225874798) */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-zinc-800">
            <div className="flex gap-3 items-center">
              <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                <User className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                    Vishnu
                  </h4>
                  <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                    Delivery Partner
                  </span>
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">+91 8225874798</p>
              </div>
            </div>
            <a
              href="tel:8225874798"
              className="p-2.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition-colors"
              aria-label="Call Vishnu"
            >
              <Phone className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-zinc-800 p-4 z-20">
        <div className="max-w-3xl mx-auto flex gap-3">
          {/* CANCELLATION BUTTON (Only visible before processing) */}
          {order?.status === 'confirmed' && (
            <button
              type="button"
              onClick={handleCancelOrder}
              className="flex-1 bg-white dark:bg-zinc-800 border border-red-500 text-red-500 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          )}

          <button
            type="button"
            onClick={() => handleReorder(order)}
            className="flex-1 bg-[#F84E04] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-[#D94F0C] transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reorder
          </button>
          <button
            type="button"
            onClick={handleDownloadSummary}
            className="flex-1 bg-white dark:bg-zinc-800 border border-[#F84E04] text-[#F84E04] py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Invoice
          </button>
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl w-full max-w-sm p-6 shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Cancel Order?</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Are you sure you want to cancel this order? This action cannot be undone.
              {(order?.payment?.method === 'razorpay' || order?.payment?.method === 'wallet') && order?.payment?.status === 'paid' &&
                " Your refund will be processed automatically."}
            </p>

            <textarea
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="Please tell us why you are cancelling..."
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl p-3 text-sm text-gray-900 dark:text-white mb-5 focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none h-24"
            />

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCancelDialog(false)}
                disabled={isCancelling}
                className="flex-1 px-4 py-3 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                No, Keep it
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling || !cancellationReason.trim()}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                {isCancelling ? <Loader2 className="w-5 h-5 animate-spin" /> : "Yes, Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
