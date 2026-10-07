import { useState, useEffect, useRef, useMemo } from "react"
import { Upload, Trash2, Image as ImageIcon, Loader2, AlertCircle, CheckCircle2, ArrowUp, ArrowDown, Layout, Tag, UtensilsCrossed, ChefHat, Megaphone, Search, ChevronDown, Check, X } from "lucide-react"
import api from "@food/api"
import { adminAPI } from "@food/api"
import { getModuleToken } from "@food/utils/auth"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Button } from "@food/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@food/components/ui/dialog"
import { Checkbox } from "@food/components/ui/checkbox"

const ADMIN_FALLBACK_IMAGE = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpolyline points='21 15 16 10 5 21'/%3E%3C/svg%3E";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

/** Searchable combobox dropdown for selecting food category */
function SearchableCategorySelect({
  categories = [],
  value = "",
  onChange,
  placeholder = "-- Select Food Category --",
  className = "",
  disabled = false,
  allowClear = true,
  size = "md"
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  // Check if dropdown should flip upwards when opened, update on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        // If less than 270px below and enough space above, flip upwards
        if (spaceBelow < 270 && rect.top > 220) {
          setOpenUpward(true);
        } else {
          setOpenUpward(false);
        }
      }
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  const selectedCategory = useMemo(() => {
    return categories.find((c) => c.id === value || c.name === value);
  }, [categories, value]);

  const filtered = useMemo(() => {
    if (!query.trim()) return categories;
    const q = query.toLowerCase().trim();
    return categories.filter((c) =>
      c.name.toLowerCase().includes(q) || (c.slug && c.slug.toLowerCase().includes(q))
    );
  }, [categories, query]);

  const handleSelect = (catId) => {
    onChange?.(catId);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange?.("");
    setQuery("");
  };

  const isSmall = size === "sm";

  return (
    <div ref={containerRef} className={`relative ${className} ${isOpen ? "z-50" : ""}`}>
      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`flex items-center justify-between border rounded-lg bg-white cursor-pointer transition-all ${
          isSmall ? "h-8 px-2.5 text-xs" : "h-10 px-3 text-sm"
        } ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 shadow-sm"
            : "border-slate-300 hover:border-slate-400"
        } ${disabled ? "opacity-50 cursor-not-allowed bg-slate-50" : ""}`}
      >
        <div className="flex items-center gap-1.5 truncate flex-1 mr-1">
          {selectedCategory ? (
            <span className="font-semibold text-slate-800 truncate">
              {selectedCategory.name}
            </span>
          ) : (
            <span className="text-slate-400 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {allowClear && selectedCategory && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </div>
      </div>

      {/* Floating Dropdown List */}
      {isOpen && (
        <div
          className={`absolute z-[100] right-0 ${
            openUpward ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } bg-white border border-slate-200 rounded-lg shadow-2xl min-w-[230px] w-full`}
        >
          {/* Search Box */}
          <div className="p-2 border-b border-slate-100 bg-slate-50/80 rounded-t-lg">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search category..."
                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-md outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-800 placeholder:text-slate-400"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              />
              {query && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQuery("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div
            className="overflow-y-auto p-1 divide-y divide-slate-50"
            style={{
              maxHeight: "220px",
              overflowY: "auto",
              scrollbarWidth: "thin",
              scrollbarColor: "#cbd5e1 transparent",
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            {allowClear && (
              <button
                type="button"
                onClick={() => handleSelect("")}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between hover:bg-slate-100 text-slate-500 ${
                  !value ? "bg-blue-50/50 text-blue-600 font-medium" : ""
                }`}
              >
                <span>-- No Category (None) --</span>
                {!value && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            )}

            {filtered.length > 0 ? (
              filtered.map((cat) => {
                const isSelected = cat.id === value || cat.name === value;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className={`w-full text-left px-2.5 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <span className="truncate">{cat.name}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                  </button>
                );
              })
            ) : (
              <div className="py-3 px-2 text-center text-xs text-slate-400">
                No category found for "{query}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function LandingPageManagement() {
  const [activeTab, setActiveTab] = useState('top-banners')
  const [exploreMoreSubTab, setExploreMoreSubTab] = useState('icons')


  // Top Banners
  const [topBanners, setTopBanners] = useState([])
  const [topBannersLoading, setTopBannersLoading] = useState(true)
  const [topBannersUploading, setTopBannersUploading] = useState(false)
  const [topBannersUploadProgress, setTopBannersUploadProgress] = useState({ current: 0, total: 0 })
  const [topBannersDeleting, setTopBannersDeleting] = useState(null)
  const topBannersFileInputRef = useRef(null)

  // Food Catalog Categories for Banner Redirection
  const [foodCategories, setFoodCategories] = useState([])
  const [selectedCategoryForUpload, setSelectedCategoryForUpload] = useState("")
  const [updatingBannerCategory, setUpdatingBannerCategory] = useState(null)

  // Hero Banners
  const [banners, setBanners] = useState([])
  const [bannersLoading, setBannersLoading] = useState(true)
  const [bannersUploading, setBannersUploading] = useState(false)
  const [bannersUploadProgress, setBannersUploadProgress] = useState({ current: 0, total: 0 })
  const [bannersDeleting, setBannersDeleting] = useState(null)
  const bannersFileInputRef = useRef(null)

  // Categories
  const [categories, setCategories] = useState([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [categoriesUploading, setCategoriesUploading] = useState(false)
  const [categoriesDeleting, setCategoriesDeleting] = useState(null)
  const [pendingCategories, setPendingCategories] = useState([]) // {id, file, label, previewUrl}
  const categoriesFileInputRef = useRef(null)

  // Explore More
  const [exploreMore, setExploreMore] = useState([])
  const [exploreMoreLoading, setExploreMoreLoading] = useState(true)
  const [exploreMoreUploading, setExploreMoreUploading] = useState(false)
  const [exploreMoreDeleting, setExploreMoreDeleting] = useState(null)
  const [exploreMoreLabel, setExploreMoreLabel] = useState("")
  const [exploreMoreLink, setExploreMoreLink] = useState("")
  const [exploreIconsUploading, setExploreIconsUploading] = useState({})
  const exploreMoreFileInputRef = useRef(null)

  // Switch 99 Banners
  const [under250Banners, setUnder250Banners] = useState([])
  const [under250BannersLoading, setUnder250BannersLoading] = useState(true)
  const [under250BannersUploading, setUnder250BannersUploading] = useState(false)
  const [under250BannersUploadProgress, setUnder250BannersUploadProgress] = useState({ current: 0, total: 0 })
  const [under250BannersDeleting, setUnder250BannersDeleting] = useState(null)
  const under250BannersFileInputRef = useRef(null)

  // Dining Banners replaced by Accessories Banners
  const [accessoriesBanners, setAccessoriesBanners] = useState([])
  const [accessoriesBannersLoading, setAccessoriesBannersLoading] = useState(true)
  const [accessoriesBannersUploading, setAccessoriesBannersUploading] = useState(false)
  const [accessoriesBannersUploadProgress, setAccessoriesBannersUploadProgress] = useState({ current: 0, total: 0 })
  const [accessoriesBannersDeleting, setAccessoriesBannersDeleting] = useState(null)
  const accessoriesBannersFileInputRef = useRef(null)

  // Settings
  const [settings, setSettings] = useState({ 
    exploreMoreHeading: "Explore More", 
    recommendedRestaurantIds: [],
    festBannerVideoUrl: "",
    festBannerVideoPublicId: ""
  })
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [videoUploading, setVideoUploading] = useState(false)
  const videoFileInputRef = useRef(null)
  const [recommendedSearchQuery, setRecommendedSearchQuery] = useState("")

  const [allRestaurants, setAllRestaurants] = useState([])
  const [restaurantsLoading, setRestaurantsLoading] = useState(false)

  // Gourmet Restaurants
  const [gourmetRestaurants, setGourmetRestaurants] = useState([])
  const [gourmetLoading, setGourmetLoading] = useState(true)
  const [gourmetDeleting, setGourmetDeleting] = useState(null)
  const [selectedRestaurantGourmet, setSelectedRestaurantGourmet] = useState("")

  // Common
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // Restaurant Selection Modal for Banner Advertising
  const [showRestaurantModal, setShowRestaurantModal] = useState(false)
  const [selectedBannerId, setSelectedBannerId] = useState(null)
  const [selectedRestaurantIds, setSelectedRestaurantIds] = useState([])
  const [restaurantSearchQuery, setRestaurantSearchQuery] = useState("")
  const [linkingRestaurants, setLinkingRestaurants] = useState(false)

  // Helper function to filter out token-related errors
  const setErrorSafely = (errorMessage) => {
    if (!errorMessage) {
      setError(null)
      return
    }
    const lowerMessage = errorMessage.toLowerCase()
    // Don't show token/unauthorized/auth errors
    if (lowerMessage.includes('token') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('no token') ||
      lowerMessage.includes('authentication') ||
      lowerMessage.includes('session expired') ||
      lowerMessage.includes('insufficient permissions for this action')) {
      setError(null)
    } else {
      setError(errorMessage)
    }
  }

  // Helper function to get admin token and add to request config
  const getAuthConfig = (additionalConfig = {}) => {
    const adminToken = getModuleToken('admin')

    // Debug logging in development
    if (import.meta.env.DEV) {
      debugLog('[LandingPageManagement] Token check:', {
        token: adminToken ? 'exists' : 'missing',
        tokenLength: adminToken?.length || 0,
        path: window.location.pathname
      })
    }

    if (!adminToken || adminToken.trim() === '' || adminToken === 'null' || adminToken === 'undefined') {
      // Token not found, return config without auth header (will be handled by error)
      debugWarn('[LandingPageManagement] Admin token not found!')
      return additionalConfig
    }

    // Merge headers properly - ensure Authorization is always set
    const mergedHeaders = {
      ...additionalConfig.headers,
      Authorization: `Bearer ${adminToken.trim()}`,
    }

    return {
      ...additionalConfig,
      headers: mergedHeaders,
    }
  }

  // Fetch data on mount (authentication is handled by ProtectedRoute)
  useEffect(() => {
    fetchTopBanners()
    fetchBanners()
    fetchUnder250Banners()
    fetchAccessoriesBanners()
    fetchSettings()
    fetchFoodCategories()
  }, [])

  // Fetch food categories from catalog for linking banners to categories
  const fetchFoodCategories = async () => {
    try {
      const res = await adminAPI.getCategories({ limit: 1000 })
      const list = res?.data?.data?.categories || res?.data?.data || []
      if (Array.isArray(list)) {
        setFoodCategories(
          list
            .filter((c) => c && c.name)
            .map((c) => ({
              id: String(c._id || c.id),
              name: String(c.name).trim(),
              slug: c.slug || String(c.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      }
    } catch (err) {
      debugError("Error fetching food categories:", err)
    }
  }

  // Update category of an existing banner
  const handleBannerCategoryChange = async (bannerId, newCategoryId, type = 'hero') => {
    try {
      setUpdatingBannerCategory(bannerId)
      const found = foodCategories.find(c => c.id === newCategoryId)
      const payload = {
        categoryId: newCategoryId || null,
        categoryName: found ? found.name : '',
        categorySlug: found ? found.slug : ''
      }
      const endpoint = type === 'hero' ? `/food/hero-banners/${bannerId}/category` : `/food/top-banners/${bannerId}/category`
      const res = await api.patch(endpoint, payload, getAuthConfig())
      if (res.data.success) {
        setSuccess('Banner category updated successfully!')
        setTimeout(() => setSuccess(null), 4000)
        if (type === 'hero') {
          await fetchBanners()
        } else {
          await fetchTopBanners()
        }
      }
    } catch (err) {
      setErrorSafely(err.response?.data?.message || 'Failed to update banner category')
    } finally {
      setUpdatingBannerCategory(null)
    }
  }

  // ==================== TOP BANNERS ====================
  const fetchTopBanners = async () => {
    try {
      setTopBannersLoading(true)
      setError(null)
      const response = await api.get('/food/top-banners', getAuthConfig())
      if (response.data.success) {
        setTopBanners(response.data.data.banners || [])
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setTopBanners([])
        setError(null)
      } else if (err.response?.status === 404) {
        setTopBanners([])
        setError(null)
      } else {
        setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to load top banners')
      }
    } finally {
      setTopBannersLoading(false)
    }
  }

  const handleTopBannerFileSelect = (e) => {
    const files = Array.from(e.target?.files || e.files || [])
    if (files.length === 0) return
    if (files.length > 5) {
      setError('You can upload a maximum of 5 images at once')
      return
    }
    uploadTopBanners(files)
  }

  const uploadTopBanners = async (files) => {
    try {
      const adminToken = getModuleToken('admin')
      if (!adminToken || adminToken.trim() === '' || adminToken === 'null' || adminToken === 'undefined') {
        setErrorSafely('Authentication required. Please login again.')
        return
      }

      setTopBannersUploading(true)
      setError(null)
      setSuccess(null)
      setTopBannersUploadProgress({ current: 0, total: files.length })

      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      if (selectedCategoryForUpload) {
        const found = foodCategories.find(c => c.id === selectedCategoryForUpload || c.name === selectedCategoryForUpload)
        if (found) {
          formData.append('categoryId', found.id)
          formData.append('categoryName', found.name)
          formData.append('categorySlug', found.slug)
        }
      }

      const config = getAuthConfig()
      const response = await api.post('/food/top-banners/multiple', formData, config)

      if (response.data.success) {
        const uploadedBanners = response.data.data?.banners || []
        const errors = response.data.data?.errors || []
        const successCount = uploadedBanners.length
        const failCount = errors.length

        setSelectedCategoryForUpload('')
        await fetchTopBanners()
        if (topBannersFileInputRef.current) topBannersFileInputRef.current.value = ''

        if (failCount === 0) {
          setSuccess(`${successCount} top banner${successCount > 1 ? 's' : ''} uploaded successfully!`)
          setTimeout(() => setSuccess(null), 5000)
        } else if (successCount > 0) {
          setSuccess(`${successCount} banner${successCount > 1 ? 's' : ''} uploaded, ${failCount} failed.`)
          setErrorSafely(errors.join(', '))
          setTimeout(() => { setSuccess(null); setError(null) }, 5000)
        } else {
          setErrorSafely(`Failed to upload banners. ${errors.join(', ')}`)
        }
      } else {
        setErrorSafely(response.data.message || 'Failed to upload banners')
      }

      setTopBannersUploadProgress({ current: 0, total: 0 })
    } catch (err) {
      if (err.response?.status === 401 || err.message === 'Authentication token not found') {
        setError(null)
      } else {
        setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to upload banners')
      }
      setTopBannersUploadProgress({ current: 0, total: 0 })
    } finally {
      setTopBannersUploading(false)
    }
  }

  const handleDeleteTopBanner = async (id) => {
    if (!window.confirm('Are you sure you want to delete this top banner?')) return
    try {
      setTopBannersDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/top-banners/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Top banner deleted successfully!')
        await fetchTopBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to delete banner.')
    } finally {
      setTopBannersDeleting(null)
    }
  }

  const handleToggleTopBannerStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/top-banners/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Banner ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchTopBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update banner status.')
    }
  }

  const handleTopBannerOrderChange = async (id, direction) => {
    const banner = topBanners.find(b => b._id === id)
    if (!banner) return
    const newOrder = direction === 'up' ? banner.order - 1 : banner.order + 1
    const otherBanner = topBanners.find(b => b.order === newOrder && b._id !== id)
    if (!otherBanner && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/top-banners/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherBanner) {
        await api.patch(`/food/top-banners/${otherBanner._id}/order`, { order: banner.order }, getAuthConfig())
      }
      await fetchTopBanners()
    } catch (err) {
      setErrorSafely('Failed to update banner order.')
    }
  }

  // ==================== HERO BANNERS ====================
  const fetchBanners = async () => {
    try {
      setBannersLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners', getAuthConfig())
      if (response.data.success) {
        setBanners(response.data.data.banners || [])
      }
    } catch (err) {
      // Handle 401/404 errors gracefully - don't show error messages
      if (err.response?.status === 401) {
        // Token expired or invalid - will be handled by axios interceptor
        // Don't show error message or set banners
        setBanners([])
        setError(null)
      } else if (err.response?.status === 404) {
        // Endpoint doesn't exist, set empty array
        setBanners([])
        setError(null)
      } else {
        // Filter out token-related errors
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load hero banners'
        setErrorSafely(errorMessage)
      }
    } finally {
      setBannersLoading(false)
    }
  }

  const handleBannerFileSelect = (e) => {
    const files = Array.from(e.target?.files || e.files || [])
    if (files.length === 0) return
    if (files.length > 5) {
      setError('You can upload a maximum of 5 images at once')
      return
    }
    uploadBanners(files)
  }

  const uploadBanners = async (files) => {
    try {
      // Check token first before proceeding
      const adminToken = getModuleToken('admin')
      if (!adminToken || adminToken.trim() === '' || adminToken === 'null' || adminToken === 'undefined') {
        setErrorSafely('Authentication required. Please login again.')
        return
      }

      setBannersUploading(true)
      setError(null)
      setSuccess(null)
      setBannersUploadProgress({ current: 0, total: files.length })

      // Use batch upload endpoint for multiple files
      const formData = new FormData()
      files.forEach((file) => {
        // Backend expects field name "files" (upload.array('files'))
        formData.append('files', file)
      })

      if (selectedCategoryForUpload) {
        const found = foodCategories.find(c => c.id === selectedCategoryForUpload || c.name === selectedCategoryForUpload)
        if (found) {
          formData.append('categoryId', found.id)
          formData.append('categoryName', found.name)
          formData.append('categorySlug', found.slug)
        }
      }

      // Use getAuthConfig to ensure proper Authorization header
      // Don't set Content-Type - axios will set it automatically with boundary for FormData
      const config = getAuthConfig()

      // Debug: Log the config to verify Authorization header is set
      if (import.meta.env.DEV) {
        debugLog('[uploadBanners] Request config:', {
          hasAuthHeader: !!config.headers?.Authorization,
          authHeaderPrefix: config.headers?.Authorization?.substring(0, 20),
          hasFormData: formData instanceof FormData
        })
      }

      const response = await api.post('/food/hero-banners/multiple', formData, config)

      if (response.data.success) {
        const uploadedBanners = response.data.data?.banners || []
        const errors = response.data.data?.errors || []
        const successCount = uploadedBanners.length
        const failCount = errors.length

        setSelectedCategoryForUpload('')
        await fetchBanners()
        if (bannersFileInputRef.current) bannersFileInputRef.current.value = ''

        if (failCount === 0) {
          setSuccess(`${successCount} hero banner${successCount > 1 ? 's' : ''} uploaded successfully!`)
          setTimeout(() => setSuccess(null), 5000)
        } else if (successCount > 0) {
          setSuccess(`${successCount} banner${successCount > 1 ? 's' : ''} uploaded, ${failCount} failed.`)
          setErrorSafely(errors.join(', '))
          setTimeout(() => { setSuccess(null); setError(null) }, 5000)
        } else {
          setErrorSafely(`Failed to upload banners. ${errors.join(', ')}`)
        }
      } else {
        setErrorSafely(response.data.message || 'Failed to upload banners')
      }

      setBannersUploadProgress({ current: 0, total: 0 })
    } catch (err) {
      debugError('Error uploading banners:', err)

      // Handle 401 unauthorized errors - don't show token-related errors
      if (err.response?.status === 401 || err.message === 'Authentication token not found') {
        // Don't show error - let axios interceptor handle logout
        setError(null)
      } else {
        // Filter out token-related errors
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to upload banners'
        setErrorSafely(errorMessage)
      }

      setBannersUploadProgress({ current: 0, total: 0 })
    } finally {
      setBannersUploading(false)
    }
  }

  const handleDeleteBanner = async (id) => {
    if (!window.confirm('Are you sure you want to delete this hero banner?')) return
    try {
      setBannersDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/hero-banners/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Hero banner deleted successfully!')
        await fetchBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to delete banner.')
    } finally {
      setBannersDeleting(null)
    }
  }

  const handleToggleBannerStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/hero-banners/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Banner ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update banner status.')
    }
  }

  const handleBannerOrderChange = async (id, direction) => {
    const banner = banners.find(b => b._id === id)
    if (!banner) return
    const newOrder = direction === 'up' ? banner.order - 1 : banner.order + 1
    const otherBanner = banners.find(b => b.order === newOrder && b._id !== id)
    if (!otherBanner && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/hero-banners/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherBanner) {
        await api.patch(`/food/hero-banners/${otherBanner._id}/order`, { order: banner.order }, getAuthConfig())
      }
      await fetchBanners()
    } catch (err) {
      setErrorSafely('Failed to update banner order.')
    }
  }

  // Handle restaurant selection for banner advertising
  const handleLinkRestaurants = async () => {
    if (!selectedBannerId) return

    try {
      setLinkingRestaurants(true)
      setError(null)
      setSuccess(null)

      const response = await api.patch(
        `/food/hero-banners/${selectedBannerId}/link-restaurants`,
        { restaurantIds: selectedRestaurantIds },
        getAuthConfig()
      )

      if (response.data.success) {
        setSuccess('Restaurants linked to banner successfully!')
        setShowRestaurantModal(false)
        setSelectedBannerId(null)
        setSelectedRestaurantIds([])
        setRestaurantSearchQuery("")
        await fetchBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to link restaurants to banner.')
    } finally {
      setLinkingRestaurants(false)
    }
  }

  const toggleRestaurantSelection = (restaurantId) => {
    setSelectedRestaurantIds(prev => {
      if (prev.includes(restaurantId)) {
        return prev.filter(id => id !== restaurantId)
      } else {
        return [...prev, restaurantId]
      }
    })
  }

  const filteredRestaurantsForModal = allRestaurants.filter(restaurant => {
    if (!restaurantSearchQuery.trim()) return true
    const query = restaurantSearchQuery.toLowerCase()
    return restaurant.name?.toLowerCase().includes(query) ||
      restaurant.restaurantId?.toLowerCase().includes(query)
  })

  const filteredRestaurantsForRecommended = useMemo(() => {
    const query = recommendedSearchQuery.trim().toLowerCase()
    return allRestaurants
      .filter((restaurant) => {
        if (!query) return true
        return restaurant.name?.toLowerCase().includes(query) ||
          restaurant.restaurantId?.toLowerCase().includes(query)
      })
      .slice(0, 80)
  }, [allRestaurants, recommendedSearchQuery])

  const recommendedRestaurantsSelected = useMemo(() => {
    const selectedIds = new Set(settings.recommendedRestaurantIds || [])
    return allRestaurants.filter((restaurant) => selectedIds.has(restaurant._id))
  }, [allRestaurants, settings.recommendedRestaurantIds])

  const toggleRecommendedRestaurant = (restaurantId) => {
    setSettings((prev) => {
      const previousIds = Array.isArray(prev.recommendedRestaurantIds) ? prev.recommendedRestaurantIds : []
      const alreadySelected = previousIds.includes(restaurantId)
      return {
        ...prev,
        recommendedRestaurantIds: alreadySelected
          ? previousIds.filter((id) => id !== restaurantId)
          : [...previousIds, restaurantId],
      }
    })
  }

  // ==================== CATEGORIES ====================
  const fetchCategories = async () => {
    try {
      setCategoriesLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners/landing/categories', getAuthConfig())
      if (response.data.success) {
        setCategories(response.data.data.categories || [])
      }
    } catch (err) {
      // Silently handle 401/404 errors - endpoints may not exist yet
      if (err.response?.status === 401 || err.response?.status === 404) {
        setCategories([]) // Set empty array if endpoint doesn't exist
        setError(null) // Clear any previous error
      } else {
        // Filter out token-related errors
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load categories'
        setErrorSafely(errorMessage)
      }
    } finally {
      setCategoriesLoading(false)
    }
  }

  const handleCategoryFileSelect = (e) => {
    const files = Array.from(e.target?.files || e.files || [])
    if (!files.length) return

    const newItems = files
      .filter((file) => {
        if (!file.type.startsWith('image/')) {
          setError('Only image files are allowed for categories')
          return false
        }
        if (file.size > 5 * 1024 * 1024) {
          setError('Each image must be smaller than 5MB')
          return false
        }
        return true
      })
      .map((file, index) => {
        const baseName = file.name.replace(/\.[^/.]+$/, '')
        const prettyName = baseName.replace(/[-_]+/g, ' ').trim()
        return {
          id: `${Date.now()}-${index}`,
          file,
          label: prettyName || '',
          previewUrl: URL.createObjectURL(file),
        }
      })

    if (!newItems.length) return

    setPendingCategories((prev) => [...prev, ...newItems])
    // Reset input so same files can be selected again if needed
    if (categoriesFileInputRef.current) {
      categoriesFileInputRef.current.value = ''
    }
  }

  const handlePendingCategoryLabelChange = (id, newLabel) => {
    setPendingCategories((prev) =>
      prev.map((item) => (item.id === id ? { ...item, label: newLabel } : item))
    )
  }

  const handleRemovePendingCategory = (id) => {
    setPendingCategories((prev) => {
      const toRemove = prev.find((item) => item.id === id)
      if (toRemove?.previewUrl) {
        URL.revokeObjectURL(toRemove.previewUrl)
      }
      return prev.filter((item) => item.id !== id)
    })
  }

  const handleUploadPendingCategories = async () => {
    if (!pendingCategories.length) {
      setError('Add at least one category image before uploading')
      return
    }

    try {
      setCategoriesUploading(true)
      setError(null)
      setSuccess(null)

      let successCount = 0
      let failCount = 0
      const errors = []

      for (let i = 0; i < pendingCategories.length; i++) {
        const item = pendingCategories[i]
        if (!item.label.trim()) {
          failCount++
          errors.push(`Item ${i + 1}: label is required`)
          continue
        }

        const formData = new FormData()
        formData.append('image', item.file)
        formData.append('label', item.label.trim())

        try {
          const response = await api.post('/food/hero-banners/landing/categories', formData, getAuthConfig())
          if (response.data.success) {
            successCount++
          } else {
            failCount++
            errors.push(`Item ${i + 1}: upload failed`)
          }
        } catch (err) {
          failCount++
          errors.push(
            `Item ${i + 1}: ${err?.response?.data?.message || 'Failed to create category'}`
          )
        }
      }

      // Clean up previews
      pendingCategories.forEach((item) => {
        if (item.previewUrl) {
          URL.revokeObjectURL(item.previewUrl)
        }
      })
      setPendingCategories([])
      if (categoriesFileInputRef.current) categoriesFileInputRef.current.value = ''

      await fetchCategories()

      if (successCount > 0 && failCount === 0) {
        setSuccess(
          `${successCount} categor${successCount > 1 ? 'ies' : 'y'} created successfully!`
        )
        setTimeout(() => setSuccess(null), 4000)
      } else if (successCount > 0 && failCount > 0) {
        setSuccess(
          `${successCount} categor${successCount > 1 ? 'ies' : 'y'} created, ${failCount} failed.`
        )
        setError(errors.join(', '))
        setTimeout(() => {
          setSuccess(null)
          setError(null)
        }, 5000)
      } else {
        setErrorSafely(`Failed to create categories. ${errors.join(', ')}`)
      }
    } finally {
      setCategoriesUploading(false)
    }
  }

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return
    try {
      setCategoriesDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/hero-banners/landing/categories/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Category deleted successfully!')
        await fetchCategories()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to delete category.')
    } finally {
      setCategoriesDeleting(null)
    }
  }

  const handleToggleCategoryStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/hero-banners/landing/categories/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Category ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchCategories()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update category status.')
    }
  }

  const handleCategoryOrderChange = async (id, direction) => {
    const category = categories.find(c => c._id === id)
    if (!category) return
    const newOrder = direction === 'up' ? category.order - 1 : category.order + 1
    const otherCategory = categories.find(c => c.order === newOrder && c._id !== id)
    if (!otherCategory && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/hero-banners/landing/categories/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherCategory) {
        await api.patch(`/food/hero-banners/landing/categories/${otherCategory._id}/order`, { order: category.order }, getAuthConfig())
      }
      await fetchCategories()
    } catch (err) {
      setErrorSafely('Failed to update category order.')
    }
  }

  // ==================== EXPLORE MORE ====================
  const fetchExploreMore = async () => {
    try {
      setExploreMoreLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners/landing/explore-more', getAuthConfig())
      if (response.data.success) {
        setExploreMore(response.data.data.items || [])
      }
    } catch (err) {
      // Silently handle 401/404 errors - endpoints may not exist yet
      if (err.response?.status === 401 || err.response?.status === 404) {
        setExploreMore([]) // Set empty array if endpoint doesn't exist
        setError(null) // Clear any previous error
      } else {
        // Filter out token-related errors
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load explore more items'
        setErrorSafely(errorMessage)
      }
    } finally {
      setExploreMoreLoading(false)
    }
  }

  const handleExploreMoreFileSelect = async (e) => {
    const file = e.target?.files?.[0]
    if (!file) return
    if (!exploreMoreLabel.trim() || !exploreMoreLink.trim()) {
      setError('Please enter both label and link')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size exceeds 5MB')
      return
    }

    try {
      setExploreMoreUploading(true)
      setError(null)
      setSuccess(null)
      const formData = new FormData()
      formData.append('image', file)
      formData.append('label', exploreMoreLabel.trim())
      formData.append('link', exploreMoreLink.trim())
      const response = await api.post('/food/hero-banners/landing/explore-more', formData, getAuthConfig())
      if (response.data.success) {
        setSuccess('Explore more item created successfully!')
        setExploreMoreLabel("")
        setExploreMoreLink("")
        if (exploreMoreFileInputRef.current) exploreMoreFileInputRef.current.value = ''
        await fetchExploreMore()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to create explore more item.')
    } finally {
      setExploreMoreUploading(false)
    }
  }

  const handleDeleteExploreMore = async (id) => {
    if (!window.confirm('Are you sure you want to delete this explore more item?')) return
    try {
      setExploreMoreDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/hero-banners/landing/explore-more/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Explore more item deleted successfully!')
        await fetchExploreMore()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to delete explore more item.')
    } finally {
      setExploreMoreDeleting(null)
    }
  }

  const handleToggleExploreMoreStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/hero-banners/landing/explore-more/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Explore more item ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchExploreMore()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update explore more status.')
    }
  }



  const handleIconUpdate = async (file, label, link, itemId) => {
    if (!file) return

    // Find existing item by label
    const existingItem = exploreMore.find(item => item.label?.toLowerCase() === label.toLowerCase())

    // Create FormData
    const formData = new FormData()
    formData.append('image', file)

    try {
      setExploreIconsUploading(prev => ({ ...prev, [itemId]: true }))
      let res;

      if (existingItem) {
        // Update existing
        res = await api.patch(`/food/hero-banners/landing/explore-more/${existingItem._id}`, formData, getAuthConfig())
      } else {
        // Create new
        formData.append('label', label)
        formData.append('link', link)
        res = await api.post('/food/hero-banners/landing/explore-more', formData, getAuthConfig())
      }

      if (res.data?.success) {
        setSuccess(`${label} icon updated successfully!`)
        setTimeout(() => setSuccess(null), 3000)
        await fetchExploreMore()
      }
    } catch (err) {
      debugError('Upload failed', err)
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update icon')
    } finally {
      setExploreIconsUploading(prev => ({ ...prev, [itemId]: false }))
    }
  }

  const handleExploreMoreOrderChange = async (id, direction) => {
    const item = exploreMore.find(e => e._id === id)
    if (!item) return
    const newOrder = direction === 'up' ? item.order - 1 : item.order + 1
    const otherItem = exploreMore.find(e => e.order === newOrder && e._id !== id)
    if (!otherItem && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/hero-banners/landing/explore-more/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherItem) {
        await api.patch(`/food/hero-banners/landing/explore-more/${otherItem._id}/order`, { order: item.order }, getAuthConfig())
      }
      await fetchExploreMore()
    } catch (err) {
      setErrorSafely('Failed to update explore more order.')
    }
  }

  // ==================== Switch 99 BANNERS ====================
  const fetchUnder250Banners = async () => {
    try {
      setUnder250BannersLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners/under-250', getAuthConfig())
      if (response.data.success) {
        setUnder250Banners(response.data.data.banners || [])
      }
    } catch (err) {
      // Handle 401/404 errors gracefully - don't show error messages
      if (err.response?.status === 401) {
        setUnder250Banners([])
        setError(null)
      } else if (err.response?.status === 404) {
        setUnder250Banners([])
        setError(null)
      } else {
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load Switch 99 banners'
        setErrorSafely(errorMessage)
      }
    } finally {
      setUnder250BannersLoading(false)
    }
  }

  const handleUnder250BannerFileSelect = (e) => {
    const files = Array.from(e.target?.files || e.files || [])
    if (files.length === 0) return
    if (files.length > 5) {
      setError('You can upload a maximum of 5 images at once')
      return
    }
    uploadUnder250Banners(files)
  }

  const uploadUnder250Banners = async (files) => {
    try {
      // Check token first before proceeding
      const adminToken = getModuleToken('admin')
      if (!adminToken || adminToken.trim() === '' || adminToken === 'null' || adminToken === 'undefined') {
        setErrorSafely('Authentication required. Please login again.')
        return
      }

      setUnder250BannersUploading(true)
      setError(null)
      setSuccess(null)
      setUnder250BannersUploadProgress({ current: 0, total: files.length })

      const formData = new FormData()
      files.forEach((file) => {
        // Backend expects field name "files" (upload.array('files'))
        formData.append('files', file)
      })

      const response = await api.post('/food/hero-banners/under-250/multiple', formData, getAuthConfig())

      if (response.data.success) {
        setSuccess(`${response.data.data.banners?.length || files.length} Switch 99 banner(s) uploaded successfully!`)
        await fetchUnder250Banners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to upload Switch 99 banners'
      setErrorSafely(errorMessage)

      setUnder250BannersUploadProgress({ current: 0, total: 0 })
    } finally {
      setUnder250BannersUploading(false)
    }
  }

  const handleDeleteUnder250Banner = async (id) => {
    if (!window.confirm('Are you sure you want to delete this Switch 99 banner?')) return
    try {
      setUnder250BannersDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/hero-banners/under-250/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Switch 99 banner deleted successfully!')
        await fetchUnder250Banners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to delete banner.')
    } finally {
      setUnder250BannersDeleting(null)
    }
  }

  const handleToggleUnder250BannerStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/hero-banners/under-250/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Banner ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchUnder250Banners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update banner status.')
    }
  }

  const handleUnder250BannerOrderChange = async (id, direction) => {
    const banner = under250Banners.find(b => b._id === id)
    if (!banner) return
    const newOrder = direction === 'up' ? banner.order - 1 : banner.order + 1
    const otherBanner = under250Banners.find(b => b.order === newOrder && b._id !== id)
    if (!otherBanner && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/hero-banners/under-250/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherBanner) {
        await api.patch(`/food/hero-banners/under-250/${otherBanner._id}/order`, { order: banner.order }, getAuthConfig())
      }
      await fetchUnder250Banners()
    } catch (err) {
      setErrorSafely('Failed to update banner order.')
    }
  }

  // ==================== ACCESSORIES BANNERS ====================
  const fetchAccessoriesBanners = async () => {
    try {
      setAccessoriesBannersLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners/accessories', getAuthConfig())
      if (response.data.success) {
        setAccessoriesBanners(response.data.data.banners || [])
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setAccessoriesBanners([])
        setError(null)
      } else if (err.response?.status === 404) {
        setAccessoriesBanners([])
        setError(null)
      } else {
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load accessories banners'
        setErrorSafely(errorMessage)
      }
    } finally {
      setAccessoriesBannersLoading(false)
    }
  }

  const handleAccessoriesBannerFileSelect = (e) => {
    const files = Array.from(e.target?.files || e.files || [])
    if (files.length === 0) return
    if (files.length > 5) {
      setError('You can upload a maximum of 5 images at once')
      return
    }
    uploadAccessoriesBanners(files)
  }

  const uploadAccessoriesBanners = async (files) => {
    try {
      const adminToken = getModuleToken('admin')
      if (!adminToken || adminToken.trim() === '' || adminToken === 'null' || adminToken === 'undefined') {
        setErrorSafely('Authentication required. Please login again.')
        return
      }

      setAccessoriesBannersUploading(true)
      setError(null)
      setSuccess(null)
      setAccessoriesBannersUploadProgress({ current: 0, total: files.length })

      const formData = new FormData()
      files.forEach((file) => {
        formData.append('files', file)
      })

      const response = await api.post('/food/hero-banners/accessories/multiple', formData, getAuthConfig())

      if (response.data.success) {
        setSuccess(`${response.data.data.banners?.length || files.length} accessories banner(s) uploaded successfully!`)
        await fetchAccessoriesBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to upload accessories banners'
      setErrorSafely(errorMessage)
      setAccessoriesBannersUploadProgress({ current: 0, total: 0 })
    } finally {
      setAccessoriesBannersUploading(false)
    }
  }

  const handleDeleteAccessoriesBanner = async (id) => {
    if (!window.confirm('Are you sure you want to delete this accessories banner?')) return
    try {
      setAccessoriesBannersDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/hero-banners/accessories/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Accessories banner deleted successfully!')
        await fetchAccessoriesBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to delete banner.')
    } finally {
      setAccessoriesBannersDeleting(null)
    }
  }

  const handleToggleAccessoriesBannerStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/hero-banners/accessories/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Banner ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchAccessoriesBanners()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update banner status.')
    }
  }

  const handleAccessoriesBannerOrderChange = async (id, direction) => {
    const banner = accessoriesBanners.find(b => b._id === id)
    if (!banner) return
    const newOrder = direction === 'up' ? (banner.sortOrder || 0) - 1 : (banner.sortOrder || 0) + 1
    const otherBanner = accessoriesBanners.find(b => (b.sortOrder || 0) === newOrder && b._id !== id)
    if (!otherBanner && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/hero-banners/accessories/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherBanner) {
        await api.patch(`/food/hero-banners/accessories/${otherBanner._id}/order`, { order: banner.sortOrder || 0 }, getAuthConfig())
      }
      await fetchAccessoriesBanners()
    } catch (err) {
      setErrorSafely('Failed to update banner order.')
    }
  }

  // ==================== SETTINGS ====================
  const fetchSettings = async () => {
    try {
      setSettingsLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners/landing/settings', getAuthConfig())
      if (response.data.success) {
        const nextSettings = response.data.data.settings || {}
        setSettings({
          exploreMoreHeading: nextSettings.exploreMoreHeading || "Explore More",
          recommendedRestaurantIds: Array.isArray(nextSettings.recommendedRestaurantIds) ? nextSettings.recommendedRestaurantIds : [],
          festBannerVideoUrl: nextSettings.festBannerVideoUrl || "",
          festBannerVideoPublicId: nextSettings.festBannerVideoPublicId || ""
        })
      }
    } catch (err) {
      // Silently handle 401/404 errors - endpoints may not exist yet, use default settings
      if (err.response?.status === 401 || err.response?.status === 404) {
        setSettings({ 
          exploreMoreHeading: "Explore More", 
          recommendedRestaurantIds: [],
          festBannerVideoUrl: "",
          festBannerVideoPublicId: ""
        }) // Use default settings
        setError(null) // Clear any previous error
      } else {
        // Filter out token-related errors
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load settings'
        setErrorSafely(errorMessage)
      }
    } finally {
      setSettingsLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    try {
      setSettingsSaving(true)
      setError(null)
      setSuccess(null)
      const response = await api.patch('/food/hero-banners/landing/settings', {
        exploreMoreHeading: settings.exploreMoreHeading,
        recommendedRestaurantIds: Array.isArray(settings.recommendedRestaurantIds) ? settings.recommendedRestaurantIds : [],
        festBannerVideoUrl: settings.festBannerVideoUrl,
        festBannerVideoPublicId: settings.festBannerVideoPublicId
      }, getAuthConfig())
      if (response.data.success) {
        const savedSettings = response.data.data?.settings || {}
        setSettings((prev) => ({
          ...prev,
          exploreMoreHeading: savedSettings.exploreMoreHeading || prev.exploreMoreHeading,
          recommendedRestaurantIds: Array.isArray(savedSettings.recommendedRestaurantIds)
            ? savedSettings.recommendedRestaurantIds
            : prev.recommendedRestaurantIds,
          festBannerVideoUrl: savedSettings.festBannerVideoUrl || prev.festBannerVideoUrl,
          festBannerVideoPublicId: savedSettings.festBannerVideoPublicId || prev.festBannerVideoPublicId
        }))
        setSuccess('Settings saved successfully!')
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to save settings.')
    } finally {
      setSettingsSaving(false)
    }
  }

  const handleVideoFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setVideoUploading(true)
      setError(null)
      setSuccess(null)

      const formData = new FormData()
      formData.append('videoFile', file)
      if (settings.festBannerVideoPublicId) {
        formData.append('oldPublicId', settings.festBannerVideoPublicId)
      }

      const response = await api.post('/food/hero-banners/landing/settings/video', formData, getAuthConfig())

      if (response.data.success) {
        const { videoUrl, publicId } = response.data.data
        setSettings(prev => ({
          ...prev,
          festBannerVideoUrl: videoUrl,
          festBannerVideoPublicId: publicId
        }))
        setSuccess('Video uploaded successfully! Make sure to click Save Settings to persist.')
        setTimeout(() => setSuccess(null), 5000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to upload video file.')
    } finally {
      setVideoUploading(false)
    }
  }

  // ==================== ALL RESTAURANTS ====================
  const fetchAllRestaurants = async () => {
    try {
      setRestaurantsLoading(true)
      setError(null)
      const response = await adminAPI.getRestaurants({ limit: 1000 })
      const data = response?.data?.data
      if (response?.data?.success && data) {
        const raw = Array.isArray(data) ? data : (data.restaurants || [])
        const restaurants = raw.map((r) => ({
          ...r,
          name: r.name || r.restaurantName || ''
        }))
        setAllRestaurants(restaurants)
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403 || err.response?.status === 404) {
        setAllRestaurants([])
        setError(null)
      } else {
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load restaurants'
        setErrorSafely(errorMessage)
      }
    } finally {
      setRestaurantsLoading(false)
    }
  }

  const fetchGourmetRestaurants = async () => {
    try {
      setGourmetLoading(true)
      setError(null)
      const response = await api.get('/food/hero-banners/gourmet', getAuthConfig())
      if (response.data.success) {
        setGourmetRestaurants(response.data.data.restaurants || [])
      }
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 404) {
        setGourmetRestaurants([])
        setError(null)
      } else {
        const errorMessage = (err.response?.data?.message || err.response?.data?.error) || 'Failed to load Gourmet restaurants'
        setErrorSafely(errorMessage)
      }
    } finally {
      setGourmetLoading(false)
    }
  }

  const handleAddGourmetRestaurant = async () => {
    if (!selectedRestaurantGourmet) {
      setError('Please select a restaurant')
      return
    }

    try {
      setError(null)
      setSuccess(null)
      const response = await api.post('/food/hero-banners/gourmet', {
        restaurantId: selectedRestaurantGourmet
      }, getAuthConfig())
      if (response.data.success) {
        setSuccess('Restaurant added to Gourmet successfully!')
        setSelectedRestaurantGourmet("")
        await fetchGourmetRestaurants()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to add restaurant to Gourmet.')
    }
  }
  const handleDeleteGourmetRestaurant = async (id) => {
    if (!window.confirm('Are you sure you want to remove this restaurant from Gourmet?')) return
    try {
      setGourmetDeleting(id)
      setError(null)
      setSuccess(null)
      const response = await api.delete(`/food/hero-banners/gourmet/${id}`, getAuthConfig())
      if (response.data.success) {
        setSuccess('Restaurant removed from Gourmet successfully!')
        await fetchGourmetRestaurants()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to remove restaurant.')
    } finally {
      setGourmetDeleting(null)
    }
  }

  const handleGourmetOrderChange = async (id, direction) => {
    const restaurant = gourmetRestaurants.find(r => r._id === id)
    if (!restaurant) return
    const newOrder = direction === 'up' ? restaurant.order - 1 : restaurant.order + 1
    const otherRestaurant = gourmetRestaurants.find(r => r.order === newOrder && r._id !== id)
    if (!otherRestaurant && newOrder < 0) return
    try {
      setError(null)
      await api.patch(`/food/hero-banners/gourmet/${id}/order`, { order: newOrder }, getAuthConfig())
      if (otherRestaurant) {
        await api.patch(`/food/hero-banners/gourmet/${otherRestaurant._id}/order`, { order: restaurant.order }, getAuthConfig())
      }
      await fetchGourmetRestaurants()
    } catch (err) {
      setErrorSafely('Failed to update Gourmet restaurant order.')
    }
  }

  const handleToggleGourmetStatus = async (id, currentStatus) => {
    try {
      setError(null)
      setSuccess(null)
      const response = await api.patch(`/food/hero-banners/gourmet/${id}/status`, {}, getAuthConfig())
      if (response.data.success) {
        setSuccess(`Restaurant ${currentStatus ? 'deactivated' : 'activated'} successfully!`)
        await fetchGourmetRestaurants()
        setTimeout(() => setSuccess(null), 3000)
      }
    } catch (err) {
      setErrorSafely((err.response?.data?.message || err.response?.data?.error) || 'Failed to update restaurant status.')
    }
  }

  // ==================== RENDER ====================

  const tabs = [
    { id: 'top-banners', label: 'Top Banners', icon: ImageIcon },
    { id: 'banners', label: 'Hero Banners', icon: ImageIcon },
    { id: 'under-250', label: 'Grocery Banner', icon: Tag },
    { id: 'accessories', label: 'Accessories Banner', icon: Tag },
    { id: 'explore-more', label: 'Explore More', icon: Layout },
  ]

  const exploreMoreTabs = [
    { id: 'icons', label: 'Icons', icon: ImageIcon },
    { id: 'gourmet', label: 'Gourmet', icon: ChefHat },
  ]

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Page Title */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
              <Layout className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Landing Page Management</h1>
              <p className="text-sm text-slate-600 mt-1">Manage hero banners</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-2 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {/* Hero Banners Tab */}
        {activeTab === 'top-banners' && (
          <>
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Upload New Top Banner(s) (800x680 pixels)</h2>

              {/* Category Selector for New Banners */}
              <div className="mb-5 p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-blue-600" />
                    Target Food Category <span className="text-xs font-normal text-slate-500">(Optional)</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When user taps this banner on the home screen, they will redirect to this category.
                  </p>
                </div>
                <div className="flex-shrink-0 w-full md:w-80">
                  <SearchableCategorySelect
                    categories={foodCategories}
                    value={selectedCategoryForUpload}
                    onChange={setSelectedCategoryForUpload}
                    placeholder="Search & select category..."
                    size="md"
                  />
                </div>
              </div>

              <div
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50/30 cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const files = Array.from(e.dataTransfer.files)
                  if (files.length > 0) handleTopBannerFileSelect({ files })
                }}
                onClick={() => topBannersFileInputRef.current?.click()}
              >
                <input
                  ref={topBannersFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleTopBannerFileSelect}
                  className="hidden"
                  disabled={topBannersUploading}
                />
                {topBannersUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-blue-600 font-medium">
                      Uploading image {topBannersUploadProgress.current} of {topBannersUploadProgress.total}...
                    </p>
                    {topBannersUploadProgress.total > 0 && (
                      <div className="w-full max-w-xs">
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(topBannersUploadProgress.current / topBannersUploadProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-blue-600" />
                    <div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); topBannersFileInputRef.current?.click(); }}
                        className="text-blue-600 font-medium hover:text-blue-700 underline"
                      >
                        Click to upload
                      </button>
                      <span className="text-slate-600"> or drag and drop</span>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB each (Max 5 images at once)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Banners List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Top Banner List ({topBanners.length})</h2>
              {topBannersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : topBanners.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>No banners uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {topBanners.map((banner, index) => (
                    <div key={banner._id} className="border border-slate-200 rounded-lg bg-white hover:shadow-md transition-shadow">
                      <div className="relative aspect-video bg-slate-100 rounded-t-lg overflow-hidden">
                        <img src={banner.image || banner.imageUrl} alt={`Top Banner ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {banner.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Order: {banner.order}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-b-lg">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleTopBannerOrderChange(banner._id, 'up')} disabled={index === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowUp className="w-4 h-4 text-slate-600" />
                            </button>
                            <button onClick={() => handleTopBannerOrderChange(banner._id, 'down')} disabled={index === topBanners.length - 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowDown className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* <button
                              onClick={() => {
                                setSelectedBannerId(banner._id)
                                setSelectedRestaurantIds(banner.linkedRestaurants?.map(r => r._id || r) || [])
                                setShowRestaurantModal(true)
                              }}
                              className="px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 flex items-center gap-1"
                            >
                              <Megaphone className="w-4 h-4" />
                              Advertise
                            </button> */}
                            <button onClick={() => handleToggleTopBannerStatus(banner._id, banner.isActive)} className={`px-3 py-1.5 rounded text-sm font-medium ${banner.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {banner.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleDeleteTopBanner(banner._id)} disabled={topBannersDeleting === banner._id} className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-50">
                              {topBannersDeleting === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        {banner.linkedRestaurants && banner.linkedRestaurants.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-600 mb-1">Linked Restaurants ({banner.linkedRestaurants.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {banner.linkedRestaurants.slice(0, 3).map((restaurant) => (
                                <span key={restaurant._id || restaurant} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                  {restaurant.name || 'Restaurant'}
                                </span>
                              ))}
                              {banner.linkedRestaurants.length > 3 && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                  +{banner.linkedRestaurants.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Linked Food Category */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Tag className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-slate-500 font-medium">Category:</span>
                            {banner.categoryName ? (
                              <span className="font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {banner.categoryName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </div>
                          <SearchableCategorySelect
                            categories={foodCategories}
                            value={banner.categoryId || ""}
                            disabled={updatingBannerCategory === banner._id}
                            onChange={(catId) => handleBannerCategoryChange(banner._id, catId, 'top')}
                            placeholder="Assign / Change..."
                            size="sm"
                            className="w-48"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Grocery Banner Tab */}
        {activeTab === 'under-250' && (
          <>
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Upload New Grocery Banner(s)</h2>
              <div
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50/30 cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const files = Array.from(e.dataTransfer.files)
                  if (files.length > 0) handleUnder250BannerFileSelect({ files })
                }}
                onClick={() => under250BannersFileInputRef.current?.click()}
              >
                <input
                  ref={under250BannersFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUnder250BannerFileSelect}
                  className="hidden"
                  disabled={under250BannersUploading}
                />
                {under250BannersUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-blue-600 font-medium">
                      Uploading image {under250BannersUploadProgress.current} of {under250BannersUploadProgress.total}...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-blue-600" />
                    <div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); under250BannersFileInputRef.current?.click(); }}
                        className="text-blue-600 font-medium hover:text-blue-700 underline"
                      >
                        Click to upload
                      </button>
                      <span className="text-slate-600"> or drag and drop</span>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB each (Max 5 images at once)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Banners List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Grocery Banner List ({under250Banners.length})</h2>
              {under250BannersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : under250Banners.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>No Grocery banners uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {under250Banners.map((banner, index) => (
                    <div key={banner._id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative aspect-video bg-slate-100">
                        <img src={banner.imageUrl} alt={`Grocery Banner ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {banner.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Order: {banner.sortOrder || 0}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleUnder250BannerOrderChange(banner._id, 'up')} disabled={index === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowUp className="w-4 h-4 text-slate-600" />
                            </button>
                            <button onClick={() => handleUnder250BannerOrderChange(banner._id, 'down')} disabled={index === under250Banners.length - 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowDown className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleToggleUnder250BannerStatus(banner._id, banner.isActive)} className={`px-3 py-1.5 rounded text-sm font-medium ${banner.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {banner.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleDeleteUnder250Banner(banner._id)} disabled={under250BannersDeleting === banner._id} className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-50">
                              {under250BannersDeleting === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Accessories Banner Tab */}
        {activeTab === 'accessories' && (
          <>
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Upload New Accessories Banner(s)</h2>
              <div
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50/30 cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const files = Array.from(e.dataTransfer.files)
                  if (files.length > 0) handleAccessoriesBannerFileSelect({ files })
                }}
                onClick={() => accessoriesBannersFileInputRef.current?.click()}
              >
                <input
                  ref={accessoriesBannersFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAccessoriesBannerFileSelect}
                  className="hidden"
                  disabled={accessoriesBannersUploading}
                />
                {accessoriesBannersUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-blue-600 font-medium">
                      Uploading image {accessoriesBannersUploadProgress.current} of {accessoriesBannersUploadProgress.total}...
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-blue-600" />
                    <div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); accessoriesBannersFileInputRef.current?.click(); }}
                        className="text-blue-600 font-medium hover:text-blue-700 underline"
                      >
                        Click to upload
                      </button>
                      <span className="text-slate-600"> or drag and drop</span>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB each (Max 5 images at once)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Banners List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Accessories Banner List ({accessoriesBanners.length})</h2>
              {accessoriesBannersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : accessoriesBanners.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>No Accessories banners uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {accessoriesBanners.map((banner, index) => (
                    <div key={banner._id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                      <div className="relative aspect-video bg-slate-100">
                        <img src={banner.imageUrl} alt={`Accessories Banner ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {banner.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Order: {banner.sortOrder || 0}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleAccessoriesBannerOrderChange(banner._id, 'up')} disabled={index === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowUp className="w-4 h-4 text-slate-600" />
                            </button>
                            <button onClick={() => handleAccessoriesBannerOrderChange(banner._id, 'down')} disabled={index === accessoriesBanners.length - 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowDown className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleToggleAccessoriesBannerStatus(banner._id, banner.isActive)} className={`px-3 py-1.5 rounded text-sm font-medium ${banner.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {banner.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleDeleteAccessoriesBanner(banner._id)} disabled={accessoriesBannersDeleting === banner._id} className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-50">
                              {accessoriesBannersDeleting === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'banners' && (
          <>
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Upload New Banner(s)</h2>

              {/* Category Selector for New Hero Banners */}
              <div className="mb-5 p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <label className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                    <Tag className="w-4 h-4 text-blue-600" />
                    Target Food Category <span className="text-xs font-normal text-slate-500">(Optional)</span>
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    When user taps this banner on the home screen, they will redirect to this category.
                  </p>
                </div>
                <div className="flex-shrink-0 w-full md:w-80">
                  <SearchableCategorySelect
                    categories={foodCategories}
                    value={selectedCategoryForUpload}
                    onChange={setSelectedCategoryForUpload}
                    placeholder="Search & select category..."
                    size="md"
                  />
                </div>
              </div>

              <div
                className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50/30 cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const files = Array.from(e.dataTransfer.files)
                  if (files.length > 0) handleBannerFileSelect({ files })
                }}
                onClick={() => bannersFileInputRef.current?.click()}
              >
                <input
                  ref={bannersFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBannerFileSelect}
                  className="hidden"
                  disabled={bannersUploading}
                />
                {bannersUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    <p className="text-blue-600 font-medium">
                      Uploading image {bannersUploadProgress.current} of {bannersUploadProgress.total}...
                    </p>
                    {bannersUploadProgress.total > 0 && (
                      <div className="w-full max-w-xs">
                        <div className="w-full bg-blue-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${(bannersUploadProgress.current / bannersUploadProgress.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload className="w-8 h-8 text-blue-600" />
                    <div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); bannersFileInputRef.current?.click(); }}
                        className="text-blue-600 font-medium hover:text-blue-700 underline"
                      >
                        Click to upload
                      </button>
                      <span className="text-slate-600"> or drag and drop</span>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, WEBP up to 5MB each (Max 5 images at once)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Banners List */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Banner List ({banners.length})</h2>
              {bannersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                </div>
              ) : banners.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-3 text-slate-400" />
                  <p>No banners uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {banners.map((banner, index) => (
                    <div key={banner._id} className="border border-slate-200 rounded-lg bg-white hover:shadow-md transition-shadow">
                      <div className="relative aspect-video bg-slate-100 rounded-t-lg overflow-hidden">
                        <img src={banner.imageUrl} alt={`Hero Banner ${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute top-2 right-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${banner.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {banner.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="absolute top-2 left-2">
                          <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">Order: {banner.order}</span>
                        </div>
                      </div>
                      <div className="p-4 bg-white rounded-b-lg">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleBannerOrderChange(banner._id, 'up')} disabled={index === 0} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowUp className="w-4 h-4 text-slate-600" />
                            </button>
                            <button onClick={() => handleBannerOrderChange(banner._id, 'down')} disabled={index === banners.length - 1} className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-50">
                              <ArrowDown className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* <button
                              onClick={() => {
                                setSelectedBannerId(banner._id)
                                setSelectedRestaurantIds(banner.linkedRestaurants?.map(r => r._id || r) || [])
                                setShowRestaurantModal(true)
                              }}
                              className="px-3 py-1.5 rounded text-sm font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 flex items-center gap-1"
                            >
                              <Megaphone className="w-4 h-4" />
                              Advertise
                            </button> */}
                            <button onClick={() => handleToggleBannerStatus(banner._id, banner.isActive)} className={`px-3 py-1.5 rounded text-sm font-medium ${banner.isActive ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}>
                              {banner.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => handleDeleteBanner(banner._id)} disabled={bannersDeleting === banner._id} className="p-1.5 rounded hover:bg-red-100 text-red-600 disabled:opacity-50">
                              {bannersDeleting === banner._id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                        {banner.linkedRestaurants && banner.linkedRestaurants.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200">
                            <p className="text-xs text-slate-600 mb-1">Linked Restaurants ({banner.linkedRestaurants.length}):</p>
                            <div className="flex flex-wrap gap-1">
                              {banner.linkedRestaurants.slice(0, 3).map((restaurant) => (
                                <span key={restaurant._id || restaurant} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                                  {restaurant.name || 'Restaurant'}
                                </span>
                              ))}
                              {banner.linkedRestaurants.length > 3 && (
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs">
                                  +{banner.linkedRestaurants.length - 3} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Linked Food Category */}
                        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Tag className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
                            <span className="text-slate-500 font-medium">Category:</span>
                            {banner.categoryName ? (
                              <span className="font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                {banner.categoryName}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">None</span>
                            )}
                          </div>
                          <SearchableCategorySelect
                            categories={foodCategories}
                            value={banner.categoryId || ""}
                            disabled={updatingBannerCategory === banner._id}
                            onChange={(catId) => handleBannerCategoryChange(banner._id, catId, 'hero')}
                            placeholder="Assign / Change..."
                            size="sm"
                            className="w-48"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}


        {/* Explore More Tab */}
        {activeTab === 'explore-more' && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900">Landing Settings</h2>
                <Button
                  onClick={handleSaveSettings}
                  disabled={settingsSaving || settingsLoading}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Settings
                </Button>
              </div>

              {settingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <Label htmlFor="explore-more-heading">Explore More Heading</Label>
                    <Input
                      id="explore-more-heading"
                      value={settings.exploreMoreHeading || ""}
                      onChange={(e) => setSettings((prev) => ({ ...prev, exploreMoreHeading: e.target.value }))}
                      className="mt-2"
                      placeholder="Explore More"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Home Page Video Settings */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
              <div className="flex items-center justify-between gap-3 mb-4">
                <h2 className="text-lg font-bold text-slate-900">Home Page Video Settings</h2>
                <Button
                  onClick={handleSaveSettings}
                  disabled={settingsSaving || settingsLoading || videoUploading}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  {settingsSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Save Settings
                </Button>
              </div>

              {settingsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* File Upload Zone */}
                  <div>
                    <Label className="block mb-2">Upload Video File</Label>
                    <div
                      className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center bg-blue-50/30 cursor-pointer transition-colors hover:border-blue-400 hover:bg-blue-50/50"
                      onClick={() => videoFileInputRef.current?.click()}
                    >
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/*"
                        onChange={handleVideoFileUpload}
                        className="hidden"
                        disabled={videoUploading}
                      />
                      {videoUploading ? (
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                          <p className="text-blue-600 font-medium">Uploading video...</p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <Upload className="w-8 h-8 text-blue-600" />
                          <div>
                            <span className="text-blue-600 font-medium hover:text-blue-700 underline">Click to upload video</span>
                            <span className="text-slate-600"> or drag and drop</span>
                          </div>
                          <p className="text-xs text-slate-500">MP4, WEBM up to 20MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative flex py-2 items-center">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="flex-shrink mx-4 text-slate-400 text-xs font-semibold uppercase tracking-wider">OR</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  {/* Direct URL Input */}
                  <div>
                    <Label htmlFor="fest-video-url">Video Direct URL</Label>
                    <Input
                      id="fest-video-url"
                      value={settings.festBannerVideoUrl || ""}
                      onChange={(e) => setSettings((prev) => ({ ...prev, festBannerVideoUrl: e.target.value }))}
                      className="mt-2"
                      placeholder="e.g. https://example.com/video.mp4"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      You can paste a direct video URL (ending in .mp4, .webm, etc.) or upload a video file above.
                    </p>
                  </div>

                  {/* Video Preview */}
                  {settings.festBannerVideoUrl && (
                    <div className="mt-4">
                      <Label className="block mb-2">Video Preview</Label>
                      <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 max-w-md">
                        <video
                          src={settings.festBannerVideoUrl}
                          className="w-full h-full object-cover"
                          controls
                          muted
                          playsInline
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Icons Tab Content */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-6">Manage Explore More Icons</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { id: 'offers', label: 'Offers', link: '/user/offers' },
                  { id: 'collection', label: 'Collections', link: '/user/profile/favorites' }
                ].map((item) => {
                  // Find matching item from DB
                  const dbItem = exploreMore.find(i => i.label?.toLowerCase() === item.label.toLowerCase())

                  return (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-4 flex flex-col items-center relative">
                      <span className="text-sm font-semibold text-slate-700 mb-3">{item.label}</span>

                      <div className="w-24 h-24 mb-4 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden relative group">
                        {dbItem?.imageUrl ? (
                          <img
                            src={dbItem.imageUrl}
                            alt={item.label}
                            className="w-full h-full object-contain p-2"
                          />
                        ) : (
                          <ImageIcon className="w-8 h-8 text-slate-300" />
                        )}

                        {exploreIconsUploading[item.id] && (
                          <div className="absolute inset-0 bg-white/50 flex items-center justify-center z-10">
                            <Loader2 className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>

                      <div className="w-full mt-auto">
                        <input
                          type="file"
                          id={`file-${item.id}`}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              handleIconUpdate(e.target.files[0], item.label, item.link, item.id)
                            }
                          }}
                          disabled={exploreIconsUploading[item.id]}
                        />
                        <label
                          htmlFor={`file-${item.id}`}
                          className={`w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-medium rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer ${exploreIconsUploading[item.id] ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          <Upload className="w-3 h-3" />
                          {dbItem ? 'Change Icon' : 'Upload Icon'}
                        </label>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Restaurant Selection Modal */}
        <Dialog open={showRestaurantModal} onOpenChange={setShowRestaurantModal}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
              <DialogTitle className="text-2xl font-bold text-slate-900">Select Restaurants to Link with Banner</DialogTitle>
              <DialogDescription className="text-slate-600 mt-2">
                Select restaurants that will be linked to this banner. When users click on this banner, they will be redirected to the selected restaurants.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden flex flex-col">
              {/* Search Bar and Selected Count */}
              <div className="px-6 pt-4 pb-3 space-y-3 bg-slate-50 border-b border-slate-200">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search restaurants by name or ID..."
                    value={restaurantSearchQuery}
                    onChange={(e) => setRestaurantSearchQuery(e.target.value)}
                    className="pl-10 h-11 bg-white border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                {selectedRestaurantIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium">
                      {selectedRestaurantIds.length} restaurant{selectedRestaurantIds.length > 1 ? 's' : ''} selected
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRestaurantIds([])}
                      className="text-xs text-slate-600 hover:text-slate-900"
                    >
                      Clear selection
                    </Button>
                  </div>
                )}
              </div>

              {/* Restaurant List */}
              <div className="flex-1 overflow-y-auto bg-white">
                {restaurantsLoading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-3" />
                    <p className="text-slate-500">Loading restaurants...</p>
                  </div>
                ) : filteredRestaurantsForModal.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                    <ImageIcon className="w-16 h-16 text-slate-300 mb-4" />
                    <p className="text-slate-600 font-medium mb-1">No restaurants found</p>
                    <p className="text-sm text-slate-500">
                      {restaurantSearchQuery ? 'Try a different search term' : 'No restaurants available'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {filteredRestaurantsForModal.map((restaurant) => {
                      const isSelected = selectedRestaurantIds.includes(restaurant._id)
                      const profileImageUrl = restaurant.profileImage?.url || restaurant.profileImage || null

                      return (
                        <div
                          key={restaurant._id}
                          className={`px-6 py-4 transition-all cursor-pointer ${isSelected
                            ? 'bg-blue-50 border-l-4 border-l-blue-500'
                            : 'hover:bg-slate-50'
                            }`}
                          onClick={() => toggleRestaurantSelection(restaurant._id)}
                        >
                          <div className="flex items-center gap-4">
                            <div className="flex-shrink-0">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleRestaurantSelection(restaurant._id)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-5 h-5"
                              />
                            </div>

                            {/* Restaurant Image */}
                            <div className="flex-shrink-0">
                              {profileImageUrl ? (
                                <img
                                  src={profileImageUrl}
                                  alt={restaurant.name}
                                  className="w-16 h-16 rounded-xl object-cover border-2 border-slate-200"
                                  onError={(e) => {
                                    e.target.style.display = 'none'
                                    e.target.nextSibling.style.display = 'flex'
                                  }}
                                />
                              ) : null}
                              <div
                                className={`w-16 h-16 rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-lg ${profileImageUrl ? 'hidden' : 'flex'
                                  }`}
                              >
                                {restaurant.name?.charAt(0)?.toUpperCase() || 'R'}
                              </div>
                            </div>

                            {/* Restaurant Info */}
                            <div className="flex-1 min-w-0">
                              <h3 className={`font-semibold text-base mb-1 ${isSelected ? 'text-blue-900' : 'text-slate-900'
                                }`}>
                                {restaurant.name || 'Unnamed Restaurant'}
                              </h3>
                              <p className="text-sm text-slate-500 truncate">
                                ID: {restaurant.restaurantId || restaurant._id}
                              </p>
                              {restaurant.rating && (
                                <div className="flex items-center gap-1 mt-1">
                                  <span className="text-xs text-slate-400">?</span>
                                  <span className="text-xs text-slate-600">{restaurant.rating}</span>
                                </div>
                              )}
                            </div>

                            {/* Selected Indicator */}
                            {isSelected && (
                              <div className="flex-shrink-0">
                                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                                  <CheckCircle2 className="w-5 h-5 text-white" />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
                <div className="text-sm text-slate-600">
                  {filteredRestaurantsForModal.length} restaurant{filteredRestaurantsForModal.length !== 1 ? 's' : ''} available
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRestaurantModal(false)
                      setSelectedBannerId(null)
                      setSelectedRestaurantIds([])
                      setRestaurantSearchQuery("")
                    }}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleLinkRestaurants}
                    disabled={linkingRestaurants || selectedRestaurantIds.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 min-w-[140px]"
                  >
                    {linkingRestaurants ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Linking...
                      </>
                    ) : (
                      <>
                        <Megaphone className="w-4 h-4 mr-2" />
                        Link {selectedRestaurantIds.length > 0 ? `(${selectedRestaurantIds.length})` : ''} Restaurant{selectedRestaurantIds.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div >
    </div >
  )
}

