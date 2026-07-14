import { useState, useEffect, useRef } from "react"
import { toast } from "sonner"
import { Loader } from "@googlemaps/js-api-loader"
import { MapPin, Plus, Trash2, Edit2, ShieldAlert, Sparkles, CheckCircle, XCircle, RefreshCw, ZoomIn, Info } from "lucide-react"
import { Button } from "@food/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@food/components/ui/card"
import { Input } from "@food/components/ui/input"
import { Label } from "@food/components/ui/label"
import { Switch } from "@food/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@food/components/ui/table"
import { getGoogleMapsApiKey } from "@food/utils/googleMapsApiKey"
import { adminAPI } from "@food/api"

export default function ZoneSetup() {
  const [zones, setZones] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [googleMapsKey, setGoogleMapsKey] = useState("")

  // Form State
  const [selectedZone, setSelectedZone] = useState(null)
  const [formData, setFormData] = useState({
    name: "",
    zoneName: "",
    country: "India",
    serviceLocation: "",
    unit: "kilometer",
    isActive: true,
    coordinates: []
  })

  // Map & Drawing States
  const [mapLoaded, setMapLoaded] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [drawPoints, setDrawPoints] = useState([])

  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const previewPolygonRef = useRef(null)
  const activePolygonRef = useRef(null)
  const mapClickListenerRef = useRef(null)

  // Load Google Maps API Key and Zones on mount
  useEffect(() => {
    getGoogleMapsApiKey().then((key) => {
      if (key) {
        setGoogleMapsKey(key)
        initializeGoogleMap(key)
      } else {
        toast.error("Google Maps API Key not configured in env.")
      }
    })
    fetchZones()
  }, [])

  const fetchZones = async () => {
    try {
      setLoading(true)
      const res = await adminAPI.getZones()
      if (res?.data?.success) {
        setZones(res.data.data?.zones || [])
      }
    } catch (err) {
      console.error("Error fetching zones:", err)
      toast.error("Failed to load active delivery zones.")
    } finally {
      setLoading(false)
    }
  }

  // Initialize Map
  const initializeGoogleMap = async (key) => {
    try {
      const loader = new Loader({
        apiKey: key,
        version: "weekly",
        libraries: ["places"]
      })
      const google = await loader.load()
      if (!mapContainerRef.current) return

      const defaultCenter = { lat: 22.7196, lng: 75.8577 } // Default: Indore
      const map = new google.maps.Map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        styles: [
          { featureType: "poi", stylers: [{ visibility: "simplified" }] }
        ]
      })

      mapInstanceRef.current = map
      setMapLoaded(true)
    } catch (err) {
      console.error("Error initializing Google Map:", err)
      toast.error("Could not load Google Maps client.")
    }
  }

  // Radial Sorting to prevent self-intersections
  const sortCoordinatesRadially = (points) => {
    if (points.length < 3) return points
    let sumLat = 0
    let sumLng = 0
    points.forEach((p) => {
      sumLat += p.latitude
      sumLng += p.longitude
    })
    const centerLat = sumLat / points.length
    const centerLng = sumLng / points.length

    return [...points].sort((a, b) => {
      const angleA = Math.atan2(a.latitude - centerLat, a.longitude - centerLng)
      const angleB = Math.atan2(b.latitude - centerLat, b.longitude - centerLng)
      return angleA - angleB
    })
  }

  // Set Map Cursor
  const setMapCursor = (cursorType) => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setOptions({ draggableCursor: cursorType })
    }
  }

  // Start Drawing Mode
  const handleStartDrawing = () => {
    if (!mapLoaded) return
    setIsDrawing(true)
    setDrawPoints([])
    cleanupDrawing()

    setMapCursor("crosshair")
    toast.info("Click on the map to define polygon vertices. Vertex dragging is active.")

    const map = mapInstanceRef.current
    const google = window.google

    // Initialize live preview polygon
    previewPolygonRef.current = new google.maps.Polygon({
      map: map,
      strokeColor: "#F84E04",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      fillColor: "#F84E04",
      fillOpacity: 0.25
    })

    // Listen to Map Clicks to add coordinates
    mapClickListenerRef.current = map.addListener("click", (e) => {
      const newCoord = {
        latitude: e.latLng.lat(),
        longitude: e.latLng.lng()
      }

      setDrawPoints((prev) => {
        const next = [...prev, newCoord]
        return sortCoordinatesRadially(next)
      })
    })
  }

  // Render temporary markers and update preview path
  useEffect(() => {
    if (!isDrawing || !mapLoaded || !window.google) return

    const google = window.google
    const map = mapInstanceRef.current

    // Clear previous markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    // Update Preview Polygon Path
    const pathCoords = drawPoints.map((p) => ({ lat: p.latitude, lng: p.longitude }))
    if (previewPolygonRef.current) {
      previewPolygonRef.current.setPath(pathCoords)
    }

    // Render draggable marker for each point
    markersRef.current = drawPoints.map((pt, idx) => {
      const marker = new google.maps.Marker({
        position: { lat: pt.latitude, lng: pt.longitude },
        map: map,
        draggable: true,
        title: `Vertex ${idx + 1}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: "#F84E04",
          fillOpacity: 1,
          strokeColor: "#FFFFFF",
          strokeWeight: 2
        }
      })

      // Realtime drag behavior
      const handleMarkerMove = () => {
        const pos = marker.getPosition()
        setDrawPoints((prev) => {
          const next = [...prev]
          next[idx] = { latitude: pos.lat(), longitude: pos.lng() }
          return sortCoordinatesRadially(next)
        })
      }

      marker.addListener("drag", handleMarkerMove)
      marker.addListener("dragend", handleMarkerMove)

      return marker
    })
  }, [drawPoints, isDrawing, mapLoaded])

  // End Drawing & Freeze Polygon (make editable natively)
  const handleFinishDrawing = () => {
    if (drawPoints.length < 3) {
      toast.error("Please add at least 3 coordinates to complete the zone polygon.")
      return
    }

    setIsDrawing(false)
    setMapCursor(null)

    // Remove Click Listener
    if (mapClickListenerRef.current) {
      window.google.maps.event.removeListener(mapClickListenerRef.current)
      mapClickListenerRef.current = null
    }

    // Cleanup markers
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    // Convert preview into a real editable polygon
    if (previewPolygonRef.current) {
      previewPolygonRef.current.setMap(null)
      previewPolygonRef.current = null
    }

    setFormData((prev) => ({ ...prev, coordinates: drawPoints }))
    renderEditablePolygon(drawPoints)
    toast.success("Drawing finished! You can now adjust vertices natively on the map.")
  }

  // Draw generic Google Maps Polygon for Edit Mode
  const renderEditablePolygon = (coordsList) => {
    if (!mapLoaded || !window.google) return

    const google = window.google
    const map = mapInstanceRef.current

    if (activePolygonRef.current) {
      activePolygonRef.current.setMap(null)
      activePolygonRef.current = null
    }

    const pathCoords = coordsList.map((c) => ({ lat: c.latitude, lng: c.longitude }))

    const polygon = new google.maps.Polygon({
      paths: pathCoords,
      map: map,
      strokeColor: "#0EA5E9",
      strokeOpacity: 0.8,
      strokeWeight: 3,
      fillColor: "#38BDF8",
      fillOpacity: 0.3,
      editable: true,
      draggable: false
    })

    activePolygonRef.current = polygon

    // Path update helper
    const updatePathState = () => {
      const path = polygon.getPath()
      const newCoords = []
      for (let i = 0; i < path.getLength(); i++) {
        const xy = path.getAt(i)
        newCoords.push({ latitude: xy.lat(), longitude: xy.lng() })
      }
      setFormData((prev) => ({ ...prev, coordinates: newCoords }))
    }

    const path = polygon.getPath()
    google.maps.event.addListener(path, "set_at", updatePathState)
    google.maps.event.addListener(path, "insert_at", updatePathState)
    google.maps.event.addListener(path, "remove_at", updatePathState)

    // Delete vertex on right-click
    google.maps.event.addListener(polygon, "rightclick", (e) => {
      if (e.vertex !== undefined) {
        const polyPath = polygon.getPath()
        if (polyPath.getLength() > 3) {
          polyPath.removeAt(e.vertex)
          updatePathState()
          toast.success("Vertex deleted.")
        } else {
          toast.error("Zone polygon must have at least 3 vertices.")
        }
      }
    })
  }

  // Cleanup drawing items
  const cleanupDrawing = () => {
    setMapCursor(null)
    if (mapClickListenerRef.current) {
      window.google.maps.event.removeListener(mapClickListenerRef.current)
      mapClickListenerRef.current = null
    }
    markersRef.current.forEach((m) => m.setMap(null))
    markersRef.current = []

    if (previewPolygonRef.current) {
      previewPolygonRef.current.setMap(null)
      previewPolygonRef.current = null
    }

    if (activePolygonRef.current) {
      activePolygonRef.current.setMap(null)
      activePolygonRef.current = null
    }
  }

  // Select Zone for Edit
  const handleSelectZone = (zone) => {
    setSelectedZone(zone)
    const normalizedCoords = zone.coordinates.map((c) => ({
      latitude: c.latitude,
      longitude: c.longitude
    }))

    setFormData({
      name: zone.name || "",
      zoneName: zone.zoneName || "",
      country: zone.country || "India",
      serviceLocation: zone.serviceLocation || "",
      unit: zone.unit || "kilometer",
      isActive: zone.isActive !== false,
      coordinates: normalizedCoords
    })

    setIsDrawing(false)
    cleanupDrawing()
    renderEditablePolygon(normalizedCoords)

    // Fit map to coordinates
    if (mapInstanceRef.current && normalizedCoords.length > 0 && window.google) {
      const bounds = new window.google.maps.LatLngBounds()
      normalizedCoords.forEach((c) => {
        bounds.extend({ lat: c.latitude, lng: c.longitude })
      })
      mapInstanceRef.current.fitBounds(bounds)
    }
  }

  // Cancel Edit / Reset form
  const handleResetForm = () => {
    setSelectedZone(null)
    setFormData({
      name: "",
      zoneName: "",
      country: "India",
      serviceLocation: "",
      unit: "kilometer",
      isActive: true,
      coordinates: []
    })
    setDrawPoints([])
    cleanupDrawing()
  }

  // Create or Update Zone
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      toast.error("Zone name is required.")
      return
    }
    if (formData.coordinates.length < 3) {
      toast.error("Please define a zone polygon with at least 3 vertices on the map.")
      return
    }

    try {
      setSubmitting(true)
      const payload = {
        name: formData.name.trim(),
        zoneName: formData.zoneName.trim() || formData.name.trim(),
        country: formData.country,
        serviceLocation: formData.serviceLocation.trim() || formData.name.trim(),
        unit: formData.unit,
        isActive: formData.isActive,
        coordinates: formData.coordinates
      }

      let res
      if (selectedZone) {
        res = await adminAPI.updateZone(selectedZone._id || selectedZone.id, payload)
      } else {
        res = await adminAPI.createZone(payload)
      }

      if (res?.data?.success) {
        toast.success(selectedZone ? "Zone updated successfully!" : "New service zone created!")
        fetchZones()
        handleResetForm()
      }
    } catch (err) {
      console.error("Error saving zone:", err)
      toast.error(err.response?.data?.message || "Failed to save delivery zone configuration.")
    } finally {
      setSubmitting(false)
    }
  }

  // Toggle active switch direct action
  const handleToggleActive = async (zone) => {
    try {
      const res = await adminAPI.updateZone(zone._id || zone.id, {
        isActive: !zone.isActive
      })
      if (res?.data?.success) {
        toast.success("Zone status updated.")
        fetchZones()
      }
    } catch (err) {
      console.error("Error toggling zone status:", err)
      toast.error("Failed to update status.")
    }
  }

  // Delete Zone
  const handleDeleteZone = async (id) => {
    if (!window.confirm("Are you sure you want to delete this service zone? Products mapped to this zone might become globally visible.")) return

    try {
      const res = await adminAPI.deleteZone(id)
      if (res?.data?.success) {
        toast.success("Zone removed successfully.")
        fetchZones()
        if (selectedZone && (selectedZone._id === id || selectedZone.id === id)) {
          handleResetForm()
        }
      }
    } catch (err) {
      console.error("Error deleting zone:", err)
      toast.error("Failed to delete zone.")
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-zinc-950 p-4 lg:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <MapPin className="h-6 w-6 text-[#F84E04]" /> Service Zone Configuration
            </h1>
            <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
              Define operational boundaries for Food, Grocery, Accessories, and Services.
            </p>
          </div>
          <Button
            onClick={fetchZones}
            variant="outline"
            size="sm"
            disabled={loading}
            className="w-fit"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh Zones
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* List of Zones */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-base font-bold flex items-center justify-between">
                  <span>Defined Service Zones</span>
                  <span className="text-xs bg-[#F84E04]/10 text-[#F84E04] px-2 py-0.5 rounded-full font-medium">
                    {zones.length} Active
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
                  </div>
                ) : zones.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <MapPin className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">No zones created yet</p>
                    <p className="text-xs text-slate-400 mt-1">Start drawing on the map to define your first service zone.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-slate-50/50">
                        <TableRow>
                          <TableHead className="font-semibold text-xs">Name</TableHead>
                          <TableHead className="font-semibold text-xs">Vertices</TableHead>
                          <TableHead className="font-semibold text-xs text-center">Status</TableHead>
                          <TableHead className="font-semibold text-xs text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {zones.map((zone) => {
                          const id = zone._id || zone.id
                          const isSelected = selectedZone?._id === id || selectedZone?.id === id
                          return (
                            <TableRow 
                              key={id} 
                              className={`hover:bg-slate-50/50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50/40 dark:bg-blue-950/20' : ''}`}
                              onClick={() => handleSelectZone(zone)}
                            >
                              <TableCell className="py-3 font-medium text-sm">
                                <span className="block text-slate-900 dark:text-white">{zone.name}</span>
                                <span className="text-xs text-slate-400 font-normal">{zone.serviceLocation || zone.country}</span>
                              </TableCell>
                              <TableCell className="py-3 text-xs text-slate-500 font-mono">
                                {zone.coordinates?.length || 0} pts
                              </TableCell>
                              <TableCell className="py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <Switch
                                  checked={zone.isActive}
                                  onCheckedChange={() => handleToggleActive(zone)}
                                  className="mx-auto"
                                />
                              </TableCell>
                              <TableCell className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-zinc-800"
                                    onClick={() => handleSelectZone(zone)}
                                  >
                                    <Edit2 className="h-3.5 w-3.5 text-slate-600 dark:text-zinc-400" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                                    onClick={() => handleDeleteZone(id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Instruction Card */}
            <Card className="bg-slate-900 text-white border-0 shadow-sm overflow-hidden relative">
              <div className="absolute right-0 bottom-0 opacity-10">
                <Sparkles className="h-32 w-32" />
              </div>
              <CardContent className="p-5 space-y-3 relative z-10">
                <h3 className="font-bold text-sm flex items-center gap-1.5 text-orange-400">
                  <Info className="h-4 w-4" /> Polygon Drawing Guide
                </h3>
                <ul className="text-xs space-y-2 text-slate-300 list-disc pl-4 leading-relaxed">
                  <li>Click <strong>Start Drawing</strong> to activate manual polygon selection.</li>
                  <li>Click anywhere on the map to place vertex points. Drag any marker to adjust its location in real time.</li>
                  <li>Click <strong>Finish Drawing</strong> to freeze points and make the polygon editable natively.</li>
                  <li>In edit mode, drag the small translucent white dots (ghost points) to insert new vertices.</li>
                  <li><strong>Right-click</strong> any vertex point on the map to delete it.</li>
                </ul>
              </CardContent>
            </Card>
          </div>

          {/* Map & Form Panel */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-sm border-slate-200">
              <CardHeader className="pb-4 border-b border-slate-100 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-bold">
                  {selectedZone ? `Edit Zone: ${formData.name}` : "Create New Service Zone"}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {isDrawing ? (
                    <Button
                      onClick={handleFinishDrawing}
                      className="bg-green-600 hover:bg-green-700 text-white font-semibold text-xs h-8"
                    >
                      Finish Drawing ({drawPoints.length})
                    </Button>
                  ) : (
                    <Button
                      onClick={handleStartDrawing}
                      className="bg-[#F84E04] hover:bg-[#F84E04]/90 text-white font-semibold text-xs h-8"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Start Drawing
                    </Button>
                  )}
                  {(selectedZone || formData.coordinates.length > 0 || drawPoints.length > 0) && (
                    <Button
                      onClick={handleResetForm}
                      variant="outline"
                      size="sm"
                      className="text-xs h-8"
                    >
                      Cancel / Reset
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                
                {/* Form fields */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="zone-name">Zone Display Name</Label>
                    <Input
                      id="zone-name"
                      value={formData.name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value, zoneName: e.target.value }))}
                      placeholder="e.g. North Zone, Indore Central"
                      disabled={isDrawing}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="zone-country">Country</Label>
                      <Input
                        id="zone-country"
                        value={formData.country}
                        onChange={(e) => setFormData((prev) => ({ ...prev, country: e.target.value }))}
                        placeholder="e.g. India"
                        disabled={isDrawing}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="zone-unit">Distance Unit</Label>
                      <select
                        id="zone-unit"
                        value={formData.unit}
                        onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                        className="w-full h-10 px-3 border border-slate-300 dark:border-slate-700 bg-white dark:bg-zinc-800 rounded-lg text-sm focus:outline-none"
                        disabled={isDrawing}
                      >
                        <option value="kilometer">Kilometers (km)</option>
                        <option value="miles">Miles (mi)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5 md:col-span-2">
                    <Label htmlFor="service-location">Service Location Detail</Label>
                    <Input
                      id="service-location"
                      value={formData.serviceLocation}
                      onChange={(e) => setFormData((prev) => ({ ...prev, serviceLocation: e.target.value }))}
                      placeholder="e.g. Indore Central Area (or leave empty to match zone name)"
                      disabled={isDrawing}
                    />
                  </div>

                  {/* Coordinates Info */}
                  <div className="md:col-span-2 flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="text-slate-600 dark:text-zinc-400">
                      <strong>Points Count:</strong> {formData.coordinates.length} vertices
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={formData.isActive}
                        onCheckedChange={(val) => setFormData((prev) => ({ ...prev, isActive: val }))}
                        disabled={isDrawing}
                      />
                      <span className="font-semibold text-slate-700 dark:text-zinc-300">Zone Enabled</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="md:col-span-2">
                    <Button
                      type="submit"
                      disabled={submitting || isDrawing || formData.coordinates.length < 3}
                      className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold"
                    >
                      {submitting ? "Saving Configuration..." : selectedZone ? "Update Zone Boundary" : "Create Zone boundary"}
                    </Button>
                  </div>
                </form>

                {/* Google Map Container */}
                <div className="space-y-2">
                  <Label className="font-semibold flex items-center gap-1.5">
                    Map Polygon Workspace
                    {isDrawing && (
                      <span className="text-[10px] bg-red-100 text-red-600 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                        Drawing Mode Active
                      </span>
                    )}
                  </Label>
                  <div 
                    ref={mapContainerRef} 
                    className="w-full aspect-video md:h-[450px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 overflow-hidden relative"
                  />
                </div>

              </CardContent>
            </Card>
          </div>

        </div>

      </div>
    </div>
  )
}
