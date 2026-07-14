import { useState, useMemo, useEffect, useCallback } from "react"
import { Search, Trash2, Loader2, Eye, Pencil, Plus, ChevronLeft, ChevronRight, Check, X, Building2, MapPin, Phone, Mail, Clock, Star, AlertTriangle, ShieldCheck, ShieldX, Save } from "lucide-react"
import { adminAPI, uploadAPI } from "@food/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@food/components/ui/dialog"

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
      <rect width="80" height="80" rx="12" fill="#F1F5F9"/>
      <rect x="18" y="22" width="44" height="36" rx="6" fill="#CBD5E1"/>
      <rect x="26" y="30" width="28" height="4" rx="2" fill="#94A3B8"/>
      <rect x="26" y="38" width="20" height="4" rx="2" fill="#94A3B8"/>
      <rect x="26" y="46" width="14" height="4" rx="2" fill="#94A3B8"/>
    </svg>`
  )

const STATUS_STYLES = {
  approved: {
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    text: "text-emerald-700 dark:text-emerald-300",
    border: "border-emerald-200 dark:border-emerald-700",
    dot: "bg-emerald-500",
    label: "Approved",
  },
  pending: {
    bg: "bg-amber-50 dark:bg-amber-900/30",
    text: "text-amber-700 dark:text-amber-300",
    border: "border-amber-200 dark:border-amber-700",
    dot: "bg-amber-500",
    label: "Pending",
  },
  rejected: {
    bg: "bg-red-50 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
    border: "border-red-200 dark:border-red-700",
    dot: "bg-red-500",
    label: "Rejected",
  },
}

const STATUS_FILTERS = ["all", "approved", "pending", "rejected"]

function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.pending
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${style.bg} ${style.text} ${style.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {style.label}
    </span>
  )
}

const createEmptyForm = () => ({
  restaurantName: "",
  ownerName: "",
  ownerPhone: "",
  ownerEmail: "",
  area: "",
  city: "",
  state: "",
  pincode: "",
  cuisines: "",
  openingTime: "09:00",
  closingTime: "22:00",
  pureVegRestaurant: false,
  restaurantType: "Both",
  zoneId: "",
  profileImage: "",
  isAcceptingOrders: true,
})

export default function RestaurantsList() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalRestaurants, setTotalRestaurants] = useState(0)

  // Zones for display
  const [zones, setZones] = useState([])

  // Detail modal
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState(createEmptyForm())
  const [editTarget, setEditTarget] = useState(null)
  const [saving, setSaving] = useState(false)

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState(createEmptyForm())
  const [creating, setCreating] = useState(false)

  // Image Upload States
  const [selectedImageFile, setSelectedImageFile] = useState(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState("")

  // Approve/Reject
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showRejectDialog, setShowRejectDialog] = useState(false)
  const [actionTarget, setActionTarget] = useState(null)
  const [rejectReason, setRejectReason] = useState("")
  const [actionLoading, setActionLoading] = useState(false)

  // Delete
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Debounce search
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchQuery.trim())
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [searchQuery])

  // Reset page on filter/search change
  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, statusFilter, pageSize])

  // Fetch zones on mount for name display
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const res = await adminAPI.getZones({ limit: 1000 })
        const list = res?.data?.data?.zones || res?.data?.data?.data?.zones || res?.data?.data || []
        setZones(Array.isArray(list) ? list : [])
      } catch (err) {
        console.error("Error loading zones:", err)
        setZones([])
      }
    }
    fetchZones()
  }, [])

  // Zone lookup helper
  const getZoneName = useCallback(
    (restaurant) => {
      const zoneId = restaurant.zoneId
      if (!zoneId) return "Global Zone"
      // If populated as object
      if (typeof zoneId === "object" && zoneId !== null) {
        return zoneId.name || zoneId.zoneName || "Global Zone"
      }
      // Lookup from fetched zones
      const zoneIdStr = String(zoneId)
      const zone = zones.find((z) => String(z._id || z.id) === zoneIdStr)
      if (zone) return zone.name || zone.zoneName || "Global Zone"
      return "Global Zone"
    },
    [zones]
  )

  // Get raw zone ID for forms
  const getZoneId = (restaurant) => {
    const zoneId = restaurant.zoneId
    if (!zoneId) return ""
    if (typeof zoneId === "object" && zoneId !== null) return String(zoneId._id || zoneId.id || "")
    return String(zoneId)
  }

  const fetchRestaurants = useCallback(async () => {
    try {
      setLoading(true)
      const params = { page: currentPage, limit: pageSize }
      if (statusFilter !== "all") params.status = statusFilter
      const res = await adminAPI.getRestaurants(params)
      const data = res?.data?.data || res?.data || {}
      const list = Array.isArray(data.restaurants) ? data.restaurants : []
      const total = Number(data.total ?? 0)
      setRestaurants(list)
      setTotalRestaurants(total)
    } catch (error) {
      console.error("Error fetching restaurants:", error)
      toast.error("Failed to load restaurants")
      setRestaurants([])
      setTotalRestaurants(0)
    } finally {
      setLoading(false)
    }
  }, [currentPage, pageSize, statusFilter])

  useEffect(() => {
    fetchRestaurants()
  }, [fetchRestaurants])

  // Client-side search filter
  const filteredRestaurants = useMemo(() => {
    if (!debouncedSearch) return restaurants
    const q = debouncedSearch.toLowerCase()
    return restaurants.filter((r) => {
      const name = String(r.restaurantName || "").toLowerCase()
      const owner = String(r.ownerName || "").toLowerCase()
      const city = String(r.city || "").toLowerCase()
      const area = String(r.area || "").toLowerCase()
      return name.includes(q) || owner.includes(q) || city.includes(q) || area.includes(q)
    })
  }, [restaurants, debouncedSearch])

  const totalPages = useMemo(() => {
    if (totalRestaurants === 0) return 1
    return Math.ceil(totalRestaurants / pageSize)
  }, [totalRestaurants, pageSize])

  const getRestaurantImage = (r) => {
    if (r.profileImage) return r.profileImage
    if (Array.isArray(r.coverImages) && r.coverImages.length > 0) return r.coverImages[0]
    return FALLBACK_IMAGE
  }

  // View detail
  const handleViewDetail = async (restaurant) => {
    try {
      setLoadingDetail(true)
      setShowDetailModal(true)
      const id = restaurant._id || restaurant.id
      const res = await adminAPI.getRestaurantById(id)
      setSelectedRestaurant(res?.data?.data || res?.data || restaurant)
    } catch (error) {
      console.error("Error fetching restaurant details:", error)
      setSelectedRestaurant(restaurant)
    } finally {
      setLoadingDetail(false)
    }
  }

  // Edit
  const handleEditClick = async (restaurant) => {
    try {
      setSaving(true)
      const id = restaurant._id || restaurant.id
      const res = await adminAPI.getRestaurantById(id)
      const fullRes = res?.data?.data || res?.data || restaurant
      
      setEditTarget(fullRes)
      setEditForm({
        restaurantName: fullRes.restaurantName || "",
        ownerName: fullRes.ownerName || "",
        ownerPhone: fullRes.ownerPhone || fullRes.primaryContactNumber || "",
        ownerEmail: fullRes.ownerEmail || "",
        area: fullRes.area || fullRes.location?.area || "",
        city: fullRes.city || fullRes.location?.city || "",
        state: fullRes.state || fullRes.location?.state || "",
        pincode: fullRes.pincode || fullRes.location?.pincode || "",
        cuisines: Array.isArray(fullRes.cuisines) ? fullRes.cuisines.join(", ") : "",
        openingTime: fullRes.openingTime || "09:00",
        closingTime: fullRes.closingTime || "22:00",
        pureVegRestaurant: fullRes.pureVegRestaurant || false,
        restaurantType: fullRes.restaurantType || (fullRes.pureVegRestaurant ? "Veg" : "Both"),
        zoneId: getZoneId(fullRes),
        profileImage: fullRes.profileImage || "",
        isAcceptingOrders: fullRes.isAcceptingOrders !== false,
      })
      setSelectedImageFile(null)
      setImagePreviewUrl(fullRes.profileImage || "")
      setShowEditModal(true)
    } catch (error) {
      console.error("Error loading restaurant for edit:", error)
      toast.error("Failed to load restaurant details")
    } finally {
      setSaving(false)
    }
  }

  const handleEditSave = async () => {
    if (!editTarget) return
    try {
      setSaving(true)
      const id = editTarget._id || editTarget.id

      let profileImageUrl = editForm.profileImage || ""
      if (selectedImageFile) {
        const uploadResponse = await uploadAPI.uploadMedia(selectedImageFile, {
          folder: "restaurants",
        })
        profileImageUrl =
          uploadResponse?.data?.data?.url ||
          uploadResponse?.data?.url ||
          profileImageUrl
      }

      const body = {
        ...editForm,
        profileImage: profileImageUrl,
        cuisines: editForm.cuisines
          ? editForm.cuisines.split(",").map((c) => c.trim()).filter(Boolean)
          : [],
        pureVegRestaurant: editForm.restaurantType === "Veg",
        zoneId: editForm.zoneId || "",
      }
      await adminAPI.updateRestaurant(id, body)
      toast.success(`"${editForm.restaurantName}" updated successfully`)
      setShowEditModal(false)
      setEditTarget(null)
      fetchRestaurants()
    } catch (error) {
      console.error("Error updating restaurant:", error)
      toast.error("Failed to update restaurant")
    } finally {
      setSaving(false)
    }
  }

  // Create
  const handleCreateOpen = () => {
    setCreateForm(createEmptyForm())
    setSelectedImageFile(null)
    setImagePreviewUrl("")
    setShowCreateModal(true)
  }

  const handleCreateSave = async () => {
    if (!createForm.restaurantName || !createForm.ownerName) {
      toast.error("Restaurant name and owner name are required")
      return
    }
    try {
      setCreating(true)

      let profileImageUrl = ""
      if (selectedImageFile) {
        const uploadResponse = await uploadAPI.uploadMedia(selectedImageFile, {
          folder: "restaurants",
        })
        profileImageUrl =
          uploadResponse?.data?.data?.url ||
          uploadResponse?.data?.url ||
          ""
      }

      const body = {
        ...createForm,
        profileImage: profileImageUrl,
        cuisines: createForm.cuisines
          ? createForm.cuisines.split(",").map((c) => c.trim()).filter(Boolean)
          : [],
        pureVegRestaurant: createForm.restaurantType === "Veg",
        zoneId: createForm.zoneId || "",
      }
      await adminAPI.createRestaurant(body)
      toast.success(`"${createForm.restaurantName}" created successfully`)
      setShowCreateModal(false)
      fetchRestaurants()
    } catch (error) {
      console.error("Error creating restaurant:", error)
      toast.error(error?.response?.data?.message || "Failed to create restaurant")
    } finally {
      setCreating(false)
    }
  }

  // Approve
  const handleApproveClick = (restaurant) => {
    setActionTarget(restaurant)
    setShowApproveDialog(true)
  }

  const confirmApprove = async () => {
    if (!actionTarget) return
    try {
      setActionLoading(true)
      const id = actionTarget._id || actionTarget.id
      await adminAPI.approveRestaurant(id)
      toast.success(`"${actionTarget.restaurantName}" approved successfully`)
      setShowApproveDialog(false)
      setActionTarget(null)
      fetchRestaurants()
    } catch (error) {
      console.error("Error approving restaurant:", error)
      toast.error("Failed to approve restaurant")
    } finally {
      setActionLoading(false)
    }
  }

  // Reject
  const handleRejectClick = (restaurant) => {
    setActionTarget(restaurant)
    setRejectReason("")
    setShowRejectDialog(true)
  }

  const confirmReject = async () => {
    if (!actionTarget) return
    try {
      setActionLoading(true)
      const id = actionTarget._id || actionTarget.id
      await adminAPI.rejectRestaurant(id, rejectReason || "Rejected by admin")
      toast.success(`"${actionTarget.restaurantName}" rejected`)
      setShowRejectDialog(false)
      setActionTarget(null)
      setRejectReason("")
      fetchRestaurants()
    } catch (error) {
      console.error("Error rejecting restaurant:", error)
      toast.error("Failed to reject restaurant")
    } finally {
      setActionLoading(false)
    }
  }

  // Delete
  const handleDeleteClick = (restaurant) => {
    setDeleteTarget(restaurant)
    setShowDeleteDialog(true)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      const id = deleteTarget._id || deleteTarget.id
      await adminAPI.deleteRestaurant(id)
      toast.success(`"${deleteTarget.restaurantName}" deleted permanently`)
      setShowDeleteDialog(false)
      setDeleteTarget(null)
      fetchRestaurants()
    } catch (error) {
      console.error("Error deleting restaurant:", error)
      toast.error("Failed to delete restaurant")
    } finally {
      setDeleting(false)
    }
  }



  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex flex-col gap-6">
          {/* Top Row: Title & Add Button */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-[#F84E04] flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Restaurant Management</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                  {totalRestaurants} total restaurant{totalRestaurants !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleCreateOpen}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#F84E04] hover:bg-[#d84303] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all duration-200 shadow-md shadow-orange-500/20 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Add Restaurant
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-200 dark:bg-slate-800 w-full" />

          {/* Bottom Row: Filters & Search */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Status Filter Tabs */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1 self-start">
              {STATUS_FILTERS.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                    statusFilter === filter
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  }`}
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative w-full md:max-w-md">
              <input
                type="text"
                placeholder="Search restaurants by name, city, owner..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04] transition-all"
              />
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">SL</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Restaurant</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Owner</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Zone</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Type</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Rating</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-[#F84E04] mb-2" />
                      <p className="text-sm text-slate-500 dark:text-slate-400">Loading restaurants...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRestaurants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Building2 className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-1">No Restaurants Found</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {debouncedSearch
                          ? "No restaurants match your search query"
                          : statusFilter !== "all"
                            ? `No ${statusFilter} restaurants`
                            : "No restaurants registered yet"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRestaurants.map((restaurant, index) => {
                  const status = String(restaurant.status || "pending").toLowerCase()
                  const isPending = status === "pending"
                  return (
                    <tr key={restaurant._id || index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{(currentPage - 1) * pageSize + index + 1}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                            <img src={getRestaurantImage(restaurant)} alt={restaurant.restaurantName} className="w-full h-full object-cover" loading="lazy"
                              onError={(e) => { e.target.src = FALLBACK_IMAGE }} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">{restaurant.restaurantName || "Unnamed"}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                              {[restaurant.area || restaurant.location?.area, restaurant.city || restaurant.location?.city].filter(Boolean).join(", ") || "—"}
                            </p>
                            {/* <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 select-all">
                              ID: {restaurant._id || restaurant.id}
                            </p> */}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{restaurant.ownerName || "—"}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">{restaurant.ownerPhone || restaurant.primaryContactNumber || "—"}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                          {getZoneName(restaurant)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                          restaurant.restaurantType === 'Veg'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'
                            : restaurant.restaurantType === 'Non-Veg'
                              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-800'
                              : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                        }`}>
                          {restaurant.restaurantType || (restaurant.pureVegRestaurant ? "Veg" : "Both")}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{Number(restaurant.rating || 0).toFixed(1)}</span>
                          <span className="text-xs text-slate-400">({restaurant.totalRatings || 0})</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleViewDetail(restaurant)} className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title="View Details">
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => handleEditClick(restaurant)} className="p-1.5 rounded-md text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          {isPending && (
                            <>
                              <button onClick={() => handleApproveClick(restaurant)} className="p-1.5 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors" title="Approve">
                                <Check className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleRejectClick(restaurant)} className="p-1.5 rounded-md text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/30 transition-colors" title="Reject">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => handleDeleteClick(restaurant)} className="p-1.5 rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalRestaurants > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Showing <span className="font-semibold text-slate-800 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span>
              {" "}to <span className="font-semibold text-slate-800 dark:text-slate-200">{Math.min((currentPage - 1) * pageSize + filteredRestaurants.length, totalRestaurants)}</span>
              {" "}of <span className="font-semibold text-slate-800 dark:text-slate-200">{totalRestaurants}</span>
            </div>
            <div className="flex items-center gap-2">
              <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2.5 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20">
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
              <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">{currentPage} / {totalPages}</span>
              <button type="button" onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed">
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ====== DETAIL MODAL ====== */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Restaurant Details</DialogTitle>
          </DialogHeader>
          {selectedRestaurant ? (
            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              <div className="flex items-start gap-4">
                <img src={getRestaurantImage(selectedRestaurant)} alt={selectedRestaurant.restaurantName}
                  className="w-20 h-20 rounded-xl object-cover border border-slate-200 dark:border-slate-700 flex-shrink-0"
                  onError={(e) => { e.target.src = FALLBACK_IMAGE }} />
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedRestaurant.restaurantName}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    {[selectedRestaurant.area, selectedRestaurant.city, selectedRestaurant.state].filter(Boolean).join(", ") || "No location set"}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <StatusBadge status={String(selectedRestaurant.status || "pending").toLowerCase()} />
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{Number(selectedRestaurant.rating || 0).toFixed(1)}</span>
                      <span className="text-xs text-slate-400">({selectedRestaurant.totalRatings || 0} reviews)</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Owner Information</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950/30 flex items-center justify-center flex-shrink-0"><Building2 className="w-3.5 h-3.5 text-[#F84E04] dark:text-orange-400" /></div>
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Owner Name</p><p className="font-medium text-slate-900 dark:text-white">{selectedRestaurant.ownerName || "—"}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0"><Phone className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" /></div>
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Phone</p><p className="font-medium text-slate-900 dark:text-white">{selectedRestaurant.ownerPhone || selectedRestaurant.primaryContactNumber || "—"}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0"><Mail className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" /></div>
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Email</p><p className="font-medium text-slate-900 dark:text-white">{selectedRestaurant.ownerEmail || "—"}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0"><MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /></div>
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Zone</p><p className="font-medium text-slate-900 dark:text-white">{getZoneName(selectedRestaurant)}</p></div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-4">
                <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Business Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {selectedRestaurant.cuisines?.length > 0 && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Cuisines</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedRestaurant.cuisines.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 text-xs font-medium bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-full text-slate-700 dark:text-slate-300">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <div><p className="text-xs text-slate-500 dark:text-slate-400">Operating Hours</p><p className="font-medium text-slate-900 dark:text-white">{selectedRestaurant.openingTime || "09:00"} — {selectedRestaurant.closingTime || "22:00"}</p></div>
                  </div>

                  <div><p className="text-xs text-slate-500 dark:text-slate-400">Restaurant Type</p><p className="font-medium text-slate-900 dark:text-white">{selectedRestaurant.restaurantType || (selectedRestaurant.pureVegRestaurant ? "Veg" : "Both")}</p></div>
                </div>
              </div>

              {selectedRestaurant.status === "rejected" && selectedRestaurant.rejectionReason && (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" /><h4 className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Rejection Reason</h4></div>
                  <p className="text-sm text-red-800 dark:text-red-300">{selectedRestaurant.rejectionReason}</p>
                </div>
              )}

              {String(selectedRestaurant.status || "").toLowerCase() === "pending" && (
                <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button onClick={() => { setShowDetailModal(false); handleApproveClick(selectedRestaurant) }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm">
                    <ShieldCheck className="w-4 h-4" /> Approve
                  </button>
                  <button onClick={() => { setShowDetailModal(false); handleRejectClick(selectedRestaurant) }}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors shadow-sm">
                    <ShieldX className="w-4 h-4" /> Reject
                  </button>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ====== EDIT MODAL ====== */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Edit Restaurant</DialogTitle>
          </DialogHeader>
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            <RestaurantFormFields form={editForm} setForm={setEditForm} zones={zones} setSelectedImageFile={setSelectedImageFile} imagePreviewUrl={imagePreviewUrl} setImagePreviewUrl={setImagePreviewUrl} />
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowEditModal(false)} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleEditSave} disabled={saving}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#F84E04] text-white hover:bg-[#d84303] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== CREATE MODAL ====== */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Add New Restaurant</DialogTitle>
          </DialogHeader>
          <div className="p-6 max-h-[75vh] overflow-y-auto">
            <RestaurantFormFields form={createForm} setForm={setCreateForm} zones={zones} setSelectedImageFile={setSelectedImageFile} imagePreviewUrl={imagePreviewUrl} setImagePreviewUrl={setImagePreviewUrl} />
            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
              <button onClick={() => setShowCreateModal(false)} disabled={creating}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleCreateSave} disabled={creating}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#F84E04] text-white hover:bg-[#d84303] transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create Restaurant
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== APPROVE DIALOG ====== */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Approve Restaurant</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl mb-4">
              <ShieldCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Confirm Approval</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">This will approve <strong>{actionTarget?.restaurantName}</strong> and they will start appearing on the user app.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowApproveDialog(false)} disabled={actionLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmApprove} disabled={actionLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Approve
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== REJECT DIALOG ====== */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Reject Restaurant</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-4">
              <ShieldX className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">Rejecting "{actionTarget?.restaurantName}"</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">This restaurant will not appear on the user app.</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Rejection Reason</label>
              <textarea value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Provide a reason for rejection..." rows={3}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none" />
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowRejectDialog(false)} disabled={actionLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmReject} disabled={actionLoading}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Reject
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE DIALOG ====== */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
          <DialogHeader><DialogTitle className="text-lg font-semibold text-slate-900 dark:text-white">Delete Restaurant</DialogTitle></DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl mb-4">
              <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-200">Permanent Deletion</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">This will permanently delete <strong>{deleteTarget?.restaurantName}</strong> and all associated data. This action cannot be undone.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setShowDeleteDialog(false)} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Delete Permanently
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// Reusable form fields component defined outside the parent to avoid focus loss on every keystroke
const RestaurantFormFields = ({ form, setForm, zones = [], setSelectedImageFile, imagePreviewUrl, setImagePreviewUrl }) => (
  <div className="space-y-4">
    {/* Restaurant Image Upload */}
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Restaurant Image</label>
      <div className="flex items-start gap-4">
        {imagePreviewUrl ? (
          <div className="relative w-24 h-24 rounded-xl overflow-hidden border-2 border-orange-200 dark:border-orange-950/30 flex-shrink-0">
            <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
            <button type="button" onClick={() => { setSelectedImageFile?.(null); setImagePreviewUrl?.(""); setForm((p) => ({ ...p, profileImage: "" })) }}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600 transition-colors shadow">✕</button>
          </div>
        ) : (
          <div className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center flex-shrink-0 bg-slate-50 dark:bg-slate-800/50">
            <span className="text-xs text-slate-400 dark:text-slate-500 text-center px-1">No image</span>
          </div>
        )}
        <div className="flex-1">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0] || null
              setSelectedImageFile?.(file)
              if (file) {
                setImagePreviewUrl?.(URL.createObjectURL(file))
              } else {
                setImagePreviewUrl?.(form.profileImage || "")
              }
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white file:mr-3 file:rounded file:border-0 file:bg-orange-50 file:px-3 file:py-1.5 file:text-sm file:text-[#F84E04] file:font-medium dark:bg-slate-800 dark:border-slate-700 dark:text-white dark:file:bg-slate-700 dark:file:text-white hover:file:bg-orange-100 dark:hover:file:bg-slate-600 transition-colors"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Upload restaurant image (shown on user side)</p>
        </div>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Restaurant Name *</label>
        <input type="text" value={form.restaurantName} onChange={(e) => setForm((p) => ({ ...p, restaurantName: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="Enter restaurant name" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner Name *</label>
        <input type="text" value={form.ownerName} onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="Enter owner name" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner Phone</label>
        <input type="text" value={form.ownerPhone} onChange={(e) => setForm((p) => ({ ...p, ownerPhone: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="Enter phone number" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Owner Email</label>
        <input type="email" value={form.ownerEmail} onChange={(e) => setForm((p) => ({ ...p, ownerEmail: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="Enter email" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Area</label>
        <input type="text" value={form.area} onChange={(e) => setForm((p) => ({ ...p, area: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="Area / locality" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">City</label>
        <input type="text" value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="City" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State</label>
        <input type="text" value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="State" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Pincode</label>
        <input type="text" value={form.pincode} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="Pincode" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Zone</label>
        <select value={form.zoneId} onChange={(e) => setForm((p) => ({ ...p, zoneId: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]">
          <option value="">Global Zone</option>
          {zones.map((z) => (
            <option key={z._id || z.id} value={String(z._id || z.id)}>
              {z.name || z.zoneName || "Unnamed Zone"}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Cuisines</label>
        <input type="text" value={form.cuisines} onChange={(e) => setForm((p) => ({ ...p, cuisines: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]"
          placeholder="North Indian, Chinese, etc." />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Opening Time</label>
        <input type="time" value={form.openingTime} onChange={(e) => setForm((p) => ({ ...p, openingTime: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Closing Time</label>
        <input type="time" value={form.closingTime} onChange={(e) => setForm((p) => ({ ...p, closingTime: e.target.value }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Restaurant Type</label>
        <select value={form.restaurantType} onChange={(e) => setForm((p) => ({ ...p, restaurantType: e.target.value, pureVegRestaurant: e.target.value === "Veg" }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]">
          <option value="Veg">Veg</option>
          <option value="Non-Veg">Non-Veg</option>
          <option value="Both">Both</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status (Accepting Orders)</label>
        <select value={String(form.isAcceptingOrders)} onChange={(e) => setForm((p) => ({ ...p, isAcceptingOrders: e.target.value === "true" }))}
          className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-[#F84E04]">
          <option value="true">Active (Open)</option>
          <option value="false">Inactive (Force Closed)</option>
        </select>
      </div>
    </div>
  </div>
)

