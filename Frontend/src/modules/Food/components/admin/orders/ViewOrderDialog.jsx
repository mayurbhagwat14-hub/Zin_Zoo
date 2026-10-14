import { Eye, MapPin, Package, User, Phone, Mail, Calendar, Clock, Truck, CreditCard, X, Receipt, CheckCircle2, ArrowLeft, FileText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@food/components/ui/dialog"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }


const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-emerald-100 text-emerald-700",
    "Pending": "bg-blue-100 text-blue-700",
    "Scheduled": "bg-blue-100 text-blue-700",
    "Accepted": "bg-green-100 text-green-700",
    "Processing": "bg-orange-100 text-orange-700",
    "Food On The Way": "bg-yellow-100 text-yellow-700",
    "Canceled": "bg-rose-100 text-rose-700",
    "Cancelled by Restaurant": "bg-red-100 text-red-700",
    "Cancelled by User": "bg-orange-100 text-orange-700",
    "Payment Failed": "bg-red-100 text-red-700",
    "Refunded": "bg-sky-100 text-sky-700",
    "Dine In": "bg-indigo-100 text-indigo-700",
    "Offline Payments": "bg-slate-100 text-slate-700",
  }
  return colors[orderStatus] || "bg-slate-100 text-slate-700"
}

const getPaymentStatusColor = (paymentStatus) => {
  if (paymentStatus === "Paid" || paymentStatus === "Collected") return "text-emerald-600"
  if (paymentStatus === "Not Collected") return "text-amber-600"
  if (paymentStatus === "Unpaid" || paymentStatus === "Failed") return "text-red-600"
  return "text-slate-600"
}

export default function ViewOrderDialog({ isOpen, onOpenChange, order }) {
  if (!order) return null

  // Debug: Log order data to check billImageUrl
  if (order.billImageUrl) {
    debugLog('?? Bill Image URL found:', order.billImageUrl)
  } else {
    debugLog('?? Bill Image URL not found in order:', {
      orderId: order.orderId,
      hasBillImageUrl: !!order.billImageUrl,
      orderKeys: Object.keys(order)
    })
  }

  // Format address for display
  const formatAddress = (address) => {
    if (!address || typeof address !== "object") return "N/A"

    const formattedAddress = String(address.formattedAddress || "").trim()
    const rawAddress = String(address.address || "").trim()
    const parts = [
      formattedAddress,
      rawAddress,
      address.label,
      address.street,
      address.additionalDetails,
      address.landmark,
      address.address,
      address.area,
      address.city,
      address.state,
      address.zipCode,
      address.postalCode,
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)

    const uniqueParts = []
    parts.forEach((part) => {
      const key = part.toLowerCase()
      const isContained = uniqueParts.some((existingPart) => {
        const existingKey = existingPart.toLowerCase()
        return existingKey === key || existingKey.includes(key) || key.includes(existingKey)
      })
      if (isContained) return
      uniqueParts.push(part)
    })

    return uniqueParts.length > 0 ? uniqueParts.join(", ") : "Address not available"
  }

  // Get coordinates if available
  const getCoordinates = (address) => {
    if (address?.location?.coordinates && Array.isArray(address.location.coordinates) && address.location.coordinates.length === 2) {
      const [lng, lat] = address.location.coordinates
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }
    return null
  }

  const isFoodOrder = !order.moduleType || order.moduleType === 'food'

  // Group items by restaurant name
  const groupedItems = {}
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item) => {
      const rName = item.restaurantName || item.restaurant || order.restaurant || order.restaurantName || "Store"
      if (!groupedItems[rName]) {
        groupedItems[rName] = []
      }
      groupedItems[rName].push(item)
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-white dark:bg-slate-900 border dark:border-slate-800/80 p-0 overflow-y-auto">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-white">

                <Eye className="w-5 h-5 text-orange-600" />
                Order Details
              </DialogTitle>
              <DialogDescription className="mt-1 ml-10 text-slate-500 dark:text-slate-400">
                View complete information about this order
              </DialogDescription>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>
        <div className="px-6 py-6 space-y-6">
          {/* Basic Order Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Order ID
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{order.orderId || order.id || order.subscriptionId}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Order Date
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{order.date}{order.time ? `, ${order.time}` : ""}</p>
              </div>
              {order.orderOtp && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    Handover Code (OTP)
                  </p>
                  <p className="text-lg font-bold text-slate-950 dark:text-white tracking-[0.2em]">{order.orderOtp}</p>
                </div>
              )}

              {order.deliveredAt && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Delivered At
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {new Date(order.deliveredAt).toLocaleString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }).toUpperCase()}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {order.orderStatus && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Order Status</p>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                    {order.orderStatus}
                  </span>
                  {order.cancellationReason && (
                    <p className="text-xs text-red-600 dark:text-red-450 mt-1">
                      <span className="font-medium">
                        {order.cancelledBy === 'user' ? 'Cancelled by User - ' :
                          order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant - ' :
                            'Cancellation '}Reason:
                      </span> {order.cancellationReason}
                    </p>
                  )}
                  {order.cancelledAt && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Cancelled: {new Date(order.cancelledAt).toLocaleString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      }).toUpperCase()}
                    </p>
                  )}
                </div>
              )}
              {(order.paymentStatus || order.paymentCollectionStatus != null) && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-4 h-4" />
                    Payment Status
                  </p>
                  <p className={`text-sm font-medium ${getPaymentStatusColor(
                    order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      ? (order.paymentCollectionStatus ? 'Collected' : (order.status === 'delivered' ? 'Collected' : 'Not Collected'))
                      : order.paymentStatus
                  )}`}>
                    {order.paymentType === 'Cash on Delivery' || order.payment?.method === 'cash' || order.payment?.method === 'cod'
                      ? (order.paymentCollectionStatus ? 'Collected' : (order.status === 'delivered' ? 'Collected' : 'Not Collected'))
                      : order.paymentStatus}
                  </p>
                </div>
              )}
              {order.deliveryType && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Truck className="w-4 h-4" />
                    Delivery Type
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{order.deliveryType}</p>
                </div>
              )}
            </div>
          </div>

          {/* Customer Information */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Customer Name (Recipient)</p>
                <p className="text-sm font-medium text-slate-900 dark:text-white">{order.customerName || "N/A"}</p>
                {order.accountName && order.accountName !== order.customerName && (
                  <p className="text-xs text-slate-500">Account: <span className="font-semibold text-slate-700 dark:text-slate-300">{order.accountName}</span></p>
                )}
              </div>
              {order.customerPhone && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Phone
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{order.customerPhone}</p>
                  {order.accountPhone && order.accountPhone !== order.customerPhone && (
                    <p className="text-xs text-slate-500">Account Phone: <span className="font-semibold text-slate-700 dark:text-slate-300">{order.accountPhone}</span></p>
                  )}
                </div>
              )}
              {order.customerEmail && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{order.customerEmail}</p>
                </div>
              )}
            </div>
          </div>

          {/* Delivery Note */}
          {order.note && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Delivery Note
              </h3>
              <div className="bg-orange-50 dark:bg-orange-950/30 text-orange-800 dark:text-orange-200 p-3 rounded-lg text-sm italic border border-orange-100 dark:border-orange-900/50">
                "{order.note}"
              </div>
            </div>
          )}

          {/* Order Items */}
          {order.items && Array.isArray(order.items) && order.items.length > 0 && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-350 mb-4 flex items-center gap-2">
                <Package className="w-4 h-4" />
                Order Items ({order.items.length})
              </h3>
              <div className="space-y-6">
                {Object.entries(groupedItems).map(([restaurantName, items]) => (
                  <div key={restaurantName} className="space-y-3">
                    {restaurantName && restaurantName !== "Default Kitchen" && (
                      <div className="flex items-center gap-2 border-b border-dashed border-slate-200 dark:border-slate-800 pb-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-md">
                          {restaurantName}
                        </span>
                      </div>
                    )}
                    <div className="space-y-3">
                      {items.map((item, index) => (
                        <div key={index} className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                          <div className="flex items-start gap-3 flex-1">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name || "Item"}
                                className="w-12 h-12 rounded-lg object-cover border border-slate-200 dark:border-slate-800 flex-shrink-0"
                                onError={(e) => { e.target.style.display = 'none' }}
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center flex-shrink-0">
                                <Package className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 px-2 py-1 rounded">
                                  {item.quantity || 1}x
                                </span>
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name || "Unknown Item"}</p>
                                {item.isVeg !== undefined && (
                                  <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${item.isVeg ? 'bg-green-100 text-green-700 dark:bg-green-950/55 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-950/55 dark:text-red-400'}`}>
                                    {item.isVeg ? 'Veg' : 'Non-Veg'}
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.description}</p>
                              )}
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white flex-shrink-0 ml-3">
                            ₹{((item.price || 0) * (item.quantity || 1)).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}



          {/* Delivery Address */}
          {order.address && (
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-350 mb-4 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </h3>
              <div className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                <p className="text-sm text-slate-900 dark:text-white">{formatAddress(order.address)}</p>
                {getCoordinates(order.address) && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                    <span className="font-medium">Coordinates:</span> {getCoordinates(order.address)}
                  </p>
                )}
                {order.address.label && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Label:</span> {order.address.label}
                  </p>
                )}
              </div>
            </div>
          )}



          {/* Pricing Breakdown */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-350 mb-4">Pricing Breakdown</h3>
            <div className="space-y-2">
              {order.totalItemAmount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Subtotal</span>
                  <span className="font-medium text-slate-900 dark:text-white">₹{order.totalItemAmount.toFixed(2)}</span>
                </div>
              )}
              {order.itemDiscount !== undefined && order.itemDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Discount</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">-₹{order.itemDiscount.toFixed(2)}</span>
                </div>
              )}
              {order.couponDiscount !== undefined && order.couponDiscount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Coupon Discount</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">-₹{order.couponDiscount.toFixed(2)}</span>
                </div>
              )}
              {order.deliveryCharge !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Delivery Charge</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {order.deliveryCharge > 0 ? `₹${order.deliveryCharge.toFixed(2)}` : <span className="text-emerald-600 dark:text-emerald-400">Free delivery</span>}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Platform Fee</span>
                <span className="font-medium text-slate-900 dark:text-white">
                  {order.platformFee !== undefined && order.platformFee > 0
                    ? `₹${order.platformFee.toFixed(2)}`
                    : <span className="text-slate-400">₹0.00</span>}
                </span>
              </div>
              {isFoodOrder && order.pricing?.restaurantCommission !== undefined && (
                <>
                  <div className="flex justify-between text-sm border-t border-dashed border-slate-100 dark:border-slate-800/50 pt-2 mt-2">
                    <span className="text-slate-600 dark:text-slate-400">Restaurant Commission</span>
                    <span className="font-semibold text-orange-600 dark:text-orange-400">
                      ₹{order.pricing.restaurantCommission.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Restaurant Net Share</span>
                    <span className="font-medium text-slate-900 dark:text-white">
                      ₹{(Math.max(0, (order.pricing.subtotal || order.totalItemAmount || 0) - order.pricing.restaurantCommission)).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex justify-between text-sm border-t border-dashed border-slate-100 dark:border-slate-800/50 pt-2 mt-2">
                <span className="text-slate-600 dark:text-slate-400">Platform Net Share</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  ₹{(
                    (order.platformFee || 0) +
                    (order.deliveryCharge || 0) +
                    (isFoodOrder ? (order.pricing?.restaurantCommission || 0) : 0)
                  ).toFixed(2)}
                </span>
              </div>
              {order.vatTax !== undefined && order.vatTax > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Tax (GST)</span>
                  <span className="font-medium text-slate-900 dark:text-white">₹{order.vatTax.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-slate-700 dark:text-slate-350">Total Amount</span>
                  <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                    ₹{(order.totalAmount || order.total || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
