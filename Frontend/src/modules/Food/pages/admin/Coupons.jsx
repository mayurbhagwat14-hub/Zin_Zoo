import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { Check, ChevronDown, Search, X, Eye } from "lucide-react"
import { adminAPI, groceryAdminAPI, accessoriesAdminAPI } from "@food/api"
import { usePublicSocket } from "@food/hooks/usePublicSocket"
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

function StyledSelect({ value, options, onChange, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false)
  const rootRef = useRef(null)
  const selectedOption = options.find((option) => option.value === value) || options[0]

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("mousedown", handleOutsideClick)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`flex min-h-11 w-full items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 ${
          isOpen ? "border-blue-500 ring-4 ring-blue-100" : "border-slate-200"
        }`}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute z-40 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_16px_40px_rgba(15,23,42,0.16)]"
        >
          {options.map((option) => {
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ${
                  selected
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                }`}
              >
                <span>{option.label}</span>
                {selected && <Check className="h-4 w-4 text-blue-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function RestaurantMultiSelect({ restaurants, value, onChange, error }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef(null)
  const selectedIds = Array.isArray(value) ? value : []
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedRestaurants = useMemo(
    () => restaurants.filter((restaurant) => selectedSet.has(String(restaurant._id))),
    [restaurants, selectedSet],
  )
  const filteredRestaurants = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return restaurants
    return restaurants.filter((restaurant) =>
      String(restaurant.name || "").toLowerCase().includes(normalizedQuery),
    )
  }, [query, restaurants])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const toggleRestaurant = (restaurantId) => {
    const id = String(restaurantId)
    onChange(selectedSet.has(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id])
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={`flex min-h-11 w-full items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm shadow-sm outline-none transition ${
          error ? "border-red-500" : "border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        }`}
      >
        <span className={selectedIds.length ? "font-medium text-slate-700" : "text-slate-400"}>
          {selectedIds.length
            ? `${selectedIds.length} restaurant${selectedIds.length === 1 ? "" : "s"} selected`
            : "Choose restaurants"}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search restaurants..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filteredRestaurants.length > 0 ? filteredRestaurants.map((restaurant) => {
              const id = String(restaurant._id)
              const selected = selectedSet.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleRestaurant(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                  }`}>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate font-medium">{restaurant.name || "Unnamed restaurant"}</span>
                </button>
              )
            }) : (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No restaurants found</p>
            )}
          </div>
        </div>
      )}

      {selectedRestaurants.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedRestaurants.map((restaurant) => {
            const id = String(restaurant._id)
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {restaurant.name}
                <button
                  type="button"
                  onClick={() => toggleRestaurant(id)}
                  aria-label={`Remove ${restaurant.name}`}
                  className="rounded-full p-0.5 hover:bg-blue-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProductMultiSelect({ products, value, onChange, error, placeholder = "Choose items" }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const rootRef = useRef(null)
  const selectedIds = Array.isArray(value) ? value : []
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const selectedProducts = useMemo(
    () => products.filter((product) => selectedSet.has(String(product._id || product.id))),
    [products, selectedSet],
  )
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    if (!normalizedQuery) return products
    return products.filter((product) =>
      String(product.name || "").toLowerCase().includes(normalizedQuery),
    )
  }, [query, products])

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleOutsideClick)
    return () => document.removeEventListener("mousedown", handleOutsideClick)
  }, [])

  const toggleProduct = (productId) => {
    const id = String(productId)
    onChange(selectedSet.has(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id])
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className={`flex min-h-11 w-full items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-left text-sm shadow-sm outline-none transition ${
          error ? "border-red-500" : "border-slate-200 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
        }`}
      >
        <span className={selectedIds.length ? "font-medium text-slate-700" : "text-slate-400"}>
          {selectedIds.length
            ? `${selectedIds.length} item${selectedIds.length === 1 ? "" : "s"} selected`
            : placeholder}
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2.5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {filteredProducts.length > 0 ? filteredProducts.map((product) => {
              const id = String(product._id || product.id)
              const selected = selectedSet.has(id)
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => toggleProduct(id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    selected ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    selected ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300 bg-white"
                  }`}>
                    {selected && <Check className="h-3.5 w-3.5" />}
                  </span>
                  <span className="truncate font-medium">{product.name || "Unnamed item"}</span>
                </button>
              )
            }) : (
              <p className="px-3 py-6 text-center text-sm text-slate-500">No items found</p>
            )}
          </div>
        </div>
      )}

      {selectedProducts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedProducts.map((product) => {
            const id = String(product._id || product.id)
            return (
              <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">
                {product.name}
                <button
                  type="button"
                  onClick={() => toggleProduct(id)}
                  aria-label={`Remove ${product.name}`}
                  className="rounded-full p-0.5 hover:bg-blue-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Coupons() {
  const [searchQuery, setSearchQuery] = useState("")
  const [offers, setOffers] = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [groceryProducts, setGroceryProducts] = useState([])
  const [accessoriesProducts, setAccessoriesProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [submitSuccess, setSubmitSuccess] = useState("")
  const [updatingCartVisibility, setUpdatingCartVisibility] = useState({})
  const [deletingOffer, setDeletingOffer] = useState({})
  const [errors, setErrors] = useState({})
  const [viewingOffer, setViewingOffer] = useState(null)
  const [formData, setFormData] = useState({
    couponCode: "",
    discountType: "percentage",
    discountValue: "",
    customerScope: "all",
    restaurantScope: "all",
    restaurantIds: [],
    moduleType: "food",
    itemIds: [],
    endDate: "",
    startDate: "",
    minOrderValue: "",
    maxDiscount: "",
    usageLimit: "",
    perUserLimit: "",
    isFirstOrderOnly: false,
    adminBearPercentage: "100",
    restaurantBearPercentage: "0",
  })

  const fetchOffers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await adminAPI.getAllOffers({})

      if (response?.data?.success) {
        setOffers(response.data.data.offers || [])
      } else {
        setError("Failed to fetch offers")
      }
    } catch (err) {
      debugError("Error fetching offers:", err)
      setError(err?.response?.data?.message || "Failed to fetch offers")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOffers()
  }, [fetchOffers])

  const socketListeners = useMemo(() => ({
    "offer:update": () => {
      fetchOffers()
    }
  }), [fetchOffers])

  usePublicSocket(socketListeners)

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const response = await adminAPI.getRestaurants({ page: 1, limit: 200 })
        if (response?.data?.success) {
          const list = response?.data?.data?.restaurants || []
          // Backend returns `restaurantName`; normalize to `name` for this dropdown without affecting other pages.
          const normalized = Array.isArray(list)
            ? list.map((r) => ({
              ...r,
              name: r?.name || r?.restaurantName || "",
            }))
            : []
          setRestaurants(normalized)
        }
      } catch (err) {
        debugError("Error fetching restaurants:", err)
      }
    }

    fetchRestaurants()
  }, [])

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const groceryRes = await groceryAdminAPI.getProducts({ page: 1, limit: 1000 })
        if (groceryRes?.data?.success) {
          const list = groceryRes?.data?.data?.products || groceryRes?.data?.products || []
          setGroceryProducts(list)
        }
      } catch (err) {
        debugError("Error fetching grocery products:", err)
      }
      try {
        const accessoriesRes = await accessoriesAdminAPI.getProducts({ page: 1, limit: 1000 })
        if (accessoriesRes?.data?.success) {
          const list = accessoriesRes?.data?.data?.products || accessoriesRes?.data?.products || []
          setAccessoriesProducts(list)
        }
      } catch (err) {
        debugError("Error fetching accessories products:", err)
      }
    }
    fetchProducts()
  }, [])

  const todayYMD = () => {
    const d = new Date()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${d.getFullYear()}-${m}-${day}`
  }

  const validateForm = (draft) => {
    const e = {}
    const f = draft || formData
    const pct = f.discountType === "percentage"
    const value = Number(f.discountValue)
    if (!String(f.couponCode || "").trim()) e.couponCode = "Coupon code is required"
    if (!Number.isFinite(value) || value <= 0) e.discountValue = "Discount must be greater than 0"
    if (pct && (f.maxDiscount === "" || f.maxDiscount === null || f.maxDiscount === undefined)) {
      e.maxDiscount = "Max discount is required for percentage coupons"
    }
    if (f.minOrderValue !== "" && Number(f.minOrderValue) < 0) e.minOrderValue = "Min order cannot be negative"
    if (f.usageLimit !== "" && Number(f.usageLimit) < 1) e.usageLimit = "Usage limit must be at least 1"
    if (f.perUserLimit !== "" && Number(f.perUserLimit) < 1) e.perUserLimit = "Per user limit must be at least 1"
    const isFood = !f.moduleType || f.moduleType === "food"
    if (isFood) {
      const adminBear = Number(f.adminBearPercentage)
      const restaurantBear = Number(f.restaurantBearPercentage)
      if (!Number.isFinite(adminBear) || adminBear < 0 || adminBear > 100) e.adminBearPercentage = "Enter 0 to 100"
      if (!Number.isFinite(restaurantBear) || restaurantBear < 0 || restaurantBear > 100) e.restaurantBearPercentage = "Enter 0 to 100"
      if (Number.isFinite(adminBear) && Number.isFinite(restaurantBear) && Math.round((adminBear + restaurantBear) * 100) / 100 !== 100) {
        e.adminBearPercentage = "Both shares must total 100%"
        e.restaurantBearPercentage = "Both shares must total 100%"
      }
    }
    if (isFood && f.restaurantScope === "selected" && (!Array.isArray(f.restaurantIds) || f.restaurantIds.length === 0)) {
      e.restaurantIds = "Select at least one restaurant"
    }
    if (!isFood && (!Array.isArray(f.itemIds) || f.itemIds.length === 0)) {
      e.itemIds = "Select at least one item"
    }
    const start = f.startDate ? new Date(`${f.startDate}T00:00:00`) : null
    const end = f.endDate ? new Date(`${f.endDate}T00:00:00`) : null
    const now = new Date()
    if (end && end < new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
      e.endDate = "End date cannot be in the past"
    }
    if (start && end && start > end) {
      e.startDate = "Start date must be before end date"
      e.endDate = "End date must be after start date"
    }
    setErrors(e)
    return { valid: Object.keys(e).length === 0, e }
  }

  const handleFormChange = (field, rawValue) => {
    let value = rawValue
    if (field === "couponCode") {
      value = String(value || "").toUpperCase()
    }
    if (field === "discountType") {
      // When switching to flat-price, clear and disable maxDiscount
      if (value === "flat-price") {
        setFormData((prev) => {
          const next = { ...prev, discountType: value, maxDiscount: "" }
          validateForm(next)
          return next
        })
        if (submitError) setSubmitError("")
        if (submitSuccess) setSubmitSuccess("")
        return
      }
    }
    if (field === "restaurantScope" && value === "all") {
      setFormData((prev) => {
        const next = { ...prev, restaurantScope: value, restaurantIds: [] }
        validateForm(next)
        return next
      })
      if (submitError) setSubmitError("")
      if (submitSuccess) setSubmitSuccess("")
      return
    }
    if (field === "moduleType") {
      setFormData((prev) => {
        const next = { ...prev, moduleType: value, itemIds: [] }
        validateForm(next)
        return next
      })
      if (submitError) setSubmitError("")
      if (submitSuccess) setSubmitSuccess("")
      return
    }
    if (field === "adminBearPercentage" || field === "restaurantBearPercentage") {
      const numeric = Number(value)
      const next = { ...formData, [field]: value }
      if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) {
        const counterpart = String(Math.round((100 - numeric) * 100) / 100)
        if (field === "adminBearPercentage") next.restaurantBearPercentage = counterpart
        if (field === "restaurantBearPercentage") next.adminBearPercentage = counterpart
      }
      setFormData(next)
      validateForm(next)
      if (submitError) setSubmitError("")
      if (submitSuccess) setSubmitSuccess("")
      return
    }
    const next = { ...formData, [field]: value }
    // Date constraints
    if (field === "startDate" && next.endDate) {
      // Ensure startDate <= endDate
      const s = next.startDate ? new Date(`${next.startDate}T00:00:00`) : null
      const e = new Date(`${next.endDate}T00:00:00`)
      if (s && s > e) {
        // keep but will show error
      }
    }
    if (field === "endDate" && next.startDate) {
      const s = new Date(`${next.startDate}T00:00:00`)
      const e = next.endDate ? new Date(`${next.endDate}T00:00:00`) : null
      if (e && e < s) {
        // keep but will show error
      }
    }
    setFormData(next)
    validateForm(next)
    if (submitError) {
      setSubmitError("")
    }
    if (submitSuccess) {
      setSubmitSuccess("")
    }
  }

  const resetForm = () => {
    setFormData({
      couponCode: "",
      discountType: "percentage",
      discountValue: "",
      customerScope: "all",
      restaurantScope: "all",
      restaurantIds: [],
      moduleType: "food",
      itemIds: [],
      endDate: "",
      startDate: "",
      minOrderValue: "",
      maxDiscount: "",
      usageLimit: "",
      perUserLimit: "",
      isFirstOrderOnly: false,
      adminBearPercentage: "100",
      restaurantBearPercentage: "0",
    })
  }

  const handleCreateCoupon = async (e) => {
    e.preventDefault()
    setSubmitError("")
    setSubmitSuccess("")
    const { valid } = validateForm()
    if (!valid) {
      setSubmitError("Please fix the highlighted errors")
      return
    }

    if (!formData.couponCode.trim()) {
      setSubmitError("Coupon code is required")
      return
    }

    const parsedDiscountValue = Number(formData.discountValue)
    if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      setSubmitError("Discount value must be greater than 0")
      return
    }

    const isFood = !formData.moduleType || formData.moduleType === "food"
    if (isFood && formData.restaurantScope === "selected" && formData.restaurantIds.length === 0) {
      setSubmitError("Please select at least one restaurant")
      return
    }
    if (!isFood && formData.itemIds.length === 0) {
      setSubmitError("Please select at least one item")
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        couponCode: formData.couponCode.trim(),
        discountType: formData.discountType,
        discountValue: parsedDiscountValue,
        customerScope: formData.customerScope,
        restaurantScope: isFood ? formData.restaurantScope : "all",
        restaurantIds: isFood && formData.restaurantScope === "selected" ? formData.restaurantIds : undefined,
        moduleType: formData.moduleType || "food",
        itemIds: !isFood ? formData.itemIds : undefined,
        endDate: formData.endDate || undefined,
        startDate: formData.startDate || undefined,
        minOrderValue: formData.minOrderValue !== "" ? Number(formData.minOrderValue) : undefined,
        maxDiscount: formData.discountType === "percentage" && formData.maxDiscount !== "" ? Number(formData.maxDiscount) : undefined,
        usageLimit: formData.usageLimit !== "" ? Number(formData.usageLimit) : undefined,
        perUserLimit: formData.perUserLimit !== "" ? Number(formData.perUserLimit) : undefined,
        isFirstOrderOnly: Boolean(formData.isFirstOrderOnly),
        adminBearPercentage: Number(formData.adminBearPercentage),
        restaurantBearPercentage: Number(formData.restaurantBearPercentage),
      }
      await adminAPI.createAdminOffer(payload)

      setSubmitSuccess("Coupon created successfully")
      resetForm()
      await fetchOffers()
    } catch (err) {
      debugError("Error creating coupon:", err)
      setSubmitError(err?.response?.data?.message || "Failed to create coupon")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleShowInCart = async (offerId, itemId, currentValue) => {
    const key = `${offerId}-${itemId}`
    try {
      setUpdatingCartVisibility((prev) => ({ ...prev, [key]: true }))
      const nextValue = !currentValue
      await adminAPI.updateAdminOfferCartVisibility(offerId, itemId, nextValue)
      setOffers((prev) =>
        prev.map((offer) =>
          offer.offerId === offerId && offer.dishId === itemId
            ? { ...offer, showInCart: nextValue }
            : offer,
        ),
      )
    } catch (err) {
      debugError("Error updating cart visibility:", err)
    } finally {
      setUpdatingCartVisibility((prev) => ({ ...prev, [key]: false }))
    }
  }

  const handleDeleteOffer = async (offerId) => {
    if (!offerId) return
    if (deletingOffer[offerId]) return
    try {
      setDeletingOffer((prev) => ({ ...prev, [offerId]: true }))
      await adminAPI.deleteAdminOffer(offerId)
      setOffers((prev) => prev.filter((o) => o.offerId !== offerId))
    } catch (err) {
      debugError("Error deleting offer:", err)
    } finally {
      setDeletingOffer((prev) => ({ ...prev, [offerId]: false }))
    }
  }

  // Filter offers based on search query
  const filteredOffers = useMemo(() => {
    if (!searchQuery.trim()) {
      return offers
    }
    
    const query = searchQuery.toLowerCase().trim()
    return offers.filter(offer =>
      offer.restaurantName?.toLowerCase().includes(query) ||
      offer.dishName?.toLowerCase().includes(query) ||
      offer.couponCode?.toLowerCase().includes(query)
    )
  }, [offers, searchQuery])

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
            <h1 className="text-2xl font-bold text-slate-900">Restaurant Offers & Coupons</h1>
            <button
              type="button"
              onClick={() => {
                setIsAddOpen((prev) => !prev)
                setSubmitError("")
                setSubmitSuccess("")
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              {isAddOpen ? "Close" : "Add Coupon"}
            </button>
          </div>

          {isAddOpen && (
            <form
              onSubmit={handleCreateCoupon}
              className="border border-slate-200 rounded-xl p-4 mb-5 bg-slate-50"
            >
              <h3 className="text-base font-semibold text-slate-900 mb-3">Create Coupon</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Code</label>
                  <input
                    type="text"
                    value={formData.couponCode}
                    onChange={(e) => handleFormChange("couponCode", e.target.value)}
                    placeholder="e.g. NEWUSER50"
                    className="w-full px-3 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Discount Type</label>
                  <StyledSelect
                    value={formData.discountType}
                    onChange={(value) => handleFormChange("discountType", value)}
                    ariaLabel="Discount type"
                    options={[
                      { value: "percentage", label: "Percentage" },
                      { value: "flat-price", label: "Flat Amount" },
                    ]}
                  />
                </div>

                <div title={formData.discountType === "flat-price" ? "Max discount is not applicable for flat coupons" : ""}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {formData.discountType === "percentage" ? "Discount (%)" : "Discount Amount"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="0.01"
                    value={formData.discountValue}
                    onChange={(e) => handleFormChange("discountValue", e.target.value)}
                    placeholder={formData.discountType === "percentage" ? "e.g. 20" : "e.g. 100"}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.discountValue ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                  />
                  {errors.discountValue && <p className="mt-1 text-xs text-red-600">{errors.discountValue}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Customer Scope</label>
                  <StyledSelect
                    value={formData.customerScope}
                    onChange={(value) => handleFormChange("customerScope", value)}
                    ariaLabel="Customer scope"
                    options={[
                      { value: "all", label: "All Users" },
                      { value: "first-time", label: "First-time Users" },
                    ]}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Select Module</label>
                  <StyledSelect
                    value={formData.moduleType || "food"}
                    onChange={(value) => handleFormChange("moduleType", value)}
                    ariaLabel="Select module"
                    options={[
                      { value: "food", label: "Food (Restaurant-wise)" },
                      { value: "grocery", label: "Grocery (Item-wise)" },
                      { value: "accessories", label: "Accessories (Item-wise)" },
                    ]}
                  />
                </div>

                {(formData.moduleType === "food" || !formData.moduleType) && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Coupon Scope</label>
                    <StyledSelect
                      value={formData.restaurantScope}
                      onChange={(value) => handleFormChange("restaurantScope", value)}
                      ariaLabel="Coupon scope"
                      options={[
                        { value: "all", label: "Global / Platform" },
                        { value: "selected", label: "Selected Restaurants" },
                      ]}
                    />
                  </div>
                )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Start Date (Optional)</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleFormChange("startDate", e.target.value)}
                  min={todayYMD()}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.startDate ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.startDate && <p className="mt-1 text-xs text-red-600">{errors.startDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Expiry Date (Optional)</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleFormChange("endDate", e.target.value)}
                  min={formData.startDate || todayYMD()}
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.endDate ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.endDate && <p className="mt-1 text-xs text-red-600">{errors.endDate}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Min Order Value (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.minOrderValue}
                  onChange={(e) => handleFormChange("minOrderValue", e.target.value)}
                  placeholder="e.g. 199"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.minOrderValue ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.minOrderValue && <p className="mt-1 text-xs text-red-600">{errors.minOrderValue}</p>}
              </div>

                <div title={formData.discountType === "flat-price" ? "Max discount is not applicable for flat coupons" : ""}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Max Discount (₹, optional)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                    value={formData.maxDiscount}
                    onChange={(e) => handleFormChange("maxDiscount", e.target.value)}
                  placeholder="e.g. 100"
                    disabled={formData.discountType === "flat-price"}
                    className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.maxDiscount ? "border-red-500" : "border-slate-300"} bg-white disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                  {formData.discountType === "percentage" && errors.maxDiscount && <p className="mt-1 text-xs text-red-600">{errors.maxDiscount}</p>}
              </div>

              {(!formData.moduleType || formData.moduleType === "food") && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Admin Bear (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.adminBearPercentage}
                      onChange={(e) => handleFormChange("adminBearPercentage", e.target.value)}
                      placeholder="e.g. 70"
                      className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.adminBearPercentage ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    />
                    {errors.adminBearPercentage && <p className="mt-1 text-xs text-red-600">{errors.adminBearPercentage}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Restaurant Bear (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={formData.restaurantBearPercentage}
                      onChange={(e) => handleFormChange("restaurantBearPercentage", e.target.value)}
                      placeholder="e.g. 30"
                      className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.restaurantBearPercentage ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                    />
                    {errors.restaurantBearPercentage && <p className="mt-1 text-xs text-red-600">{errors.restaurantBearPercentage}</p>}
                  </div>
                </>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Usage Limit (global)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.usageLimit}
                  onChange={(e) => handleFormChange("usageLimit", e.target.value)}
                  placeholder="e.g. 1000"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.usageLimit ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.usageLimit && <p className="mt-1 text-xs text-red-600">{errors.usageLimit}</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Per User Limit</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={formData.perUserLimit}
                  onChange={(e) => handleFormChange("perUserLimit", e.target.value)}
                  placeholder="e.g. 1"
                  className={`w-full px-3 py-2.5 text-sm rounded-lg border ${errors.perUserLimit ? "border-red-500" : "border-slate-300"} bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                />
                {errors.perUserLimit && <p className="mt-1 text-xs text-red-600">{errors.perUserLimit}</p>}
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="isFirstOrderOnly"
                  type="checkbox"
                  checked={formData.isFirstOrderOnly}
                  onChange={(e) => handleFormChange("isFirstOrderOnly", e.target.checked)}
                  className="h-4 w-4"
                />
                <label htmlFor="isFirstOrderOnly" className="text-sm text-slate-700">First order only</label>
              </div>

                {(!formData.moduleType || formData.moduleType === "food") && formData.restaurantScope === "selected" && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Restaurants</label>
                    <RestaurantMultiSelect
                      restaurants={restaurants}
                      value={formData.restaurantIds}
                      onChange={(restaurantIds) => handleFormChange("restaurantIds", restaurantIds)}
                      error={errors.restaurantIds}
                    />
                    {errors.restaurantIds && <p className="mt-1 text-xs text-red-600">{errors.restaurantIds}</p>}
                  </div>
                )}

                {formData.moduleType === "grocery" && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Grocery Items</label>
                    <ProductMultiSelect
                      products={groceryProducts}
                      value={formData.itemIds}
                      onChange={(itemIds) => handleFormChange("itemIds", itemIds)}
                      error={errors.itemIds}
                      placeholder="Choose grocery items"
                    />
                    {errors.itemIds && <p className="mt-1 text-xs text-red-600">{errors.itemIds}</p>}
                  </div>
                )}

                {formData.moduleType === "accessories" && (
                  <div className="md:col-span-2 lg:col-span-3">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Select Accessories Items</label>
                    <ProductMultiSelect
                      products={accessoriesProducts}
                      value={formData.itemIds}
                      onChange={(itemIds) => handleFormChange("itemIds", itemIds)}
                      error={errors.itemIds}
                      placeholder="Choose accessories items"
                    />
                    {errors.itemIds && <p className="mt-1 text-xs text-red-600">{errors.itemIds}</p>}
                  </div>
                )}
              </div>

              {(submitError || submitSuccess) && (
                <div className={`mt-3 text-sm font-medium ${submitError ? "text-red-600" : "text-green-600"}`}>
                  {submitError || submitSuccess}
                </div>
              )}

              <div className="mt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || Object.keys(errors).length > 0}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {isSubmitting ? "Creating..." : "Create Coupon"}
                </button>
              </div>
            </form>
          )}

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by restaurant name, dish name, or coupon code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Offers List */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">
              Offers List
            </h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredOffers.length} {filteredOffers.length === 1 ? 'offer' : 'offers'}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="text-sm text-slate-500 mt-4">Loading offers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-red-600 mb-1">Error</p>
              <p className="text-sm text-slate-500">{error}</p>
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg font-semibold text-slate-700 mb-1">No Offers Found</p>
              <p className="text-sm text-slate-500">
                {searchQuery ? "No offers match your search criteria" : "No offers have been created yet"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">SI</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Type & Scope</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Target</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Coupon Code</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Customer Scope</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Discount</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Bear Split</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Price</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Min Order</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Usage</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Show In Cart</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Valid Until</th>
                    <th className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredOffers.map((offer) => (
                    <tr key={`${offer.offerId}-${offer.dishId}`} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{offer.sl}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">
                          {offer.moduleType === "grocery"
                            ? "Grocery (Item-wise)"
                            : offer.moduleType === "accessories"
                              ? "Accessories (Item-wise)"
                              : offer.restaurantScope === "all" || offer.restaurantName === "All Restaurants"
                                ? "Global / Platform"
                                : offer.restaurantName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                          {offer.moduleType !== "food" && offer.moduleType
                            ? `${offer.itemIds?.length || 0} product${offer.itemIds?.length === 1 ? "" : "s"}`
                            : offer.dishName}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">
                          {offer.couponCode}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          offer.customerGroup === "new"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {offer.customerGroup === "new" ? "First-time Users" : "All Users"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700 whitespace-nowrap">
                          {offer.discountType === 'flat-price'
                            ? `\u20B9${offer.originalPrice - offer.discountedPrice} OFF`
                            : `${offer.discountPercentage}% OFF${Number(offer.maxDiscount) ? ` (up to \u20B9${Number(offer.maxDiscount)})` : ""}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(!offer.moduleType || offer.moduleType === 'food') ? (
                          <div className="text-xs text-slate-700 leading-5">
                            <p>Admin: {Number(offer.adminBearPercentage ?? 100)}%</p>
                            <p>Restaurant: {Number(offer.restaurantBearPercentage ?? 0)}%</p>
                          </div>
                        ) : (
                          <span className="text-sm text-slate-500">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">
                          {offer.dishId === "all"
                            ? (Number(offer.minOrderValue) ? `Min \u20B9${Number(offer.minOrderValue)}` : "All Items")
                            : (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 line-through">{"\u20B9"}{offer.originalPrice}</span>
                                <span className="text-sm font-semibold text-green-600">{"\u20B9"}{offer.discountedPrice}</span>
                              </div>
                            )}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">
                          {Number(offer.minOrderValue) ? `\u20B9${Number(offer.minOrderValue)}` : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">
                          {`${Number(offer.usedCount || 0)} / ${Number(offer.usageLimit || 0) > 0 ? Number(offer.usageLimit) : "∞"}`}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(() => {
                          const expired = offer.endDate ? (new Date(offer.endDate).getTime() < new Date(new Date().toDateString()).getTime()) : false
                          const status = expired ? 'expired' : (offer.status || 'inactive')
                          const cls =
                            status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : status === 'paused'
                              ? 'bg-orange-100 text-orange-700'
                              : status === 'expired'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          return (
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${cls}`}>
                              {status}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleToggleShowInCart(offer.offerId, offer.dishId, offer.showInCart !== false)}
                          disabled={!!updatingCartVisibility[`${offer.offerId}-${offer.dishId}`]}
                          className={`relative inline-flex h-6 w-12 items-center rounded-full transition-colors ${
                            offer.showInCart !== false ? "bg-green-600" : "bg-slate-300"
                          } disabled:opacity-60`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              offer.showInCart !== false ? "translate-x-7" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700 whitespace-nowrap">
                          {offer.endDate
                            ? (() => {
                                const d = new Date(offer.endDate)
                                const dd = String(d.getDate()).padStart(2, '0')
                                const month = d.toLocaleString('en-US', { month: 'short' })
                                const yyyy = d.getFullYear()
                                return `${dd} ${month} ${yyyy}`
                              })()
                            : 'No expiry'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setViewingOffer(offer)}
                            aria-label="View details"
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteOffer(offer.offerId)}
                            disabled={!!deletingOffer[offer.offerId]}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-60"
                          >
                            {deletingOffer[offer.offerId] ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {viewingOffer && (() => {
        const o = viewingOffer;
        const expired = o.endDate ? (new Date(o.endDate).getTime() < new Date(new Date().toDateString()).getTime()) : false;
        const status = expired ? 'expired' : (o.status || 'inactive');

        // Resolve target names
        let targetList = [];
        if (o.moduleType === "grocery" || o.moduleType === "accessories") {
          targetList = (o.itemIds || []).map(id => {
            const match = [...groceryProducts, ...accessoriesProducts].find(p => String(p._id || p.id) === String(id));
            return match ? match.name : `Item ID: ${id}`;
          });
        } else {
          // Food
          if (o.restaurantScope === "selected") {
            targetList = (o.restaurantIds || []).map(id => {
              const match = restaurants.find(r => String(r._id) === String(id));
              return match ? (match.name || match.restaurantName) : `Restaurant ID: ${id}`;
            });
          } else {
            targetList = ["All Restaurants (Global Offer)"];
          }
        }

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-100">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-lg rounded-xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-100 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b dark:border-slate-800 pb-3">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Coupon Details</h3>
                <button
                  type="button"
                  onClick={() => setViewingOffer(null)}
                  className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Coupon Code</span>
                    <strong className="text-base text-blue-600 dark:text-blue-400 font-mono block mt-0.5">{o.couponCode}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Status</span>
                    <span className={`inline-block px-2.5 py-0.5 mt-0.5 rounded-full text-xs font-semibold capitalize ${
                      status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' :
                      status === 'paused' ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400' :
                      status === 'expired' ? 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-400'
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Module Type</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{o.moduleType || "food"}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Customer Scope</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {o.customerGroup === "new" ? "First-time Users Only" : "All Users"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Discount Value</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {o.discountType === 'flat-price'
                        ? `₹${o.originalPrice - o.discountedPrice} OFF (Flat)`
                        : `${o.discountPercentage}% OFF${Number(o.maxDiscount) ? ` (Up to ₹${Number(o.maxDiscount)})` : ""}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Min Order Value</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {Number(o.minOrderValue) ? `₹${Number(o.minOrderValue)}` : "No Minimum"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Start Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {o.startDate ? new Date(o.startDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "None"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Expiry Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {o.endDate ? new Date(o.endDate).toLocaleDateString(undefined, { dateStyle: 'medium' }) : "No Expiry"}
                    </span>
                  </div>
                </div>

                {(!o.moduleType || o.moduleType === "food") && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Admin Share</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{Number(o.adminBearPercentage ?? 100)}%</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Restaurant Share</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{Number(o.restaurantBearPercentage ?? 0)}%</span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Usage Limit (Global)</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {Number(o.usageLimit || 0) > 0 ? `${o.usageLimit} times` : "Unlimited"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider">Used Count</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{o.usedCount || 0} times</span>
                  </div>
                </div>

                <hr className="border-slate-100 dark:border-slate-800" />

                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    {o.moduleType === "grocery" || o.moduleType === "accessories"
                      ? "Applies to Selected Products"
                      : o.restaurantScope === "selected"
                        ? "Applies to Selected Restaurants"
                        : "Applies to Restaurant Scope"}
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg p-2 bg-slate-50 dark:bg-slate-950">
                    {targetList.length > 0 ? (
                      targetList.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-full px-3 py-1 text-xs font-medium"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">None selected / global</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t dark:border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setViewingOffer(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-lg text-sm font-semibold transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  )
}
