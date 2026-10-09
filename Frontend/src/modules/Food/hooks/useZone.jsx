import { useState, useEffect, useCallback, useRef } from 'react'
import { zoneAPI } from '@food/api'
import { usePublicSocket } from './usePublicSocket'
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

const applyZonePayload = (data, { setZoneId, setZone, setZoneStatus, setMode }) => {
  if (data?.status === 'IN_SERVICE') {
    const isGlobal = data.mode === 'GLOBAL' || !data.zoneId || data.globalService === true;
    setZoneId(data.zoneId || null)
    setZone(data.zone || null)
    setZoneStatus('IN_SERVICE')
    if (setMode) setMode(isGlobal ? 'GLOBAL' : (data.mode || 'ZONE'))
    if (isGlobal) {
      localStorage.setItem('userGlobalService', 'true')
    } else {
      localStorage.removeItem('userGlobalService')
    }
    if (data.zoneId) {
      localStorage.setItem('userZoneId', data.zoneId)
      localStorage.setItem('userZone', JSON.stringify(data.zone))
    } else {
      localStorage.removeItem('userZoneId')
      localStorage.removeItem('userZone')
    }
  } else {
    setZoneId(null)
    setZone(null)
    setZoneStatus('OUT_OF_SERVICE')
    if (setMode) setMode(data?.mode || 'ZONE')
    localStorage.removeItem('userZoneId')
    localStorage.removeItem('userZone')
    localStorage.removeItem('userGlobalService')
  }
}


/**
 * Hook to detect and manage user's zone based on location
 * Automatically detects zone when location is available
 */
export function useZone(location) {
  const [zoneId, setZoneId] = useState(null)
  const [zoneStatus, setZoneStatus] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('userGlobalService') === 'true') {
      return 'IN_SERVICE'
    }
    if (typeof window !== 'undefined' && localStorage.getItem('userZoneId')) {
      return 'IN_SERVICE'
    }
    return 'loading'
  })
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('userGlobalService') === 'true') {
      return 'GLOBAL'
    }
    if (typeof window !== 'undefined' && localStorage.getItem('userZoneId')) {
      return 'ZONE'
    }
    return null
  })
  const [zone, setZone] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const prevCoordsRef = useRef({ latitude: null, longitude: null })
  const debounceTimerRef = useRef(null)

  // Detect zone when location is available
  const detectZone = useCallback(async (lat, lng) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      if (typeof window !== 'undefined' && localStorage.getItem('userGlobalService') === 'true') {
        setZoneStatus('IN_SERVICE');
        setMode('GLOBAL');
        setZoneId(null);
        setZone(null);
        return;
      }
      setZoneStatus("OUT_OF_SERVICE");
      setMode("ZONE");
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
          applyZonePayload(cached.payload, { setZoneId, setZone, setZoneStatus, setMode })
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

      // Respect the backend's response — do NOT override OUT_OF_SERVICE with a fake zone.
      if (key) zoneCache.set(key, { ts: now, payload: data })
      applyZonePayload(data, { setZoneId, setZone, setZoneStatus, setMode })
    } catch (err) {
      debugError("Error detecting zone:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to detect zone",
      );

      if (typeof window !== 'undefined' && localStorage.getItem('userGlobalService') === 'true') {
        setZoneStatus('IN_SERVICE');
        setMode('GLOBAL');
        setZoneId(null);
        setZone(null);
        return;
      }

      // Try to use previously verified cached zone on network error (not on OUT_OF_SERVICE)
      const cachedZoneId = localStorage.getItem("userZoneId");
      if (cachedZoneId) {
        const cachedZone = localStorage.getItem("userZone");
        setZoneId(cachedZoneId);
        setZone(cachedZone ? JSON.parse(cachedZone) : null);
        setZoneStatus("IN_SERVICE");
        setMode("ZONE");
      } else {
        setZoneId(null);
        setZone(null);
        setZoneStatus("OUT_OF_SERVICE");
        setMode(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // On mount: Check authoritative public global service toggle from backend
  useEffect(() => {
    let isMounted = true
    zoneAPI.getPublicGlobalServiceSetting()
      .then((res) => {
        if (!isMounted) return
        const isGlobal = res?.data?.data?.globalFoodServiceEnabled === true
        if (isGlobal) {
          localStorage.setItem('userGlobalService', 'true')
          setZoneStatus('IN_SERVICE')
          setMode('GLOBAL')
          setZoneId(null)
          setZone(null)
        } else {
          localStorage.removeItem('userGlobalService')
        }
      })
      .catch(() => {})
    return () => { isMounted = false }
  }, [])

  // Real-time synchronization via Socket.IO: listen for admin toggling Global Service
  const socketListeners = useRef({
    'settings:update': (payload) => {
      if (payload?.action === 'global-service-update') {
        const isGlobal = payload?.data?.globalFoodServiceEnabled === true
        zoneCache.clear()
        if (isGlobal) {
          localStorage.setItem('userGlobalService', 'true')
          setZoneStatus('IN_SERVICE')
          setMode('GLOBAL')
          setZoneId(null)
          setZone(null)
        } else {
          localStorage.removeItem('userGlobalService')
          const lat = roundCoord(location?.latitude, 6)
          const lng = roundCoord(location?.longitude, 6)
          if (Number.isFinite(lat) && Number.isFinite(lng)) {
            detectZone(lat, lng)
          } else {
            setZoneStatus('OUT_OF_SERVICE')
            setMode('ZONE')
          }
        }
      }
    }
  })
  usePublicSocket(socketListeners.current)

  // Auto-detect zone when location changes
  useEffect(() => {
    const lat = roundCoord(location?.latitude, 6)
    const lng = roundCoord(location?.longitude, 6)

    // Check if coordinates have changed significantly (~80-90m threshold to prevent jitter re-triggers)
    const coordThreshold = 0.0008;
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
      // Check if global service is active first!
      if (typeof window !== 'undefined' && localStorage.getItem('userGlobalService') === 'true') {
        setZoneStatus('IN_SERVICE')
        setMode('GLOBAL')
        setZoneId(null)
        setZone(null)
      } else {
        const cachedZoneId = localStorage.getItem("userZoneId");
        if (cachedZoneId) {
          const cachedZone = localStorage.getItem("userZone");
          setZoneId(cachedZoneId);
          setZone(cachedZone ? JSON.parse(cachedZone) : null);
          setZoneStatus("IN_SERVICE");
          setMode("ZONE");
        } else {
          setZoneStatus("OUT_OF_SERVICE");
          setZoneId(null);
          setZone(null);
        }
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
    mode,
    loading,
    error,
    isInService: zoneStatus === "IN_SERVICE",
    isOutOfService: zoneStatus === "OUT_OF_SERVICE",
    refreshZone,
  };
}
