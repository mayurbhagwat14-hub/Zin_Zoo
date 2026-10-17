import { useState, useMemo, useEffect, useCallback } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { Search, Trash2, Loader2, Eye, Pencil, Plus, Save, ChevronDown, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"
import { usePublicSocket } from "@food/hooks/usePublicSocket"
import { Popover, PopoverContent, PopoverTrigger } from "@food/components/ui/popover"
import { getFoodDisplayPrice, getFoodVariants } from "@food/utils/foodVariants"
import ImageUploadField from "../../../components/admin/ImageUploadField"
import { canCurrentAdminAction } from "@food/utils/adminRbac"
const debugLog = (...args) => { }
const debugWarn = (...args) => { }
const debugError = (...args) => { }

const getEntityId = (value) => {
  if (!value) return ""
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (typeof value === "object") {
    return String(value._id || value.id || value.restaurantId || "")
  }
  return ""
}

const getRestaurantName = (value) => {
  if (!value || typeof value !== "object") return ""
  return String(value.name || value.restaurantName || "")
}

let lastSelectedRestaurantForAdd = ""
let lastSelectedCategoryForAdd = ""
let lastSelectedCategoryNameForAdd = ""
let lastSelectedTimingForAdd = ""

const createFoodForm = () => ({
  restaurantId: lastSelectedRestaurantForAdd,
  categoryId: lastSelectedCategoryForAdd,
  categoryName: lastSelectedCategoryNameForAdd,
  name: "",
  price: "",
  variants: [],
  description: "",
  image: "",
  foodType: "Non-Veg",
  isAvailable: true,
  preparationTime: lastSelectedTimingForAdd,
  zoneId: "global",
  quantity: "",
})

const createVariantDraft = (variant = {}) => ({
  id: String(variant?.id || variant?._id || `variant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
  name: String(variant?.name || ""),
  price: variant?.price != null ? String(variant.price) : "",
})

const FOOD_FALLBACK_IMAGE = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E"

export default function FoodsList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRestaurant, setSelectedRestaurant] = useState("all")
  const [selectedCategory, setSelectedCategory] = useState("all")
  const [isCategoryDropdownOpen, setIsCategoryDropdownOpen] = useState(false)
  const [categorySearchQuery, setCategorySearchQuery] = useState("")
  const [isRestaurantDropdownOpen, setIsRestaurantDropdownOpen] = useState(false)
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState("")
  const [filterCategories, setFilterCategories] = useState([])
  const [foods, setFoods] = useState([])
  const [restaurantsForFilter, setRestaurantsForFilter] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [selectedFood, setSelectedFood] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFoodFormModal, setShowFoodFormModal] = useState(false)
  const [foodFormMode, setFoodFormMode] = useState("add")
  const [foodForm, setFoodForm] = useState(createFoodForm())
  const [editingFood, setEditingFood] = useState(null)
  const [submittingFood, setSubmittingFood] = useState(false)
  const [categoryOptions, setCategoryOptions] = useState([])
  const [categorySearch, setCategorySearch] = useState("")
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false)
  const [zones, setZones] = useState([])
  const [zonesLoading, setZonesLoading] = useState(false)
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalFoods, setTotalFoods] = useState(0)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")
  const [imageVersion, setImageVersion] = useState(Date.now())
  const ensureActionAccess = (action) => {
    if (canCurrentAdminAction(action)) return true
    toast.error("Insufficient permissions for this action")
    return false
  }

  const withImageVersion = (url) => {
    if (!url || typeof url !== "string") return FOOD_FALLBACK_IMAGE
    return `${url}${url.includes("?") ? "&" : "?"}v=${imageVersion}`
  }

  useEffect(() => {
    if (foodFormMode === "add") {
      lastSelectedRestaurantForAdd = foodForm.restaurantId
      lastSelectedCategoryForAdd = foodForm.categoryId
      lastSelectedCategoryNameForAdd = foodForm.categoryName
    }
  }, [foodForm.restaurantId, foodForm.categoryId, foodForm.categoryName, foodFormMode])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim())
    }, 300)

    return () => window.clearTimeout(timeoutId)
  }, [searchQuery])

  const fetchRestaurantsForFilter = useCallback(async () => {
    try {
      const restaurantsResponse = await adminAPI.getRestaurants({ limit: 1000 })
      const list =
        restaurantsResponse?.data?.data?.restaurants ||
        restaurantsResponse?.data?.restaurants ||
        []

      const restaurantsMap = new Map()
        ; (Array.isArray(list) ? list : []).forEach((restaurant) => {
          const restaurantId = getEntityId(restaurant)
          if (!restaurantId || restaurantsMap.has(restaurantId)) return
          restaurantsMap.set(restaurantId, {
            id: restaurantId,
            name: getRestaurantName(restaurant) || "Unknown Restaurant",
            type: restaurant.restaurantType || "Both",
          })
        })

      setRestaurantsForFilter(
        Array.from(restaurantsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      )
    } catch (error) {
      debugError("Error fetching restaurants:", error)
      setRestaurantsForFilter([])
    }
  }, [])

  useEffect(() => {
    fetchRestaurantsForFilter()
  }, [fetchRestaurantsForFilter])

  const [selectedIds, setSelectedIds] = useState([])
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false)

  // Clear selections when changing page, search, or filters to prevent stale selections
  useEffect(() => {
    setSelectedIds([])
  }, [currentPage, debouncedSearchQuery, selectedRestaurant, selectedCategory])

  const visibleFoodIds = useMemo(() => foods.map(f => String(f.id)), [foods])
  const isAllVisibleSelected = visibleFoodIds.length > 0 && visibleFoodIds.every(id => selectedIds.includes(id))
  const isSomeVisibleSelected = visibleFoodIds.length > 0 && visibleFoodIds.some(id => selectedIds.includes(id)) && !isAllVisibleSelected

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedIds(prev => {
        const newIds = new Set(prev)
        visibleFoodIds.forEach(id => newIds.add(id))
        return Array.from(newIds)
      })
    } else {
      setSelectedIds(prev => prev.filter(id => !visibleFoodIds.includes(id)))
    }
  }

  const handleSelectOne = (e, id) => {
    const stringId = String(id)
    if (e.target.checked) {
      setSelectedIds(prev => [...prev, stringId])
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== stringId))
    }
  }

  const handleBulkDelete = async () => {
    if (!ensureActionAccess('delete')) return
    try {
      setIsBulkDeleting(true)
      const res = await adminAPI.bulkDeleteFoods(selectedIds)
      if (res.data?.success) {
        toast.success(res.data.message || `Successfully deleted ${selectedIds.length} items`)
        setSelectedIds([])
        setShowBulkDeleteModal(false)
        fetchAllFoods()
      } else {
        toast.error(res.data?.message || "Failed to delete selected items")
      }
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete selected items")
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const fetchCategoriesForFilter = useCallback(async () => {
    try {
      const res = await adminAPI.getCategories({ limit: 1000 })
      const list = res?.data?.data?.categories || []
      const options = Array.isArray(list)
        ? list
          .map((c) => ({ id: String(c.id || c._id || c.name), name: String(c.name || "").trim() }))
          .filter((c) => c.name)
        : []
      setFilterCategories(options)
    } catch (error) {
      debugError("Error fetching categories for filter:", error)
      setFilterCategories([])
    }
  }, [])

  useEffect(() => {
    fetchCategoriesForFilter()
  }, [fetchCategoriesForFilter])

  const fetchAllFoods = useCallback(async () => {
    try {
      setLoading(true)

      const params = { page: currentPage, limit: pageSize }
      if (selectedRestaurant !== "all") params.restaurantId = selectedRestaurant
      if (selectedCategory !== "all") params.categoryId = selectedCategory
      if (debouncedSearchQuery) params.search = debouncedSearchQuery

      const foodsRes = await adminAPI.getFoods(params)
      const list = foodsRes?.data?.data?.foods || []
      const total = Number(foodsRes?.data?.data?.total ?? foodsRes?.data?.total ?? 0)
      const normalizedFoods = Array.isArray(list)
        ? list.map((f) => ({
          id: String(f.id || f._id || ""),
          _id: f._id || f.id,
          name: f.name || "Unnamed Item",
          image: f.image || FOOD_FALLBACK_IMAGE,
          status: f.isAvailable !== false && String(f.approvalStatus || "").toLowerCase() !== "rejected",
          restaurantId: getEntityId(f.restaurantId || f.restaurant?._id || f.restaurant),
          restaurantName:
            f.restaurantName ||
            getRestaurantName(f.restaurant) ||
            "Unknown Restaurant",
          categoryId: String(f.categoryId || ""),
          categoryName: f.categoryName || "",
          price: Number(f.price) || 0,
          variants: getFoodVariants(f),
          foodType: f.foodType || "Non-Veg",
          approvalStatus: f.approvalStatus || "approved",
          description: f.description || "",
          preparationTime: f.preparationTime || "",
          isAvailable: f.isAvailable !== false,
          quantity: f.quantity || 0,
          zoneId: f.zoneId || null,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
        }))
        : []

      setFoods(normalizedFoods)
      setTotalFoods(Number.isFinite(total) ? total : normalizedFoods.length)
      setImageVersion(Date.now())
      setRestaurantsForFilter((prev) => {
        const restaurantsMap = new Map((Array.isArray(prev) ? prev : []).map((restaurant) => [restaurant.id, restaurant]))
        normalizedFoods.forEach((food) => {
          const restaurantId = getEntityId(food.restaurantId)
          if (!restaurantId || restaurantsMap.has(restaurantId)) return
          restaurantsMap.set(restaurantId, {
            id: restaurantId,
            name: food.restaurantName || "Unknown Restaurant",
            type: food.restaurant?.restaurantType || "Both",
          })
        })
        return Array.from(restaurantsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
      })
    } catch (error) {
      debugError("Error fetching foods:", error)
      toast.error("Failed to load foods")
      setFoods([])
      setTotalFoods(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, selectedRestaurant, selectedCategory, debouncedSearchQuery])

  useEffect(() => {
    fetchAllFoods()
  }, [fetchAllFoods])

  useEffect(() => {
    const fetchZonesOnMount = async () => {
      try {
        setZonesLoading(true)
        const res = await adminAPI.getZones({ limit: 1000 })
        const list = res?.data?.data?.zones || res?.data?.data?.data?.zones || res?.data?.data || []
        setZones(Array.isArray(list) ? list : [])
      } catch (err) {
        console.error("Error loading zones on mount:", err)
        setZones([])
      } finally {
        setZonesLoading(false)
      }
    }
    fetchZonesOnMount()
  }, [])

  const socketListeners = useMemo(() => ({
    'food:product:update': () => {
      console.log('[FoodsList] Foods updated via socket, refetching...');
      fetchAllFoods();
    }
  }), [fetchAllFoods]);
  usePublicSocket(socketListeners);

  const [searchParams] = useSearchParams()
  const productIdFromUrl = searchParams.get("productId")

  useEffect(() => {
    if (productIdFromUrl && foods.length > 0) {
      const food = foods.find(f => f.id === productIdFromUrl || f._id === productIdFromUrl)
      if (food) {
        handleViewDetails(food)
      }
    }
  }, [productIdFromUrl, foods])

  // Format ID to FOOD format (e.g., FOOD519399)
  const formatFoodId = (id) => {
    if (!id) return "FOOD000000"

    const idString = String(id)
    // Extract last 6 digits from the ID
    // Handle formats like "1768285554154-0.703896654519399" or "item-1768285554154-0.703896654519399"
    const parts = idString.split(/[-.]/)
    let lastDigits = ""

    // Get the last part and extract digits
    if (parts.length > 0) {
      const lastPart = parts[parts.length - 1]
      // Extract only digits from the last part
      const digits = lastPart.match(/\d+/g)
      if (digits && digits.length > 0) {
        // Get last 6 digits from all digits found
        const allDigits = digits.join("")
        lastDigits = allDigits.slice(-6).padStart(6, "0")
      }
    }

    // If no digits found, use a hash of the ID
    if (!lastDigits) {
      const hash = idString.split("").reduce((acc, char) => {
        return ((acc << 5) - acc) + char.charCodeAt(0) | 0
      }, 0)
      lastDigits = Math.abs(hash).toString().slice(-6).padStart(6, "0")
    }

    return `FOOD${lastDigits}`
  }

  const totalPages = useMemo(() => {
    if (totalFoods === 0) return 1
    return Math.ceil(totalFoods / pageSize)
  }, [totalFoods, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedRestaurant, pageSize])

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  const restaurantOptions = useMemo(() => {
    return restaurantsForFilter
  }, [restaurantsForFilter])

  const openAddFoodModal = () => {
    if (!ensureActionAccess("create")) return
    setFoodFormMode("add")
    setEditingFood(null)
    setFoodForm({
      ...createFoodForm(),
      restaurantId: selectedRestaurant !== "all" ? selectedRestaurant : (lastSelectedRestaurantForAdd || restaurantOptions[0]?.id || ""),
    })
    setSelectedImageFile(null)
    setImagePreviewUrl("")
    setCategorySearch("")
    setCategoryPopoverOpen(false)
    setShowFoodFormModal(true)
  }

  const openEditFoodModal = (food) => {
    if (!ensureActionAccess("edit")) return
    setFoodFormMode("edit")
    setEditingFood(food)
    setFoodForm({
      restaurantId: String(food.restaurantId || ""),
      categoryId: String(food.categoryId || ""),
      categoryName: String(food.categoryName || ""),
      zoneId: String(food.zoneId || "global"),
      name: String(food.name || ""),
      price: String(food.price || ""),
      variants: getFoodVariants(food).map(createVariantDraft),
      description: String(food.description || ""),
      image: String(food.image || ""),
      foodType: String(food.foodType || "Non-Veg"),
      isAvailable: food.isAvailable !== false,
      preparationTime: String(food.preparationTime || ""),
      quantity: String(food.quantity || 0),
    })
    setSelectedImageFile(null)
    setImagePreviewUrl(String(food.image || ""))
    setCategorySearch("")
    setCategoryPopoverOpen(false)
    setShowFoodFormModal(true)
  }

  useEffect(() => {
    if (!showFoodFormModal) {
      setCategoryOptions([])
      return
    }

    let cancelled = false

    const loadCategoryOptions = async () => {
      try {
        const res = await adminAPI.getCategories({ limit: 1000 })
        const list = res?.data?.data?.categories || []
        const options = Array.isArray(list)
          ? list
            .map((c) => ({ id: String(c.id || c._id || c.name), name: String(c.name || "").trim() }))
            .filter((c) => c.name)
          : []
        if (!cancelled) setCategoryOptions(options)
      } catch (error) {
        if (!cancelled) {
          setCategoryOptions([])
        }
      }
    }

    loadCategoryOptions()

    return () => {
      cancelled = true
    }
  }, [showFoodFormModal])

  const handleVariantChange = (variantId, field, value) => {
    setFoodForm((prev) => ({
      ...prev,
      variants: (Array.isArray(prev.variants) ? prev.variants : []).map((variant) =>
        variant.id === variantId ? { ...variant, [field]: value } : variant,
      ),
    }))
  }

  const handleAddVariant = () => {
    if (!ensureActionAccess(foodFormMode === "edit" ? "edit" : "create")) return
    setFoodForm((prev) => ({
      ...prev,
      variants: [...(Array.isArray(prev.variants) ? prev.variants : []), createVariantDraft()],
    }))
  }

  const handleRemoveVariant = (variantId) => {
    if (!ensureActionAccess(foodFormMode === "edit" ? "edit" : "create")) return
    setFoodForm((prev) => ({
      ...prev,
      variants: (Array.isArray(prev.variants) ? prev.variants : []).filter((variant) => variant.id !== variantId),
    }))
  }

  const handleFoodFormSubmit = async () => {
    if (!ensureActionAccess(foodFormMode === "edit" ? "edit" : "create")) return

    if (!foodForm.restaurantId) {
      toast.error("Restaurant is required")
      return
    }
    if (!String(foodForm.categoryName || "").trim()) {
      toast.error("Please select or enter a category")
      return
    }
    if (!foodForm.name.trim()) {
      toast.error("Food name is required")
      return
    }


    const normalizedVariants = (Array.isArray(foodForm.variants) ? foodForm.variants : [])
      .map((variant) => ({
        id: String(variant?.id || variant?._id || "").trim(),
        name: String(variant?.name || "").trim(),
        price: Number(variant?.price),
      }))
      .filter((variant) => variant.id || variant.name || variant.price)

    const hasVariants = normalizedVariants.length > 0

    const selectedRestaurantObj = restaurantsForFilter.find(r => r.id === foodForm.restaurantId);
    if (selectedRestaurantObj) {
      const rType = selectedRestaurantObj.type;
      const fType = foodForm.foodType === "Veg" ? "Veg" : "Non-Veg";
      if (rType === "Veg" && fType === "Non-Veg") {
        toast.error("Non-Veg items cannot be added to a Veg restaurant.");
        return;
      }
      if (rType === "Non-Veg" && fType === "Veg") {
        toast.error("Veg items cannot be added to a Non-Veg restaurant.");
        return;
      }
    }

    const parsedPrice = Number(foodForm.price)

    if (normalizedVariants.some((variant) => !variant.name)) {
      toast.error("Each variant must have a name")
      return
    }

    if (normalizedVariants.some((variant) => !Number.isFinite(variant.price) || variant.price <= 0)) {
      toast.error("Each variant price must be greater than 0")
      return
    }

    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Base price must be greater than 0")
      return
    }

    try {
      setSubmittingFood(true)
      let imageUrl = foodForm.image.trim()

      if (selectedImageFile) {
        const uploadResponse = await uploadAPI.uploadMedia(selectedImageFile, {
          folder: "foods",
        })
        imageUrl =
          uploadResponse?.data?.data?.url ||
          uploadResponse?.data?.url ||
          imageUrl
      }

      const payload = {
        restaurantId: foodForm.restaurantId || undefined,
        categoryId: foodForm.categoryId || undefined,
        categoryName: String(foodForm.categoryName || "").trim(),
        zoneId: foodForm.zoneId === "global" ? undefined : (foodForm.zoneId || undefined),
        name: foodForm.name.trim(),
        price: parsedPrice > 0 ? parsedPrice : undefined,
        variants: normalizedVariants.map((variant) => ({
          ...(variant.id && !variant.id.startsWith("variant-") ? { _id: variant.id } : {}),
          name: variant.name,
          price: variant.price,
        })),
        description: foodForm.description.trim(),
        image: imageUrl,
        foodType: foodForm.foodType === "Veg" ? "Veg" : "Non-Veg",
        isAvailable: foodForm.isAvailable !== false,
        preparationTime: String(foodForm.preparationTime || "").trim(),
        quantity: foodForm.quantity !== "" ? Number(foodForm.quantity) : 0,
      }

      if (foodFormMode === "edit") {
        await adminAPI.updateFood(editingFood?._id || editingFood?.id, payload)
      } else {
        lastSelectedCategoryForAdd = payload.categoryId || ""
        lastSelectedCategoryNameForAdd = payload.categoryName || ""
        lastSelectedTimingForAdd = payload.preparationTime || ""
        await adminAPI.createFood(payload)
      }
      toast.success(foodFormMode === "edit" ? "Food updated successfully" : "Food added successfully")
      setShowFoodFormModal(false)
      setEditingFood(null)
      setFoodForm(createFoodForm())
      setSelectedImageFile(null)
      setImagePreviewUrl("")
      await fetchAllFoods()
    } catch (error) {
      debugError("Error saving food:", error)
      toast.error(error?.response?.data?.message || error?.response?.data?.error || "Failed to save food")
    } finally {
      setSubmittingFood(false)
    }
  }

  const handleDelete = async (id) => {
    if (!ensureActionAccess("delete")) return
    const food = foods.find(f => f.id === id)
    if (!food) return

    if (!window.confirm(`Are you sure you want to delete "${food.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      setDeleting(true)
      await adminAPI.deleteFood(food?._id || food?.id)
      await fetchAllFoods()
      toast.success("Food item deleted successfully")
    } catch (error) {
      debugError("Error deleting food:", error)
      toast.error(error?.response?.data?.message || "Failed to delete food item")
    } finally {
      setDeleting(false)
    }
  }

  const handleViewDetails = (food) => {
    setSelectedFood(food)
    setShowDetailModal(true)
  }

  return (
    <div className="p-2.5 sm:p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('/admin/food')}
            className="p-1.5 rounded-full hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-900 flex items-center justify-center shrink-0 border border-slate-200"
            title="Back to Dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Food</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">Food List</h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {totalFoods}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(true)}
                className="px-4 py-2.5 rounded-lg bg-[#F84E04] text-white text-sm font-medium hover:bg-[#D94203] transition-colors inline-flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete {selectedIds.length} Items</span>
              </button>
            )}
            <button
              type="button"
              onClick={openAddFoodModal}
              className="px-4 py-2.5 rounded-lg bg-[#F84E04] text-white text-sm font-medium hover:bg-[#D94203] transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Add Food</span>
            </button>
            <Popover open={isCategoryDropdownOpen} onOpenChange={setIsCategoryDropdownOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-4 py-2.5 text-sm rounded-lg border border-transparent bg-[#F84E04] text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#F84E04]/50 min-w-[150px] cursor-pointer hover:bg-[#D94203] transition-all flex items-center justify-between gap-2"
                >
                  <span className="truncate max-w-[140px]">
                    {selectedCategory === "all" ? "All Categories" : filterCategories.find(c => String(c.id) === String(selectedCategory))?.name || "All Categories"}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search category..."
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F84E04] focus:ring-1 focus:ring-[#F84E04] dark:bg-slate-900 dark:border-slate-700 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  <button
                    onClick={() => {
                      setSelectedCategory("all")
                      setCurrentPage(1)
                      setIsCategoryDropdownOpen(false)
                      setCategorySearchQuery("")
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors ${selectedCategory === "all" ? "bg-orange-50 text-[#F84E04] font-medium dark:bg-orange-900/20" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  >
                    All Categories
                  </button>
                  {filterCategories
                    .filter(cat => cat.name?.toLowerCase().includes(categorySearchQuery.toLowerCase()))
                    .map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          setSelectedCategory(cat.id)
                          setCurrentPage(1)
                          setIsCategoryDropdownOpen(false)
                          setCategorySearchQuery("")
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors truncate ${selectedCategory === cat.id ? "bg-orange-50 text-[#F84E04] font-medium dark:bg-orange-900/20" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                      >
                        {cat.name}
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>

            <Popover open={isRestaurantDropdownOpen} onOpenChange={setIsRestaurantDropdownOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="px-4 py-2.5 text-sm rounded-lg border border-transparent bg-[#F84E04] text-white font-medium focus:outline-none focus:ring-2 focus:ring-[#F84E04]/50 min-w-[150px] cursor-pointer hover:bg-[#D94203] transition-all flex items-center justify-between gap-2"
                >
                  <span className="truncate max-w-[140px]">
                    {selectedRestaurant === "all" ? "All Restaurants" : restaurantsForFilter.find(r => String(r.id) === String(selectedRestaurant))?.name || "All Restaurants"}
                  </span>
                  <ChevronDown className="w-4 h-4 shrink-0 text-white" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[240px] p-0" align="start">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search restaurant..."
                      value={restaurantSearchQuery}
                      onChange={(e) => setRestaurantSearchQuery(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#F84E04] focus:ring-1 focus:ring-[#F84E04] dark:bg-slate-900 dark:border-slate-700 dark:text-white placeholder:text-slate-400"
                    />
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-1">
                  <button
                    onClick={() => {
                      setSelectedRestaurant("all")
                      setCurrentPage(1)
                      setIsRestaurantDropdownOpen(false)
                      setRestaurantSearchQuery("")
                    }}
                    className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors ${selectedRestaurant === "all" ? "bg-orange-50 text-[#F84E04] font-medium dark:bg-orange-900/20" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                  >
                    All Restaurants
                  </button>
                  {restaurantsForFilter
                    .filter(r => r.name?.toLowerCase().includes(restaurantSearchQuery.toLowerCase()))
                    .map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setSelectedRestaurant(r.id)
                          setCurrentPage(1)
                          setIsRestaurantDropdownOpen(false)
                          setRestaurantSearchQuery("")
                        }}
                        className={`w-full text-left px-3 py-2.5 text-sm rounded-md transition-colors truncate ${selectedRestaurant === r.id ? "bg-orange-50 text-[#F84E04] font-medium dark:bg-orange-900/20" : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
                      >
                        {r.name}
                      </button>
                    ))}
                </div>
              </PopoverContent>
            </Popover>
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <input
                type="text"
                placeholder="Ex : Foods"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left">
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    ref={input => {
                      if (input) input.indeterminate = isSomeVisibleSelected;
                    }}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 text-[#F84E04] focus:ring-[#F84E04]"
                  />
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  SL
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Price
                </th>

                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Zone
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Restaurant
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-2" />
                      <p className="text-sm text-slate-500">Loading foods...</p>
                    </div>
                  </td>
                </tr>
              ) : foods.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                      <p className="text-sm text-slate-500">No food items match your search or restaurant filter</p>
                    </div>
                  </td>
                </tr>
              ) : (
                foods.map((food, index) => (
                  <tr
                    key={food.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(String(food.id))}
                        onChange={(e) => handleSelectOne(e, food.id)}
                        className="w-4 h-4 rounded border-slate-300 text-[#F84E04] focus:ring-[#F84E04]"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{(currentPage - 1) * pageSize + index + 1}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        <img
                          src={withImageVersion(food.image)}
                          alt={food.name}
                          className="w-full h-full object-cover"
                          key={`${food.id}-${imageVersion}`}
                          loading="lazy"
                          onError={(e) => { e.target.src = typeof ADMIN_FALLBACK_IMAGE !== "undefined" ? ADMIN_FALLBACK_IMAGE : (typeof FOOD_FALLBACK_IMAGE !== "undefined" ? FOOD_FALLBACK_IMAGE : typeof FALLBACK_IMAGE !== "undefined" ? FALLBACK_IMAGE : "") }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">{food.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900">₹{getFoodDisplayPrice(food)}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">{food.categoryName || "-"}</span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                          {zones.find(z => String(z._id || z.id) === String(food.zoneId))?.name || "Global"}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-800">{food.quantity || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">{food.restaurantName || "-"}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleViewDetails(food)}
                          className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEditFoodModal(food)}
                          className="p-1.5 rounded text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(food.id)}
                          disabled={deleting}
                          className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Delete"
                        >
                          {deleting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && totalFoods > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <div className="text-sm text-slate-600">
              Showing{" "}
              <span className="font-semibold text-slate-800">{(currentPage - 1) * pageSize + 1}</span>
              {" "}to{" "}
              <span className="font-semibold text-slate-800">
                {Math.min((currentPage - 1) * pageSize + foods.length, totalFoods)}
              </span>
              {" "}of{" "}
              <span className="font-semibold text-slate-800">{totalFoods}</span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2.5 py-1.5 text-sm rounded-md border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>

              <span className="px-3 py-1.5 text-sm font-medium text-slate-700">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="w-[95vw] sm:max-w-xl p-0 overflow-hidden dark:bg-slate-900 dark:border-slate-800 rounded-2xl">
          <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800">
            <DialogTitle className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Food Details</DialogTitle>
          </DialogHeader>
          {selectedFood && (
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center gap-4">
                <img
                  src={withImageVersion(selectedFood.image)}
                  alt={selectedFood.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-800 shrink-0"
                  onError={(e) => { e.target.src = typeof ADMIN_FALLBACK_IMAGE !== "undefined" ? ADMIN_FALLBACK_IMAGE : (typeof FOOD_FALLBACK_IMAGE !== "undefined" ? FOOD_FALLBACK_IMAGE : typeof FALLBACK_IMAGE !== "undefined" ? FALLBACK_IMAGE : "") }}
                />
                <div className="min-w-0">
                  <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white truncate">{selectedFood.name}</p>
                  <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">ID #{formatFoodId(selectedFood.id)}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg p-3 sm:p-4 dark:bg-slate-800 dark:border-slate-700">
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Price:</span> <span className="text-slate-900 dark:text-white">{selectedFood.variants?.length ? `Starting from \u20B9${selectedFood.price}` : `\u20B9${selectedFood.price}`}</span></p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Category:</span> <span className="text-slate-900 dark:text-white">{selectedFood.categoryName || "-"}</span></p>
                <p><span className="font-semibold text-slate-700 dark:text-slate-300">Food Type:</span> <span className="text-slate-900 dark:text-white">{selectedFood.foodType || "-"}</span></p>
              </div>
              {selectedFood.variants?.length ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4 dark:bg-slate-800 dark:border-slate-700">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white mb-2">Variants</p>
                  <div className="space-y-2">
                    {selectedFood.variants.map((variant) => (
                      <div key={variant.id || variant._id} className="flex items-center justify-between text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        <span>{variant.name}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{"\u20B9"}{variant.price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {selectedFood.description && (
                <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                  <span className="font-semibold text-slate-800 dark:text-white">Description:</span> {selectedFood.description}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFoodFormModal}
        onOpenChange={(open) => {
          setShowFoodFormModal(open)
          if (!open) {
            setEditingFood(null)
            setFoodForm(createFoodForm())
            setCategoryOptions([])
            setCategorySearch("")
            setCategoryPopoverOpen(false)
            setSelectedImageFile(null)
            setImagePreviewUrl("")
          }
        }}
      >
        <DialogContent className="w-[95vw] sm:max-w-2xl p-0 overflow-hidden dark:bg-slate-900 dark:border-slate-800 rounded-2xl max-h-[92vh] flex flex-col">
          <DialogHeader className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 bg-slate-50 dark:bg-slate-900/50 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">
              {foodFormMode === "edit" ? "Edit Food" : "Add Food"}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Restaurant *</label>
                <select
                  value={foodForm.restaurantId}
                  onChange={(e) => setFoodForm((prev) => ({ ...prev, restaurantId: e.target.value, categoryId: "", categoryName: "" }))}
                  disabled={foodFormMode === "edit"}
                  className="w-full px-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:bg-slate-100 dark:disabled:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
                >
                  <option value="">Select restaurant</option>
                  {restaurantOptions.map(({ id, name, type }) => (
                    <option key={id} value={id}>
                      {name}{type ? ` (${type})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Category</label>
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white text-left flex items-center justify-between dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    >
                      <span className={foodForm.categoryName ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500"}>
                        {foodForm.categoryName || "Select category"}
                      </span>
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 dark:bg-slate-900 dark:border-slate-800" align="start">
                    <input
                      type="text"
                      value={categorySearch}
                      onChange={(e) => setCategorySearch(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-md text-sm bg-white mb-2 dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      placeholder="Search category..."
                      autoFocus
                    />
                    <div className="max-h-56 overflow-y-auto">
                      {categoryOptions
                        .filter((c) => {
                          const q = String(categorySearch || "").trim().toLowerCase()
                          if (!q) return true
                          return String(c.name || "").toLowerCase().includes(q)
                        })
                        .map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFoodForm((prev) => ({ ...prev, categoryId: c.id, categoryName: c.name }))
                              setCategoryPopoverOpen(false)
                            }}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white ${String(foodForm.categoryName || "") === String(c.name) ? "bg-slate-100 dark:bg-slate-800 font-medium" : ""
                              }`}
                          >
                            {c.name}
                          </button>
                        ))}
                      {categoryOptions.length === 0 && (
                        <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">No categories found</div>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Food Name</label>
                <input
                  type="text"
                  value={foodForm.name}
                  onChange={(e) => setFoodForm((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Base Price</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={foodForm.price}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (val !== "" && Number(val) < 0) val = "0";
                    setFoodForm((prev) => ({ ...prev, price: val }));
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
                {(foodForm.variants || []).length > 0 ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Base price of the item itself. Customers will see "Starting from" the lowest price among variants and base price.</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Food Type</label>
                <select
                  value={foodForm.foodType}
                  onChange={(e) => setFoodForm((prev) => ({ ...prev, foodType: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                >
                  <option value="Veg">Veg</option>
                  <option value="Non-Veg">Non-Veg</option>
                </select>
              </div>
              <ImageUploadField
                value={selectedImageFile || imagePreviewUrl || foodForm.image}
                onChange={(file) => {
                  setSelectedImageFile(file)
                  if (file) {
                    setImagePreviewUrl(URL.createObjectURL(file))
                  } else {
                    setImagePreviewUrl(foodForm.image.trim())
                  }
                }}
                onClear={() => {
                  setSelectedImageFile(null)
                  setImagePreviewUrl(foodForm.image.trim())
                }}
                aspectRatio={1.7777777777777777}
                label="Upload Image (16:9)"
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Timing</label>
                <div className="relative">
                  <select
                    value={foodForm.preparationTime}
                    onChange={(e) => setFoodForm((prev) => ({ ...prev, preparationTime: e.target.value }))}
                    className="w-full px-3 py-2.5 pr-10 border border-slate-300 rounded-lg text-sm bg-white appearance-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                  >
                    <option value="">Select timing</option>
                    <option value="10-20 mins">10-20 mins</option>
                    <option value="20-25 mins">20-25 mins</option>
                    <option value="25-35 mins">25-35 mins</option>
                    <option value="35-45 mins">35-45 mins</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="Ex: 100"
                  value={foodForm.quantity}
                  onKeyDown={(e) => {
                    if (
                      !/^[0-9]$/.test(e.key) &&
                      !["Backspace", "ArrowLeft", "ArrowRight", "Delete", "Tab"].includes(e.key)
                    ) {
                      e.preventDefault();
                    }
                  }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setFoodForm((prev) => ({ ...prev, quantity: val }));
                  }}
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                />
              </div>
              <div className="flex items-center gap-6 pt-7">
                <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={foodForm.isAvailable}
                    onChange={(e) => setFoodForm((prev) => ({ ...prev, isAvailable: e.target.checked }))}
                  />
                  Available
                </label>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
              <textarea
                rows={4}
                value={foodForm.description}
                onChange={(e) => setFoodForm((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm bg-white resize-none dark:bg-slate-800 dark:border-slate-700 dark:text-white"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 dark:bg-slate-900/50 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">Variants</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Optional. Add multiple names and prices such as Half, Full, Small, or Large.</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddVariant}
                  className="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 hover:bg-sky-50 dark:bg-slate-800 dark:border-slate-700 dark:text-sky-400 dark:hover:bg-slate-700"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add variant
                </button>
              </div>
              {(foodForm.variants || []).length ? (
                <div className="space-y-3">
                  {(foodForm.variants || []).map((variant, index) => (
                    <div key={variant.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:bg-slate-800 dark:border-slate-700">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Variant name</label>
                          <input
                            type="text"
                            value={variant.name}
                            onChange={(e) => handleVariantChange(variant.id, "name", e.target.value)}
                            placeholder={index === 0 ? "Full" : "Half"}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Variant price</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={variant.price}
                            onChange={(e) => {
                              let val = e.target.value;
                              if (val !== "" && Number(val) < 0) val = "0";
                              handleVariantChange(variant.id, "price", val);
                            }}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white dark:bg-slate-900 dark:border-slate-800 dark:text-white"
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(variant.id)}
                        className="self-start rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-slate-700"
                        aria-label="Remove variant"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 dark:text-slate-400">No variants added. This food will use the single base price.</p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleFoodFormSubmit}
                disabled={submittingFood}
                className="px-4 py-2.5 rounded-lg bg-[#F84E04] text-white text-sm font-medium hover:bg-[#D94203] transition-colors disabled:opacity-60 inline-flex items-center gap-2"
              >
                {submittingFood ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                <span>{submittingFood ? "Saving..." : foodFormMode === "edit" ? "Update Food" : "Add Food"}</span>
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkDeleteModal} onOpenChange={setShowBulkDeleteModal}>
        <DialogContent className="sm:max-w-[400px] p-6">
          <DialogHeader>
            <DialogTitle>Confirm Bulk Delete</DialogTitle>
          </DialogHeader>
          <div className="py-2 pr-6">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete {selectedIds.length} selected item(s)? This action cannot be undone.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowBulkDeleteModal(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#F84E04] hover:bg-[#D94203] rounded-lg transition-colors inline-flex items-center gap-2"
            >
              {isBulkDeleting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isBulkDeleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
