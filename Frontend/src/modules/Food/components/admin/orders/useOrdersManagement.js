import { useState, useMemo } from "react"
import { exportToCSV, exportToExcel, exportToPDF, exportToJSON } from "./ordersExportUtils"
import quickSpicyLogo from "@food/assets/switcheats-logo.png"
import { getCachedSettings, loadBusinessSettings } from "@food/utils/businessSettings"
const debugError = () => {}


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
    address.addressLine1,
    address.addressLine2,
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
  const isRestaurantModule = moduleType === "food";

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
    return [...new Set(orders.map(o => o.restaurant))]
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

      // 58mm receipt width ≈ 48mm printable area, use generous height
      const receiptWidth = 58
      const margin = 6.5
      const contentWidth = receiptWidth - margin * 2
      const centerX = receiptWidth / 2

      // Gather order data
      const orderId = order.orderId || order.id || "N/A"
      const orderDate = order.date || new Date().toLocaleDateString()
      const orderTime = order.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
      const paymentType = order.paymentType || order.payment?.method || order.paymentMethod || "N/A"
      const paymentStatus = formatDisplayText(
        order.paymentStatus || order.paymentCollectionStatus || (paymentType === "Cash on Delivery" ? "Not Collected" : "Paid")
      )

      // Generate QR code as data URL
      const feedbackUrl = `https://zin-zoo.vercel.app/feedback?orderId=${order.id || order.orderId || order._id || ""}`
      const qrDataUrl = await QRCode.toDataURL(feedbackUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#000000", light: "#ffffff" }
      })

      // Load logo as data URL
      const logoDataUrl = await imageUrlToDataUrl("/zinzoo-logo.png")

      // Calculate height dynamically
      let estimatedHeight = 40 // logo + header
      estimatedHeight += 20 // customer info
      estimatedHeight += items.length * 5 + 15 // items table
      estimatedHeight += 30 // pricing summary
      estimatedHeight += 18 // payment info
      estimatedHeight += 12 // thank you message
      estimatedHeight += 40 // QR code
      estimatedHeight += 10 // padding
      estimatedHeight = Math.max(estimatedHeight, 140)

      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [receiptWidth, estimatedHeight],
      })

      let y = 4
      const fontSize = (size) => doc.setFontSize(size)
      const bold = () => doc.setFont(undefined, "bold")
      const normal = () => doc.setFont(undefined, "normal")
      const center = (text, yPos) => doc.text(text, centerX, yPos, { align: "center" })
      const dashLine = (yPos) => {
        doc.setDrawColor(0)
        doc.setLineDashPattern([0.5, 0.5], 0)
        doc.line(margin, yPos, receiptWidth - margin, yPos)
        doc.setLineDashPattern([], 0)
      }

      // === LOGO ===
      if (logoDataUrl) {
        try {
          const logoSize = 24
          doc.addImage(logoDataUrl, "PNG", centerX - logoSize / 2, y, logoSize, logoSize, undefined, "FAST")
          y += logoSize + 2
        } catch {
          y += 2
        }
      }

      // === HEADER ===
      doc.setTextColor(0, 0, 0)
      fontSize(9)
      bold()
      center("Zin Zoo", y)
      y += 3.5
      fontSize(6)
      normal()
      
      let serviceSubText = "Food Delivery Service"
      if (moduleType === "grocery") {
        serviceSubText = "Grocery Delivery Service"
      } else if (moduleType === "accessories") {
        serviceSubText = "Accessories Store Service"
      } else if (moduleType === "services" || moduleType === "service") {
        serviceSubText = "Home Booking Service"
      } else if (moduleType) {
        const capitalized = String(moduleType).charAt(0).toUpperCase() + String(moduleType).slice(1)
        serviceSubText = `${capitalized} Service`
      }
      center(serviceSubText, y)
      y += 4

      dashLine(y)
      y += 3

      // === ORDER INFO ===
      fontSize(6.5)
      normal()
      doc.text(`Customer: ${customerName}`, margin, y)
      y += 3.5
      doc.text(`Date: ${orderDate}`, margin, y)
      doc.text(orderTime, receiptWidth - margin, y, { align: "right" })
      y += 3.5
      doc.text(`Bill No: #${orderId}`, margin, y)
      y += 4

      dashLine(y)
      y += 3

      // === ITEMS TABLE HEADER ===
      fontSize(6.5)
      bold()
      doc.text("Item", margin, y)
      doc.text("Qty", margin + 22, y, { align: "center" })
      doc.text("Price", margin + 31, y, { align: "right" })
      doc.text("Amt", receiptWidth - margin, y, { align: "right" })
      y += 1.5
      dashLine(y)
      y += 3

      // === ITEMS ===
      fontSize(6)
      normal()
      if (items.length > 0) {
        items.forEach((item) => {
          const qty = toNumber(item.quantity || 1)
          const price = toNumber(item.price)
          const amount = qty * price
          const name = String(item.name || item.itemName || item.title || "Item").substring(0, 18)

          doc.text(name, margin, y)
          doc.text(String(qty), margin + 22, y, { align: "center" })
          doc.text(price.toFixed(0), margin + 31, y, { align: "right" })
          doc.text(amount.toFixed(0), receiptWidth - margin, y, { align: "right" })
          y += 3.5
        })
      } else {
        doc.text("Order Total", margin, y)
        doc.text(totalAmount.toFixed(2), receiptWidth - margin, y, { align: "right" })
        y += 3.5
      }

      y += 1
      dashLine(y)
      y += 3

      // === PRICING SUMMARY ===
      fontSize(6.5)
      normal()

      const addSummaryRow = (label, value, isBold = false) => {
        if (isBold) bold(); else normal()
        doc.text(label, margin, y)
        doc.text(`Rs. ${value.toFixed(2)}`, receiptWidth - margin, y, { align: "right" })
        y += 3.5
      }

      addSummaryRow("Sub Total", subtotal)
      if (deliveryFee > 0) addSummaryRow("Delivery Fee", deliveryFee)
      if (platformFee > 0) addSummaryRow("Platform Fee", platformFee)
      if (taxAmount > 0) addSummaryRow("Tax", taxAmount)
      if (discountAmount > 0) {
        normal()
        doc.text("Discount", margin, y)
        doc.text(`-Rs. ${discountAmount.toFixed(2)}`, receiptWidth - margin, y, { align: "right" })
        y += 3.5
      }

      y += 1
      dashLine(y)
      y += 3

      // === GRAND TOTAL ===
      fontSize(7.5)
      bold()
      center(`Grand Total: Rs. ${totalAmount.toFixed(2)}`, y)
      y += 4.5

      fontSize(6.5)
      normal()
      center(`Payment: ${paymentType}  |  ${paymentStatus}`, y)
      y += 4

      dashLine(y)
      y += 4

      // === THANK YOU MESSAGE ===
      fontSize(7)
      bold()
      center("Thank You!", y)
      y += 3.5
      fontSize(6)
      normal()
      center("We Look Forward to", y)
      y += 3
      center("Serving You Again.", y)
      y += 5

      dashLine(y)
      y += 3

      // === FEEDBACK QR CODE ===
      fontSize(6)
      normal()
      center("Your feedback matters to us!", y)
      y += 3
      center("Scan to share your experience:", y)
      y += 3

      if (qrDataUrl) {
        const qrSize = 22
        doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, y, qrSize, qrSize)
        y += qrSize + 3
      }

      fontSize(5)
      center("Scan QR to give feedback", y)
      y += 5

      // Trim the page to actual content height
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
