import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  GoogleMap, 
  useJsApiLoader, 
  Marker, 
  InfoWindow, 
  DirectionsService, 
  DirectionsRenderer 
} from '@react-google-maps/api';
import { MapPin, Navigation, Compass, AlertCircle, RefreshCw } from 'lucide-react';
import { getGoogleMapsApiKey } from '@food/utils/googleMapsApiKey';

const LIBRARIES = ['geometry', 'places'];

const DESTINATION_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24">
  <defs>
    <linearGradient id="pinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF5A5F" />
      <stop offset="100%" stop-color="#C1171C" />
    </linearGradient>
  </defs>
  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="url(#pinGrad)" filter="drop-shadow(0px 3px 3px rgba(0,0,0,0.3))"/>
  <circle cx="12" cy="9" r="3" fill="#FFFFFF"/>
</svg>
`)}`;

const USER_PIN_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24">
  <circle cx="12" cy="12" r="10" fill="#2563EB" fill-opacity="0.15" />
  <circle cx="12" cy="12" r="6" fill="#FFFFFF" filter="drop-shadow(0px 2px 2px rgba(0,0,0,0.2))"/>
  <circle cx="12" cy="12" r="4" fill="#2563EB" />
</svg>
`)}`;

export default function GoogleMapsMarker({
  latitude = 22.7196, // default Indore coord
  longitude = 75.8577,
  locationName = "Selected Location",
  locationAddress = "Address Details",
  height = "450px",
  zoomLevel = 15,
  showRouteOption = true
}) {
  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [directions, setDirections] = useState(null);
  const [isDirectionsRequested, setIsDirectionsRequested] = useState(false);
  const [infoWindowOpen, setInfoWindowOpen] = useState(true);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapError, setMapError] = useState(null);
  const [apiKey, setApiKey] = useState("");

  const destination = useMemo(() => ({ lat: Number(latitude), lng: Number(longitude) }), [latitude, longitude]);

  // Load API Key
  useEffect(() => {
    getGoogleMapsApiKey().then(key => {
      setApiKey(key || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "");
    }).catch(err => {
      setMapError("Failed to resolve Google Maps API Key.");
    });
  }, []);

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
  });

  // Track User Location
  const requestUserLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userPos = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(userPos);
        setGpsLoading(false);
        
        // Fit map bounds to show both user and destination if route exists
        if (map) {
          const bounds = new window.google.maps.LatLngBounds();
          bounds.extend(userPos);
          bounds.extend(destination);
          map.fitBounds(bounds, { top: 80, bottom: 80, left: 80, right: 80 });
        }
      },
      (error) => {
        setGpsLoading(false);
        console.error("GPS location access error:", error);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [map, destination]);

  // Auto-request location if option is active
  useEffect(() => {
    if (showRouteOption) {
      requestUserLocation();
    }
  }, [showRouteOption]);

  const handleMarkerClick = useCallback(() => {
    setInfoWindowOpen(true);
    if (map) {
      map.panTo(destination);
      map.setZoom(zoomLevel);
    }
  }, [map, destination, zoomLevel]);

  const handleNavigateClick = useCallback(() => {
    const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`;
    window.open(navUrl, '_blank', 'noopener,noreferrer');
  }, [destination]);

  const onMapLoad = useCallback((mapInstance) => {
    setMap(mapInstance);
  }, []);

  const handleRecenter = useCallback(() => {
    if (map) {
      map.panTo(destination);
      map.setZoom(zoomLevel);
      setInfoWindowOpen(true);
    }
  }, [map, destination, zoomLevel]);

  // Callback for Directions Service
  const directionsCallback = useCallback((response, status) => {
    if (status === 'OK' && response) {
      setDirections(response);
      setIsDirectionsRequested(true);
    } else {
      console.warn("Directions request failed status:", status);
    }
  }, []);

  const directionsServiceOptions = useMemo(() => {
    if (!userLocation || !showRouteOption || isDirectionsRequested) return null;
    return {
      origin: userLocation,
      destination: destination,
      travelMode: 'DRIVING'
    };
  }, [userLocation, destination, showRouteOption, isDirectionsRequested]);

  if (loadError || mapError) {
    return (
      <div 
        style={{ height }} 
        className="w-full bg-red-50/50 rounded-2xl border border-red-200/60 flex flex-col items-center justify-center p-6 text-center shadow-inner"
      >
        <AlertCircle className="w-10 h-10 text-red-500 mb-3" />
        <h3 className="text-sm font-bold text-slate-800">Map Initialization Failed</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">{loadError?.message || mapError || "Could not load Google Maps client library."}</p>
      </div>
    );
  }

  if (!isLoaded || !apiKey) {
    return (
      <div 
        style={{ height }} 
        className="w-full bg-slate-100 rounded-2xl flex flex-col items-center justify-center p-6 text-center animate-pulse"
      >
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mb-3" />
        <p className="text-xs font-semibold text-slate-500">Initializing Premium Map Viewer...</p>
      </div>
    );
  }

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-md border border-slate-200" style={{ height }}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={destination}
        zoom={zoomLevel}
        onLoad={onMapLoad}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: true,
          scaleControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'on' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] }
          ]
        }}
      >
        {/* Destination Marker */}
        <Marker
          position={destination}
          onClick={handleMarkerClick}
          icon={{
            url: DESTINATION_PIN_SVG,
            scaledSize: new window.google.maps.Size(44, 44),
            anchor: new window.google.maps.Point(22, 44)
          }}
          animation={window.google.maps.Animation.DROP}
        />

        {/* User Current Location Marker */}
        {userLocation && (
          <Marker
            position={userLocation}
            icon={{
              url: USER_PIN_SVG,
              scaledSize: new window.google.maps.Size(36, 36),
              anchor: new window.google.maps.Point(18, 18)
            }}
          />
        )}

        {/* Route Drawer */}
        {directionsServiceOptions && (
          <DirectionsService
            options={directionsServiceOptions}
            callback={directionsCallback}
          />
        )}

        {directions && (
          <DirectionsRenderer
            directions={directions}
            options={{
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: '#3b82f6',
                strokeWeight: 5,
                strokeOpacity: 0.85
              }
            }}
          />
        )}

        {/* Info Window Details */}
        {infoWindowOpen && (
          <InfoWindow
            position={destination}
            onCloseClick={() => setInfoWindowOpen(false)}
            options={{ pixelOffset: new window.google.maps.Size(0, -38) }}
          >
            <div className="p-2 min-w-[200px] text-slate-800">
              <div className="flex items-start gap-2 mb-1.5">
                <MapPin className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">{locationName}</h4>
                  <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{locationAddress}</p>
                </div>
              </div>
              
              <button
                onClick={handleNavigateClick}
                className="w-full mt-2 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center justify-center gap-1 transition-colors"
              >
                <Navigation className="w-3 h-3 text-white fill-white rotate-45" />
                Navigate in Google Maps
              </button>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Floating Action Controls */}
      <div className="absolute bottom-4 left-4 flex flex-col gap-2 z-[10]">
        <button
          type="button"
          onClick={handleRecenter}
          className="p-2.5 bg-white/95 hover:bg-white text-slate-700 rounded-xl shadow-lg border border-slate-200/60 transition-all flex items-center justify-center"
          title="Recenter Destination"
        >
          <Compass className="w-4 h-4" />
        </button>

        {showRouteOption && (
          <button
            type="button"
            onClick={requestUserLocation}
            disabled={gpsLoading}
            className="p-2.5 bg-white/95 hover:bg-white text-slate-700 rounded-xl shadow-lg border border-slate-200/60 transition-all flex items-center justify-center disabled:opacity-50"
            title="Locate Me"
          >
            <RefreshCw className={`w-4 h-4 ${gpsLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}
