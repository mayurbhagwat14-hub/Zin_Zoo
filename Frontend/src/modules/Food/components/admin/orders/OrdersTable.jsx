import { useState, useEffect, useMemo } from "react"
import { Eye, Printer, ArrowUpDown, Loader2, Check, X, Trash2, RefreshCw, Volume2, Package, Truck, CheckCircle2, Phone, ChevronDown, ChevronUp } from "lucide-react"

const getStatusColor = (orderStatus) => {
  const colors = {
    "Delivered": "bg-emerald-100 text-emerald-700",
    "Pending": "bg-amber-100 text-amber-700",
    "Accepted": "bg-blue-100 text-blue-700",
    "Processing": "bg-orange-100 text-orange-700",
    "Out For Delivery": "bg-purple-100 text-purple-700",
    "Canceled": "bg-rose-100 text-rose-700",
  }
  return colors[orderStatus] || "bg-slate-100 text-slate-700"
}

const getPaymentStatusColor = (paymentStatus) => {
  if (paymentStatus === "Paid" || paymentStatus === "Collected") return "text-emerald-600"
  if (paymentStatus === "Refunded") return "text-sky-600"
  if (paymentStatus === "Unpaid" || paymentStatus === "Failed") return "text-red-600"
  return "text-slate-600"
}

const getPaymentTypeDisplay = (order) => {
  let paymentTypeDisplay = order.paymentType
  if (!paymentTypeDisplay) {
    const paymentMethod = order.payment?.method || order.paymentMethod
    if (paymentMethod === "cash" || paymentMethod === "cod") {
      paymentTypeDisplay = "Cash on Delivery"
    } else if (paymentMethod === "wallet") {
      paymentTypeDisplay = "Wallet"
    } else {
      paymentTypeDisplay = "Online"
    }
  }
  const paymentMethod = order.payment?.method || order.paymentMethod
  if (paymentMethod === "wallet" && paymentTypeDisplay !== "Wallet") {
    paymentTypeDisplay = "Wallet"
  }
  return paymentTypeDisplay
}

const isRefundEligible = (order) => {
  const isCancelled =
    order.orderStatus === "Cancelled by Restaurant" ||
    order.orderStatus === "Cancelled" ||
    order.orderStatus === "Cancelled by User" ||
    order.orderStatus === "Canceled" ||
    (order.status === "cancelled" && (order.cancelledBy === "user" || order.cancelledBy === "restaurant"))

  const paymentMethod = order.payment?.method || order.paymentMethod
  const isOnlinePayment =
    order.paymentType === "Online" ||
    (order.paymentType !== "Cash on Delivery" &&
      order.payment?.method !== "cash" &&
      order.payment?.method !== "cod" &&
      (order.paymentMethod === "razorpay" ||
        order.paymentMethod === "online" ||
        order.payment?.paymentMethod === "razorpay" ||
        order.payment?.method === "razorpay" ||
        order.payment?.method === "online"))

  const isWalletPayment = order.paymentType === "Wallet" || paymentMethod === "wallet"

  return isCancelled && (isOnlinePayment || isWalletPayment)
}

const getRestaurantColor = (name) => {
  if (!name) return {
    bg: "bg-slate-50 dark:bg-slate-900/40",
    text: "text-slate-600 dark:text-slate-400",
    border: "border-slate-200 dark:border-slate-800/50"
  };
  
  const colors = [
    {
      bg: "bg-orange-50 dark:bg-orange-950/40",
      text: "text-orange-600 dark:text-orange-400",
      border: "border-orange-200/60 dark:border-orange-900/50"
    },
    {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-600 dark:text-blue-400",
      border: "border-blue-200/60 dark:border-blue-900/50"
    },
    {
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200/60 dark:border-emerald-900/50"
    },
    {
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-600 dark:text-purple-400",
      border: "border-purple-200/60 dark:border-purple-900/50"
    },
    {
      bg: "bg-pink-50 dark:bg-pink-950/40",
      text: "text-pink-600 dark:text-pink-400",
      border: "border-pink-200/60 dark:border-pink-900/50"
    },
    {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200/60 dark:border-amber-900/50"
    },
    {
      bg: "bg-cyan-50 dark:bg-cyan-950/40",
      text: "text-cyan-600 dark:text-cyan-400",
      border: "border-cyan-200/60 dark:border-cyan-900/50"
    },
    {
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200/60 dark:border-rose-900/50"
    },
  ];
  
  let hash = 0;
  const cleanName = name.trim().toLowerCase();
  for (let i = 0; i < cleanName.length; i++) {
    hash = cleanName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function OrdersTable({
  orders,
  visibleColumns,
  onViewOrder,
  onPrintOrder,
  onRefund,
  onDeleteOrder,
  onAcceptOrder,
  onUpdateStatus,
  onRejectOrder,
  onCancelOrder,
  onDeassignAndResend,
  onResendNotification,
  actionLoadingOrderId,
  deletingOrderId,
  showAssignedDeliveryPartner = false,
}) {
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedItems, setExpandedItems] = useState({})
  const itemsPerPage = 10
  const totalPages = Math.ceil(orders.length / itemsPerPage)

  // Reset to page 1 when orders change
  useEffect(() => {
    setCurrentPage(1)
  }, [orders.length])

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    const end = start + itemsPerPage
    return orders.slice(start, end)
  }, [orders, currentPage])

  const formatRestaurantName = (name) => {
    if (name === "Cafe Monarch") return "Café Monarch"
    return name
  }

  const canShowCancelAction = (order) => {
    const currentStatus = String(order?.orderStatus || "").trim().toLowerCase()
    return [
      "pending",
      "accepted",
      "processing",
      "preparing",
      "ready_for_pickup",
      "ready",
    ].includes(currentStatus)
  }

  const canDeassignAndResend = (order) => {
    const backendStatus = String(order?.status || "").trim().toLowerCase()
    const phase = String(order?.deliveryState?.currentPhase || "").trim().toLowerCase()
    return (
      ["confirmed", "preparing", "ready_for_pickup", "reached_pickup"].includes(backendStatus) &&
      order?.dispatch?.status === "accepted" &&
      Boolean(order?.dispatch?.deliveryPartnerId) &&
      !order?.deliveryState?.pickedUpAt &&
      !["en_route_to_delivery", "at_drop", "delivered", "completed"].includes(phase)
    )
  }

  const canResendNotification = (order) => {
    const backendStatus = String(order?.status || "").trim().toLowerCase()
    const phase = String(order?.deliveryState?.currentPhase || "").trim().toLowerCase()
    return (
      ["confirmed", "preparing", "ready_for_pickup", "ready"].includes(backendStatus) &&
      (!order?.dispatch?.status || order?.dispatch?.status === "unassigned") &&
      !order?.dispatch?.deliveryPartnerId &&
      !order?.deliveryState?.pickedUpAt &&
      !["en_route_to_delivery", "at_drop", "delivered", "completed"].includes(phase)
    )
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            <div className="w-20 h-20 bg-white rounded-xl flex items-center justify-center shadow-md">
              <span className="text-5xl text-orange-500 font-bold">!</span>
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
          <p className="text-sm text-slate-500">There are no orders matching your criteria</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden w-full max-w-full">
      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {visibleColumns.si && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>SI</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.orderId && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order ID</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.orderDate && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Date</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}

              {visibleColumns.customer && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Customer Information</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}

              {visibleColumns.restaurant && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Restaurant</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}

              {visibleColumns.foodItems && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider min-w-[200px]">
                  <div className="flex items-center gap-2">
                    <span>Food Items / Item Price</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.totalAmount && (
                <th className="px-6 py-4 text-right text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <span>Total Amount</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {(visibleColumns.paymentType !== false) && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Payment Type</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {(visibleColumns.paymentCollectionStatus !== false) && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Payment Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}
              {visibleColumns.orderStatus && (
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <span>Order Status</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400 cursor-pointer hover:text-slate-600" />
                  </div>
                </th>
              )}

              {visibleColumns.actions && (
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {paginatedOrders.map((order, index) => (
              <tr
                key={order.orderId}
                className="hover:bg-slate-50 transition-colors"
              >
                {visibleColumns.si && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{(currentPage - 1) * itemsPerPage + index + 1}</span>
                  </td>
                )}
                {visibleColumns.orderId && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-900">{order.orderId}</span>
                  </td>
                )}
                {visibleColumns.orderDate && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-medium text-slate-700">{order.date}, {order.time}</span>
                  </td>
                )}
                {visibleColumns.customer && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-700">{order.customerName}</span>
                      {order.accountName && order.accountName !== order.customerName && (
                        <span className="text-[10px] text-slate-400 font-semibold mt-0.5">By: {order.accountName}</span>
                      )}
                      <span className="text-xs text-slate-500 mt-0.5">{order.customerPhone}</span>
                      {order.accountPhone && order.accountPhone !== order.customerPhone && (
                        <span className="text-[10px] text-slate-400 mt-0.5">Acct: {order.accountPhone}</span>
                      )}
                    </div>
                  </td>
                )}

                {visibleColumns.restaurant && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1.5 items-start">
                      {order.restaurant ? (
                        order.restaurant.split(", ").map((rName, idx) => {
                          const cls = getRestaurantColor(rName);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md border ${cls.bg} ${cls.text} ${cls.border}`}
                            >
                              {rName}
                            </span>
                          );
                        })
                      ) : (
                        <span className="text-sm text-slate-400">N/A</span>
                      )}
                    </div>
                  </td>
                )}

                {visibleColumns.foodItems && (
                  <td className="px-6 py-4">
                    <div className="flex flex-col min-w-[200px] max-w-md">
                      {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                        order.items.map((item, idx) => {
                          const itemRestName = item.restaurantName || item.restaurant || order.restaurant || order.restaurantName || "";
                          const cls = getRestaurantColor(itemRestName);
                          return (
                            <div key={idx || item.itemId || idx} className="flex items-center justify-between gap-3 text-sm py-1.5 border-b border-slate-100 last:border-0">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {item.image ? (
                                  <img
                                    src={item.image}
                                    alt={item.name || "Item"}
                                    className="w-8 h-8 rounded-md object-cover border border-slate-200 flex-shrink-0"
                                    onError={(e) => { e.target.style.display = 'none' }}
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-md bg-slate-100 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-3.5 h-3.5 text-slate-400" />
                                  </div>
                                )}
                                <span className="font-semibold text-slate-500 min-w-[1.5rem] flex-shrink-0">
                                  {item.quantity || 1}x
                                </span>
                                <div className="flex flex-col min-w-0">
                                  <span className="text-slate-800 font-medium truncate">
                                    {item.name || item.itemName || item.title || 'Unknown Item'}
                                  </span>
                                  {itemRestName && (
                                    <span className={`inline-block w-fit text-[9.5px] font-bold px-2 py-0.5 rounded-md border mt-1 shadow-2xs ${cls.bg} ${cls.text} ${cls.border}`}>
                                      {itemRestName}
                                    </span>
                                  )}
                                </div>
                              </div>
                              {item.price && (
                                <span className="text-slate-600 font-medium whitespace-nowrap flex-shrink-0">
                                  ₹{item.price}
                                </span>
                              )}
                            </div>
                          );
                        })
                      ) : (
                        <span className="text-sm text-slate-400 italic">No items found</span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.totalAmount && (
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-slate-900">
                      {(() => {
                        const rawAmount =
                          order.totalAmount ??
                          order.total ??
                          order.pricing?.total ??
                          0;
                        const amount = Number.isFinite(Number(rawAmount))
                          ? Number(rawAmount)
                          : 0;
                        return `₹${amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}`;
                      })()}
                    </div>
                    <div className={`text-xs mt-0.5 ${getPaymentStatusColor(order.paymentStatus)}`}>
                      {order.paymentStatus}
                    </div>
                  </td>
                )}
                {(visibleColumns.paymentType !== false) && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    {(() => {
                      // Determine payment type display
                      let paymentTypeDisplay = order.paymentType;

                      if (!paymentTypeDisplay) {
                        const paymentMethod = order.payment?.method || order.paymentMethod;
                        if (paymentMethod === 'cash' || paymentMethod === 'cod') {
                          paymentTypeDisplay = 'Cash on Delivery';
                        } else if (paymentMethod === 'wallet') {
                          paymentTypeDisplay = 'Wallet';
                        } else {
                          paymentTypeDisplay = 'Online';
                        }
                      }

                      // Override if payment method is wallet but paymentType is not set correctly
                      const paymentMethod = order.payment?.method || order.paymentMethod;
                      if (paymentMethod === 'wallet' && paymentTypeDisplay !== 'Wallet') {
                        paymentTypeDisplay = 'Wallet';
                      }

                      const isCod = paymentTypeDisplay === 'Cash on Delivery';
                      const isWallet = paymentTypeDisplay === 'Wallet';

                      return (
                        <span className={`text-sm font-medium ${isCod ? 'text-amber-600' :
                            isWallet ? 'text-purple-600' :
                              'text-emerald-600'
                          }`}>
                          {paymentTypeDisplay}
                        </span>
                      );
                    })()}
                  </td>
                )}
                {(visibleColumns.paymentCollectionStatus !== false) && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className={`text-sm font-medium ${getPaymentStatusColor(order.paymentStatus)}`}>
                        {order.paymentStatus || "Pending"}
                      </span>
                      {order.paymentCollectionStatus && (
                        <span className="text-xs text-slate-500 mt-0.5">
                          {order.paymentCollectionStatus}
                        </span>
                      )}
                    </div>
                  </td>
                )}
                {visibleColumns.orderStatus && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.orderStatus)}`}>
                          {order.orderStatus}
                        </span>
                      </div>
                      {order.cancellationReason && (
                        <div className="text-xs text-red-600 mt-1">
                          <span className="font-medium">
                            {order.cancelledBy === 'user' ? 'Cancelled by User - ' :
                              order.cancelledBy === 'restaurant' ? 'Cancelled by Restaurant - ' :
                                'Reason: '}
                          </span>
                          {order.cancellationReason}
                        </div>
                      )}
                    </div>
                  </td>
                )}

                {visibleColumns.actions && (
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      {onAcceptOrder && String(order.orderStatus || "").trim().toLowerCase() === "pending" && (
                        <button
                          onClick={() => onAcceptOrder(order)}
                          disabled={actionLoadingOrderId === (order.id || order.orderId)}
                          className="p-1.5 rounded transition-colors text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-1 border border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
                          title="Accept Order"
                        >
                          {actionLoadingOrderId === (order.id || order.orderId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Check className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold">Accept</span></>
                          )}
                        </button>
                      )}

                      {onUpdateStatus && (
                        String(order.orderStatus || "").trim().toLowerCase() === "accepted" ||
                        String(order.orderStatus || "").trim().toLowerCase() === "confirmed"
                      ) && (
                        <button
                          onClick={() => onUpdateStatus(order, 'preparing')}
                          disabled={actionLoadingOrderId === (order.id || order.orderId)}
                          className="p-1.5 rounded transition-colors text-orange-600 hover:bg-orange-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-1 border border-orange-200 bg-orange-50/50 hover:border-orange-300"
                          title="Mark Processing"
                        >
                          {actionLoadingOrderId === (order.id || order.orderId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Package className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold">Process</span></>
                          )}
                        </button>
                      )}

                      {onUpdateStatus && (
                        String(order.orderStatus || "").trim().toLowerCase() === "processing" ||
                        String(order.orderStatus || "").trim().toLowerCase() === "preparing"
                      ) && (
                        <button
                          onClick={() => onUpdateStatus(order, 'ready_for_pickup')}
                          disabled={actionLoadingOrderId === (order.id || order.orderId)}
                          className="p-1.5 rounded transition-colors text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-1 border border-blue-200 bg-blue-50/50 hover:border-blue-300"
                          title="Mark Ready for Pickup"
                        >
                          {actionLoadingOrderId === (order.id || order.orderId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><Check className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold">Ready</span></>
                          )}
                        </button>
                      )}

                      {onUpdateStatus && (
                        String(order.orderStatus || "").trim().toLowerCase() === "ready_for_pickup" ||
                        String(order.orderStatus || "").trim().toLowerCase() === "ready"
                      ) && (
                        <button
                          onClick={() => onUpdateStatus(order, 'delivered')}
                          disabled={actionLoadingOrderId === (order.id || order.orderId)}
                          className="p-1.5 rounded transition-colors text-emerald-600 hover:bg-emerald-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed flex items-center gap-1 border border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"
                          title="Mark Delivered"
                        >
                          {actionLoadingOrderId === (order.id || order.orderId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <><CheckCircle2 className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold">Deliver</span></>
                          )}
                        </button>
                      )}

                      {onCancelOrder ? (
                        <button
                          onClick={() => canShowCancelAction(order) && onCancelOrder(order)}
                          disabled={
                            actionLoadingOrderId === (order.id || order.orderId) ||
                            !canShowCancelAction(order)
                          }
                          className="p-1.5 rounded transition-colors text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                          title="Cancel Order"
                        >
                          {actionLoadingOrderId === (order.id || order.orderId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <X className="w-4 h-4" />
                          )}
                        </button>
                      ) : null}
                      
                      <div className="w-px h-4 bg-slate-200 mx-0.5"></div>
                      
                      <button
                        onClick={() => onViewOrder(order)}
                        className="p-1.5 rounded text-orange-600 hover:bg-orange-50 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onPrintOrder(order)}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Print Order"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                      {onDeleteOrder && (
                        <button
                          onClick={() => onDeleteOrder(order)}
                          disabled={deletingOrderId === (order.id || order.orderId)}
                          className="p-1.5 rounded text-rose-600 hover:bg-rose-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                          title="Delete Order"
                        >
                          {deletingOrderId === (order.id || order.orderId) ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {/* Show Refund button or Refunded status for cancelled orders with Online/Wallet payment (restaurant or user cancelled) */}
                      {(() => {
                        // Check if order is cancelled by restaurant or user
                        const isCancelled = order.orderStatus === "Cancelled by Restaurant" ||
                          order.orderStatus === "Cancelled" ||
                          order.orderStatus === "Cancelled by User" ||
                          (order.status === "cancelled" && (order.cancelledBy === "user" || order.cancelledBy === "restaurant"));

                        // Check if payment type is Online or Wallet (not Cash on Delivery)
                        const paymentMethod = order.payment?.method || order.paymentMethod;
                        const isOnlinePayment = order.paymentType === "Online" ||
                          (order.paymentType !== "Cash on Delivery" &&
                            order.payment?.method !== "cash" &&
                            order.payment?.method !== "cod" &&
                            (order.paymentMethod === "razorpay" ||
                              order.paymentMethod === "online" ||
                              order.payment?.paymentMethod === "razorpay" ||
                              order.payment?.method === "razorpay" ||
                              order.payment?.method === "online"));

                        const isWalletPayment = order.paymentType === "Wallet" || paymentMethod === "wallet";

                        return isCancelled && (isOnlinePayment || isWalletPayment);
                      })() && (
                          <>
                            {order.refundStatus === 'processed' || order.refundStatus === 'initiated' ? (
                              <span className={`px-3 py-1.5 rounded-md text-xs font-medium ${order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-emerald-100 text-emerald-700"
                                }`}>
                                {order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "Wallet Refunded"
                                  : "Refunded"}
                              </span>
                            ) : onRefund ? (
                              <button
                                onClick={() => onRefund(order)}
                                className={`px-3 py-1.5 rounded-md text-white text-xs font-medium hover:opacity-90 transition-colors shadow-sm flex items-center gap-1.5 ${order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                    ? "bg-purple-600 hover:bg-purple-700"
                                    : "bg-blue-600 hover:bg-blue-700"
                                  }`}
                                title={order.paymentType === "Wallet" || order.payment?.method === "wallet"
                                  ? "Process Wallet Refund (Add to user wallet)"
                                  : "Process Refund via Razorpay"}
                              >
                                <span className="text-sm">₹</span>
                                <span>Refund</span>
                              </button>
                            ) : null}
                          </>
                        )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View (visible only on small/mobile screens) */}
      <div className="md:hidden divide-y divide-slate-100 bg-white">
        {paginatedOrders.map((order, index) => {
          const paymentTypeDisplay = getPaymentTypeDisplay(order)
          const isCod = paymentTypeDisplay === "Cash on Delivery"
          const isWallet = paymentTypeDisplay === "Wallet"
          const isOrderLoading = actionLoadingOrderId === (order.id || order.orderId)
          const isDeleting = deletingOrderId === (order.id || order.orderId)
          const orderStatusLower = String(order.orderStatus || "").trim().toLowerCase()
          const isExpanded = expandedItems[order.orderId || order.id]
          const rawAmount = order.totalAmount ?? order.total ?? order.pricing?.total ?? 0
          const amount = Number.isFinite(Number(rawAmount)) ? Number(rawAmount) : 0
          const items = Array.isArray(order.items) ? order.items : []
          const displayedItems = isExpanded ? items : items.slice(0, 2)

          return (
            <div key={order.orderId || order.id || index} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
              {/* Header: Order ID + Status */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400">
                      #{((currentPage - 1) * itemsPerPage) + index + 1}
                    </span>
                    <span className="text-sm font-bold text-slate-900 tracking-tight">
                      {order.orderId}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 font-medium">
                    {order.date}, {order.time}
                  </div>
                </div>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold shrink-0 shadow-2xs ${getStatusColor(order.orderStatus)}`}>
                  {order.orderStatus}
                </span>
              </div>

              {/* Customer & Restaurant info */}
              <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-3 border border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 truncate">{order.customerName}</p>
                    {order.customerPhone && order.customerPhone !== "N/A" && (
                      <p className="text-[11px] text-slate-500 font-medium">{order.customerPhone}</p>
                    )}
                  </div>
                  {order.customerPhone && order.customerPhone !== "N/A" && (
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 text-xs font-semibold flex items-center gap-1.5 shrink-0 active:scale-95 transition-all"
                      title="Call Customer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Call</span>
                    </a>
                  )}
                </div>

                {order.restaurant && (
                  <div className="pt-1.5 border-t border-slate-200/60 dark:border-slate-800 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Store:</span>
                    {order.restaurant.split(", ").map((rName, idx) => {
                      const cls = getRestaurantColor(rName)
                      return (
                        <span
                          key={idx}
                          className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${cls.bg} ${cls.text} ${cls.border}`}
                        >
                          {rName}
                        </span>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Items List */}
              {items.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Items ({items.length})</span>
                  </div>
                  <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-100">
                    {displayedItems.map((item, iIdx) => {
                      const itemRestName = item.restaurantName || item.restaurant || order.restaurant || order.restaurantName || ""
                      const cls = getRestaurantColor(itemRestName)
                      return (
                        <div key={iIdx} className="p-2.5 flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name || "Item"}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                onError={(e) => { e.target.style.display = 'none' }}
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                <Package className="w-4 h-4 text-slate-400" />
                              </div>
                            )}
                            <span className="font-bold text-slate-600 dark:text-slate-400 min-w-[1.5rem] shrink-0">
                              {item.quantity || 1}x
                            </span>
                            <div className="flex flex-col min-w-0">
                              <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {item.name || item.itemName || item.title || "Item"}
                              </span>
                              {itemRestName && (
                                <span className={`inline-block w-fit text-[9.5px] font-bold px-2 py-0.5 rounded-md border mt-1 shadow-2xs ${cls.bg} ${cls.text} ${cls.border}`}>
                                  {itemRestName}
                                </span>
                              )}
                            </div>
                          </div>
                          {item.price && (
                            <span className="font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                              ₹{item.price}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  {items.length > 2 && (
                    <button
                      type="button"
                      onClick={() => setExpandedItems(prev => ({ ...prev, [order.orderId || order.id]: !isExpanded }))}
                      className="text-[11px] text-blue-600 font-semibold hover:underline flex items-center gap-1 py-1"
                    >
                      {isExpanded ? (
                        <>Show less <ChevronUp className="w-3.5 h-3.5" /></>
                      ) : (
                        <>+{items.length - 2} more items <ChevronDown className="w-3.5 h-3.5" /></>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Amount & Payment Info */}
              <div className="flex items-center justify-between py-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Amount</span>
                  <span className="text-base font-extrabold text-slate-900">
                    ₹{amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-semibold border ${
                    isCod ? "bg-amber-50 text-amber-700 border-amber-200" :
                    isWallet ? "bg-purple-50 text-purple-700 border-purple-200" :
                    "bg-emerald-50 text-emerald-700 border-emerald-200"
                  }`}>
                    {paymentTypeDisplay}
                  </span>
                  <div className={`text-[11px] font-semibold mt-0.5 ${getPaymentStatusColor(order.paymentStatus)}`}>
                    {order.paymentStatus || "Pending"}
                  </div>
                </div>
              </div>

              {/* Action Buttons: Touch-optimized, minimum 44px tap targets */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                {/* Primary Lifecycle Status Button */}
                {orderStatusLower === "pending" && onAcceptOrder && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAcceptOrder(order)}
                      disabled={isOrderLoading}
                      className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {isOrderLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4 stroke-[3]" />
                          <span>Accept Order</span>
                        </>
                      )}
                    </button>
                    {canShowCancelAction(order) && onCancelOrder && (
                      <button
                        onClick={() => onCancelOrder(order)}
                        disabled={isOrderLoading}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-semibold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50"
                      >
                        <X className="w-4 h-4 stroke-[2.5]" />
                        <span>Reject</span>
                      </button>
                    )}
                  </div>
                )}

                {(orderStatusLower === "accepted" || orderStatusLower === "confirmed") && onUpdateStatus && (
                  <button
                    onClick={() => onUpdateStatus(order, "preparing")}
                    disabled={isOrderLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isOrderLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        <span>Start Processing</span>
                      </>
                    )}
                  </button>
                )}

                {(orderStatusLower === "processing" || orderStatusLower === "preparing") && onUpdateStatus && (
                  <button
                    onClick={() => onUpdateStatus(order, "ready_for_pickup")}
                    disabled={isOrderLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isOrderLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Mark Ready for Pickup</span>
                      </>
                    )}
                  </button>
                )}

                {(orderStatusLower === "ready_for_pickup" || orderStatusLower === "ready") && onUpdateStatus && (
                  <button
                    onClick={() => onUpdateStatus(order, "delivered")}
                    disabled={isOrderLoading}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {isOrderLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Mark Delivered</span>
                      </>
                    )}
                  </button>
                )}

                {/* Refund button if eligible */}
                {isRefundEligible(order) && (
                  order.refundStatus === "processed" || order.refundStatus === "initiated" ? (
                    <div className="w-full text-center py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold border border-emerald-200">
                      {order.paymentType === "Wallet" || order.payment?.method === "wallet" ? "Wallet Refunded" : "Refunded"}
                    </div>
                  ) : onRefund ? (
                    <button
                      onClick={() => onRefund(order)}
                      className={`w-full min-h-[42px] px-4 py-2 rounded-xl text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-all ${
                        order.paymentType === "Wallet" || order.payment?.method === "wallet"
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-blue-600 hover:bg-blue-700"
                      }`}
                    >
                      <span>₹ Process Refund</span>
                    </button>
                  ) : null
                )}

                {/* Utility Buttons: View Details, Print, Cancel, Delete */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onViewOrder(order)}
                    className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] transition-all"
                  >
                    <Eye className="w-4 h-4 text-orange-500" />
                    <span>Details</span>
                  </button>

                  <button
                    onClick={() => onPrintOrder(order)}
                    className="flex-1 min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 shadow-2xs active:scale-[0.98] transition-all"
                  >
                    <Printer className="w-4 h-4 text-blue-500" />
                    <span>Print</span>
                  </button>

                  {orderStatusLower !== "pending" && canShowCancelAction(order) && onCancelOrder && (
                    <button
                      onClick={() => onCancelOrder(order)}
                      disabled={isOrderLoading}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/70 hover:bg-rose-100 text-rose-600 font-semibold text-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all disabled:opacity-50"
                      title="Cancel Order"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancel</span>
                    </button>
                  )}

                  {onDeleteOrder && (
                    <button
                      onClick={() => onDeleteOrder(order)}
                      disabled={isDeleting}
                      className="min-h-[42px] px-3 py-2 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 font-semibold text-xs flex items-center justify-center shadow-2xs active:scale-[0.98] transition-all disabled:opacity-50"
                      title="Delete Order"
                    >
                      {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 sm:px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
            Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
            <span className="font-semibold">{Math.min(currentPage * itemsPerPage, orders.length)}</span> of{" "}
            <span className="font-semibold">{orders.length}</span> orders
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[38px]"
            >
              Previous
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum
                if (totalPages <= 5) {
                  pageNum = i + 1
                } else if (currentPage <= 3) {
                  pageNum = i + 1
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i
                } else {
                  pageNum = currentPage - 2 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`px-3 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all min-h-[38px] ${currentPage === pageNum
                        ? "bg-emerald-500 text-white shadow-md"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all min-h-[38px]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
