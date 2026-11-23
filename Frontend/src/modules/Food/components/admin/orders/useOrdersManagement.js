import { useState, useMemo } from "react"
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "./ordersExportUtils"
import quickSpicyLogo from "@food/assets/zinzoox-logo.png"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
import { adminAPI } from "@food/api"
const debugError = () => { }


const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const formatMoney = (value) => `INR ${toNumber(value).toFixed(2)}`
const formatDisplayText = (value, fallback = "N/A") => {
  if (value === null || value === undefined) return fallback
  const normalized = String(value).trim()
  return normalized || fallback
}

const formatOrderAddress = (address) => {
  if (!address || typeof address !== "object") return "Not available"

  const formattedAddress = String(address.formattedAddress || "").trim()
  const rawAddress = String(address.address || "").trim()

  const primaryParts = [
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

  const orderedParts = []
  const pushPart = (value) => {
    const normalized = String(value || "").trim()
    if (!normalized) return
    const key = normalized.toLowerCase()

    const isContained = orderedParts.some((existingPart) => {
      const existingKey = existingPart.toLowerCase()
      return existingKey === key || existingKey.includes(key) || key.includes(existingKey)
    })
    if (isContained) return

    orderedParts.push(normalized)
  }

  if (formattedAddress) pushPart(formattedAddress)
  if (rawAddress && rawAddress.toLowerCase() !== formattedAddress.toLowerCase()) pushPart(rawAddress)
  primaryParts.forEach(pushPart)

  return orderedParts.join(", ") || "Not available"
}

const blobToDataUrl = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

const imageUrlToDataUrl = async (url) => {
  if (!url) return null
  if (url.startsWith("data:")) return url

  const u = String(url).trim()
  // Allow all valid URLs but handle errors gracefully
  if (!u.startsWith("http") && !u.startsWith("/")) return null

  try {
    const response = await fetch(url, { mode: 'cors', cache: "force-cache" })
    if (!response.ok) return null
    const blob = await response.blob()
    return await blobToDataUrl(blob)
  } catch (err) {
    debugError('Error converting image to data URL:', err)
    return null
  }
}

export function useOrdersManagement(orders, statusKey, title, moduleType = "food") {
  const isRestaurantModule = moduleType === "food" || moduleType === "all";

  const [searchQuery, setSearchQuery] = useState("")
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOrderOpen, setIsViewOrderOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [filters, setFilters] = useState({
    paymentStatus: "",
    deliveryType: "",
    minAmount: "",
    maxAmount: "",
    fromDate: "",
    toDate: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    orderId: true,
    orderDate: true,
    customer: true,
    restaurant: isRestaurantModule,
    foodItems: true,
    totalAmount: true,
    paymentType: true,
    paymentCollectionStatus: true,
    orderStatus: true,
    deliveryPartner: true,
    actions: true,
  })

  // Get unique restaurants from orders
  const restaurants = useMemo(() => {
    return [...new Set(orders.map(o => o.restaurant).filter(Boolean))]
  }, [orders])

  // Apply search and filters
  const filteredOrders = useMemo(() => {
    let result = [...orders]

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(order => {
        const safeTotal =
          order.totalAmount ??
          order.total ??
          order.pricing?.total ??
          0
        const totalStr = String(safeTotal)
        return (
          String(order.orderId || "")
            .toLowerCase()
            .includes(query) ||
          String(order.customerName || "")
            .toLowerCase()
            .includes(query) ||
          String(order.restaurant || "")
            .toLowerCase()
            .includes(query) ||
          String(order.category || "")
            .toLowerCase()
            .includes(query) ||
          String(order.moduleType || "")
            .toLowerCase()
            .includes(query) ||
          String(order.customerPhone || "").includes(query) ||
          totalStr.includes(query)
        )
      })
    }

    // Apply filters
    if (filters.paymentStatus) {
      const wanted = filters.paymentStatus.toLowerCase()
      result = result.filter((order) => {
        const paymentStatus = String(order.paymentStatus || "").toLowerCase()
        const collectionStatus = String(order.paymentCollectionStatus || "").toLowerCase()
        return paymentStatus === wanted || collectionStatus === wanted
      })
    }

    if (filters.deliveryType) {
      result = result.filter(
        (order) => String(order.deliveryType || "").toLowerCase() === filters.deliveryType.toLowerCase(),
      )
    }

    if (filters.minAmount) {
      const min = parseFloat(filters.minAmount)
      result = result.filter(order => {
        const amount =
          order.totalAmount ??
          order.total ??
          order.pricing?.total ??
          0
        return Number(amount) >= min
      })
    }

    if (filters.maxAmount) {
      const max = parseFloat(filters.maxAmount)
      result = result.filter(order => {
        const amount =
          order.totalAmount ??
          order.total ??
          order.pricing?.total ??
          0
        return Number(amount) <= max
      })
    }



    // Helper function to parse date format "16 JUL 2025"
    const parseOrderDate = (dateStr) => {
      const months = {
        "JAN": "01", "FEB": "02", "MAR": "03", "APR": "04", "MAY": "05", "JUN": "06",
        "JUL": "07", "AUG": "08", "SEP": "09", "OCT": "10", "NOV": "11", "DEC": "12"
      }
      const parts = dateStr.split(" ")
      if (parts.length === 3) {
        const day = parts[0].padStart(2, "0")
        const month = months[parts[1].toUpperCase()] || "01"
        const year = parts[2]
        return new Date(`${year}-${month}-${day}`)
      }
      return new Date(dateStr)
    }

    if (filters.fromDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const fromDate = new Date(filters.fromDate)
        return orderDate >= fromDate
      })
    }

    if (filters.toDate) {
      result = result.filter(order => {
        const orderDate = parseOrderDate(order.date)
        const toDate = new Date(filters.toDate)
        toDate.setHours(23, 59, 59, 999) // Include entire day
        return orderDate <= toDate
      })
    }

    return result
  }, [orders, searchQuery, filters])

  const count = filteredOrders.length

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).filter(value => value !== "").length
  }, [filters])

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      paymentStatus: "",
      deliveryType: "",
      minAmount: "",
      maxAmount: "",
      fromDate: "",
      toDate: "",
    })
  }

  const handleExport = (format) => {
    const filename = title.toLowerCase().replace(/\s+/g, "_")
    switch (format) {
      case "csv":
        exportToCSV(filteredOrders, filename)
        break
      case "excel":
        exportToExcel(filteredOrders, filename)
        break
      case "pdf":
        exportToPDF(filteredOrders, filename)
        break
      case "json":
        exportToJSON(filteredOrders, filename)
        break
      default:
        break
    }
  }

  const handleViewOrder = (order) => {
    setSelectedOrder(order)
    setIsViewOrderOpen(true)
  }

  const handlePrintOrder = async (order) => {
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: QRCode } = await import("qrcode")

      const orderCreatedAt = order.createdAt || new Date().toISOString()
      const orderDate = new Date(orderCreatedAt).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      }).toUpperCase()
      const orderTime = new Date(orderCreatedAt).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit", hour12: true,
      }).toUpperCase()

      // Calculate and gather info
      let platformGstNumber = order?.pricing?.platformGstNumber;
      if (!platformGstNumber) {
        try {
          const res = await adminAPI.getFeeSettings()
          platformGstNumber = res?.data?.data?.feeSettings?.gstNumber || null
        } catch (err) {
          debugError("Failed to fetch GST number for receipt", err)
        }
      }

      const receiptWidth = 72 // slightly wider to fit the new layout better, standard 80mm printer paper has ~72mm printable area
      const margin = 4
      const contentWidth = receiptWidth - margin * 2
      const centerX = receiptWidth / 2

      // Gather order data
      const orderId = order.orderId || order.id || "N/A"
      const billNo = String(order.id || "").slice(-6).toUpperCase() || "N/A"
      const customerName = formatDisplayText(order.customerName)
      const items = Array.isArray(order.items) ? order.items : []

      const subtotal = toNumber(
        items.reduce((sum, item) => sum + toNumber(item?.price) * toNumber(item?.quantity || 1), 0)
        || order.pricing?.subtotal || order.totalItemAmount || order.subtotal || 0
      )
      const deliveryFee = toNumber(order.deliveryCharge ?? order.deliveryFee ?? order.pricing?.deliveryFee ?? 0)
      const taxAmount = toNumber(order.vatTax ?? order.taxAmount ?? order.tax ?? order.pricing?.tax ?? 0)
      const platformFee = toNumber(order.platformFee ?? order.pricing?.platformFee ?? 0)
      const discountAmount = toNumber(order.couponDiscount ?? order.discountAmount ?? order.pricing?.discount ?? 0)
      const totalAmount = toNumber(order.totalAmount ?? order.pricing?.total ?? (subtotal + deliveryFee + taxAmount + platformFee - discountAmount))
      const paymentType = order.paymentType || order.payment?.method || order.paymentMethod || "UPI"

      const totalItems = items.reduce((sum, item) => sum + toNumber(item.quantity || 1), 0)

      // Generate QR code
      const feedbackUrl = `https://zinzoo.in/feedback?orderId=${orderId}`
      const qrDataUrl = await QRCode.toDataURL(feedbackUrl, {
        width: 200, margin: 1, color: { dark: "#000000", light: "#ffffff" }
      })

      // Load logo
      const logoDataUrl = await imageUrlToDataUrl("/zinzoo-logo.png").catch(() => null)

      let estimatedHeight = 230 + (items.length * 5)
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [receiptWidth, estimatedHeight] })

      let y = 6
      const setFont = (size, type = "normal") => { doc.setFontSize(size); doc.setFont("helvetica", type) }
      const center = (text, yPos) => doc.text(text, centerX, yPos, { align: "center" })
      const right = (text, yPos) => doc.text(text, receiptWidth - margin, yPos, { align: "right" })
      const solidLine = (yPos) => { doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(margin, yPos, receiptWidth - margin, yPos) }
      const dashLine = (yPos) => {
        doc.setDrawColor(0); doc.setLineWidth(0.3); doc.setLineDashPattern([1, 1], 0)
        doc.line(margin, yPos, receiptWidth - margin, yPos)
        doc.setLineDashPattern([], 0)
      }

      // --- HEADER ---
      const imgW = 40; const imgH = 25;
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", centerX - imgW / 2, y, imgW, imgH, undefined, "FAST")
        y += imgH + 4
      } else {
        setFont(10, "bold")
        center("ZIN ZOO X", y + 8)
        y += 12
      }

      setFont(12, "bold")
      center("ZIN ZOO X", y)
      y += 4

      setFont(7, "bold")
      let serviceSubText = "FOOD DELIVERY SERVICE"
      if (moduleType === "grocery") serviceSubText = "GROCERY DELIVERY SERVICE"
      else if (moduleType === "accessories") serviceSubText = "ACCESSORIES STORE SERVICE"
      else if (moduleType === "services" || moduleType === "service") serviceSubText = "HOME BOOKING SERVICE"
      else if (moduleType) serviceSubText = `${String(moduleType).toUpperCase()} SERVICE`

      center(`--- ${serviceSubText} ---`, y)
      y += 5

      setFont(6, "normal")
      center("Maihar, Madhya Pradesh (MP)", y)
      y += 3.5
      center("8225874798", y)
      y += 3.5
      center("www.zinzoo.in", y)
      y += 4

      if (platformGstNumber) {
        center(`GST No: ${platformGstNumber}`, y)
        y += 4
      }

      solidLine(y); y += 4;

      // --- ORDER INFO ---
      setFont(7, "bold"); doc.text("Order ID", margin, y);
      setFont(7, "normal"); doc.text(`: ${orderId}`, margin + 15, y); y += 4;
      setFont(7, "bold"); doc.text("Bill No.", margin, y);
      setFont(7, "normal"); doc.text(`: ${billNo}`, margin + 15, y); y += 4;
      
      const displayStatus = (order?.status || order?.orderStatus || 'Pending').toUpperCase()
      setFont(7, "bold"); doc.text("Status", margin, y);
      setFont(7, "normal"); doc.text(`: ${displayStatus}`, margin + 15, y); y += 4;

      dashLine(y); y += 4;

      setFont(7, "normal")
      doc.text("Date", margin, y); doc.text(`: ${orderDate}`, margin + 15, y); y += 4;
      doc.text("Time", margin, y); doc.text(`: ${orderTime}`, margin + 15, y); y += 4;

      solidLine(y); y += 4;

      doc.text("Customer", margin, y); doc.text(`: ${customerName}`, margin + 22, y); y += 4;
      doc.text("Delivery Partner", margin, y); doc.text(`: ZIN ZOO X Rider`, margin + 22, y); y += 4;

      solidLine(y); y += 4;

      // --- ITEMS TABLE ---
      setFont(6.5, "bold")
      doc.text("Item", margin, y)
      doc.text("Qty", margin + 32, y, { align: "center" })
      doc.text("Price", margin + 44, y, { align: "right" })
      right("Amount", y)
      y += 2
      solidLine(y); y += 4;

      setFont(6.5, "normal")
      if (items.length > 0) {
        items.forEach((item) => {
          const qty = toNumber(item.quantity || 1)
          const price = toNumber(item.price)
          const amount = qty * price
          const name = String(item.name || item.itemName || item.title || "Item").substring(0, 20)

          doc.text(name, margin, y)
          doc.text(String(qty), margin + 32, y, { align: "center" })
          doc.text(price.toFixed(2), margin + 44, y, { align: "right" })
          right(amount.toFixed(2), y)
          y += 4
        })
      }
      solidLine(y); y += 4;

      // --- TOTALS ---
      setFont(6.5, "normal")
      doc.text(`Sub Total (${totalItems} Items)`, margin, y); right(`Rs. ${subtotal.toFixed(2)}`, y); y += 4;
      if (deliveryFee > 0) { doc.text("Delivery Charge", margin, y); right(`Rs. ${deliveryFee.toFixed(2)}`, y); y += 4; }
      if (platformFee > 0) { doc.text("Platform Fee", margin, y); right(`Rs. ${platformFee.toFixed(2)}`, y); y += 4; }
      if (discountAmount > 0) { doc.text("Discount", margin, y); right(`-Rs. ${discountAmount.toFixed(2)}`, y); y += 4; }

      dashLine(y); y += 4;

      let taxable = subtotal + deliveryFee + platformFee - discountAmount;
      if (taxAmount > 0) {
        doc.text("Taxable Amount", margin, y); right(`Rs. ${taxable.toFixed(2)}`, y); y += 4;
        const halfTax = taxAmount / 2;
        const halfGstRate = subtotal > 0 ? ((halfTax / subtotal) * 100).toFixed(1) : "0.0";
        doc.text(`CGST @${halfGstRate}%`, margin, y); right(`Rs. ${halfTax.toFixed(2)}`, y); y += 4;
        doc.text(`SGST @${halfGstRate}%`, margin, y); right(`Rs. ${halfTax.toFixed(2)}`, y); y += 4;
      }

      dashLine(y); y += 5;

      setFont(8.5, "bold")
      doc.text("Grand Total", margin, y); right(`Rs. ${totalAmount.toFixed(2)}`, y); y += 5;

      dashLine(y); y += 4;

      setFont(6.5, "normal")
      doc.text("Payment Mode", margin, y); right(paymentType, y); y += 4;
      doc.text("Amount Paid", margin, y); right(`Rs. ${totalAmount.toFixed(2)}`, y); y += 5;

      dashLine(y); y += 5;

      // --- FOOTER ---
      setFont(7, "bold")
      center("Thank You!", y); y += 4;
      center("We Look Forward to Serving You Again.", y); y += 5;

      dashLine(y); y += 4;

      setFont(6, "normal")
      center("We value your feedback!", y); y += 3;
      center("Scan the QR code to share your experience.", y); y += 3;

      if (qrDataUrl) {
        const qrSize = 24
        doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, y, qrSize, qrSize)
        y += qrSize + 4
      }

      setFont(6, "bold")
      center("FOLLOW US", y); y += 4;
      setFont(6, "normal")
      center("Instagram | Facebook | WhatsApp   @zinzoox._01", y); y += 5;

      setFont(5.5, "normal")
      center("Safe Delivery | Fresh Food | On Time", y); y += 3;
      center("10:00 AM to 12:00 AM", y); y += 4;

      const filename = `Receipt_${orderId}_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(filename)
    } catch (error) {
      debugError("Error generating receipt PDF:", error)
      alert("Failed to download receipt. Please try again.")
    }
  }

  const toggleColumn = (columnKey) => {
    setVisibleColumns(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      orderId: true,
      orderDate: true,
      customer: true,
      restaurant: isRestaurantModule,
      foodItems: true,
      totalAmount: true,
      paymentType: true,
      paymentCollectionStatus: true,
      orderStatus: true,
      deliveryPartner: true,
      actions: true,
    })
  }

  return {
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
  }
}

