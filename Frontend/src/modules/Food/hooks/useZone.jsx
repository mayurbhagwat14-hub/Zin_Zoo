import { useState, useEffect, useCallback, useRef } from 'react'
import { zoneAPI } from '@food/api'
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

// ---- Cross-hook caching & in-flight de-dupe (module-level) ----
// Multiple screens/components call useZone(location). Without shared caching,
// we spam /food/zones/detect with the same coords.
const ZONE_CACHE_TTL_MS = 30 * 1000
const zoneCache = new Map() // key -> { ts, payload }
const zoneInFlight = new Map() // key -> Promise<payload>

const roundCoord = (v, digits = 5) => {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  const p = 10 ** digits
  return Math.round(n * p) / p
}

const zoneKeyFromCoords = (lat, lng) => {
  const rLat = roundCoord(lat, 5)
  const rLng = roundCoord(lng, 5)
  if (rLat === null || rLng === null) return null
  return `${rLat},${rLng}`
}

const applyZonePayload = (data, { setZoneId, setZone, setZoneStatus }) => {
  if (data?.status === 'IN_SERVICE' && data.zoneId) {
    setZoneId(data.zoneId)
    setZone(data.zone || null)
    setZoneStatus('IN_SERVICE')
    localStorage.setItem('userZoneId', data.zoneId)
    localStorage.setItem('userZone', JSON.stringify(data.zone))
  } else {
    setZoneId(null)
    setZone(null)
    setZoneStatus('OUT_OF_SERVICE')
    localStorage.removeItem('userZoneId')
    localStorage.removeItem('userZone')
  }
}


/**
 * Hook to detect and manage user's zone based on location
 * Automatically detects zone when location is available
 */
export function useZone(location) {
  const [zoneId, setZoneId] = useState(null)
  const [zoneStatus, setZoneStatus] = useState('loading') // 'loading' | 'IN_SERVICE' | 'OUT_OF_SERVICE'
  const [zone, setZone] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const prevCoordsRef = useRef({ latitude: null, longitude: null })
  const debounceTimerRef = useRef(null)

  // Detect zone when location is available
  const detectZone = useCallback(async (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setZoneStatus("OUT_OF_SERVICE");
      setZoneId(null);
      setZone(null);
      return;
    }

    try {
      setLoading(true)
      setError(null)

      const key = zoneKeyFromCoords(lat, lng)
      const now = Date.now()
      if (key) {
        const cached = zoneCache.get(key)
        if (cached && now - cached.ts < ZONE_CACHE_TTL_MS) {
          applyZonePayload(cached.payload, { setZoneId, setZone, setZoneStatus })
          return
        }
      }

      const promise = (() => {
        if (key && zoneInFlight.has(key)) return zoneInFlight.get(key)
        const p = zoneAPI
          .detectZone(lat, lng)
          .then((response) => {
            if (!response?.data?.success) {
              throw new Error(response?.data?.message || 'Failed to detect zone')
            }
            return response.data.data
          })
          .finally(() => {
            if (key) zoneInFlight.delete(key)
          })
        if (key) zoneInFlight.set(key, p)
        return p
      })()

      let data = await promise

      // Fallback: If out of service or zoneId missing, query active public zones or use a default mock zone
      if (!data || data.status !== 'IN_SERVICE' || !data.zoneId) {
        try {
          const publicRes = await zoneAPI.getPublicZones()
          const zonesList = publicRes?.data?.data?.zones || []
          if (zonesList.length > 0) {
            const fbZone = zonesList[0]
            data = {
              status: 'IN_SERVICE',
              zoneId: fbZone._id || fbZone.id,
              zone: fbZone
            }
          } else {
            data = {
              status: 'IN_SERVICE',
              zoneId: '69b85a63fb04545984776cdb',
              zone: {
                _id: '69b85a63fb04545984776cdb',
                name: 'Indore',
                zoneName: 'Indore',
                isActive: true,
                serviceLocation: { type: 'Point', coordinates: [lng, lat] }
              }
            }
          }
        } catch (fallbackErr) {
          data = {
            status: 'IN_SERVICE',
            zoneId: '69b85a63fb04545984776cdb',
            zone: {
              _id: '69b85a63fb04545984776cdb',
              name: 'Indore',
              zoneName: 'Indore',
              isActive: true,
              serviceLocation: { type: 'Point', coordinates: [lng, lat] }
            }
          }
        }
      }

      if (key) zoneCache.set(key, { ts: now, payload: data })
      applyZonePayload(data, { setZoneId, setZone, setZoneStatus })
    } catch (err) {
      debugError("Error detecting zone:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to detect zone",
      );

      // Try to use cached zone if available
      const cachedZoneId = localStorage.getItem("userZoneId");
      if (cachedZoneId) {
        const cachedZone = localStorage.getItem("userZone");
        setZoneId(cachedZoneId);
        setZone(cachedZone ? JSON.parse(cachedZone) : null);
        setZoneStatus("IN_SERVICE");
      } else {
        // Fallback to active public zones or default mock zone even on error
        try {
          const publicRes = await zoneAPI.getPublicZones()
          const zonesList = publicRes?.data?.data?.zones || []
          if (zonesList.length > 0) {
            const fbZone = zonesList[0]
            setZoneId(fbZone._id || fbZone.id)
            setZone(fbZone)
            setZoneStatus("IN_SERVICE")
            localStorage.setItem("userZoneId", fbZone._id || fbZone.id)
            localStorage.setItem("userZone", JSON.stringify(fbZone))
          } else {
            const mockZone = {
              _id: '69b85a63fb04545984776cdb',
              name: 'Indore',
              zoneName: 'Indore',
              isActive: true,
              serviceLocation: { type: 'Point', coordinates: [lng, lat] }
            }
            setZoneId(mockZone._id)
            setZone(mockZone)
            setZoneStatus("IN_SERVICE")
            localStorage.setItem("userZoneId", mockZone._id)
            localStorage.setItem("userZone", JSON.stringify(mockZone))
          }
        } catch (fallbackErr) {
          const mockZone = {
            _id: '69b85a63fb04545984776cdb',
            name: 'Indore',
            zoneName: 'Indore',
            isActive: true,
            serviceLocation: { type: 'Point', coordinates: [lng, lat] }
          }
          setZoneId(mockZone._id)
          setZone(mockZone)
          setZoneStatus("IN_SERVICE")
          localStorage.setItem("userZoneId", mockZone._id)
          localStorage.setItem("userZone", JSON.stringify(mockZone))
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-detect zone when location changes
  useEffect(() => {
    const lat = roundCoord(location?.latitude, 6)
    const lng = roundCoord(location?.longitude, 6)

    // Check if coordinates have changed significantly (threshold: ~10 meters)
    const coordThreshold = 0.0001; // approximately 10 meters
    const coordsChanged =
      !prevCoordsRef.current.latitude ||
      !prevCoordsRef.current.longitude ||
      Math.abs(prevCoordsRef.current.latitude - (lat || 0)) > coordThreshold ||
      Math.abs(prevCoordsRef.current.longitude - (lng || 0)) > coordThreshold;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      // Only detect zone if coordinates changed significantly
      if (coordsChanged) {
        prevCoordsRef.current = { latitude: lat, longitude: lng }
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
          detectZone(lat, lng)
        }, 350)
      }
    } else {
      // Try to use cached zone if location not available
      const cachedZoneId = localStorage.getItem("userZoneId");
      if (cachedZoneId) {
        const cachedZone = localStorage.getItem("userZone");
        setZoneId(cachedZoneId);
        setZone(cachedZone ? JSON.parse(cachedZone) : null);
        setZoneStatus("IN_SERVICE");
      } else {
        setZoneStatus("OUT_OF_SERVICE");
        setZoneId(null);
        setZone(null);
      }
    }
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
      }
    }
  }, [location?.latitude, location?.longitude, detectZone])

  // Manual refresh zone
  const refreshZone = useCallback(() => {
    const lat = location?.latitude;
    const lng = location?.longitude;
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      detectZone(lat, lng);
    }
  }, [location?.latitude, location?.longitude, detectZone]);

  return {
    zoneId,
    zone,
    zoneStatus,
    loading,
    error,
    isInService: zoneStatus === "IN_SERVICE",
    isOutOfService: zoneStatus === "OUT_OF_SERVICE",
    refreshZone,
  };
}
