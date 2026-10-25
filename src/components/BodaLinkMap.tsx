import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AdvancedMarker,
  Map as GoogleMap,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Bike, MapPin, Navigation } from 'lucide-react';

export interface GeoPoint {
  lat: number;
  lng: number;
  address?: string;
}

export interface OnlineRiderPin {
  userId: number;
  fullName: string;
  currentLat: number | null;
  currentLng: number | null;
  operatingZone: string;
  averageRating: string;
  motorcycle?: {
    registrationNumber: string;
    make: string;
    model: string;
    hasInsulatedGroceryBox: boolean;
  } | null;
}

function checkQuotaError(err: unknown) {
  const msg = String((err as any)?.message || err || '');
  if (
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('QuotaExceededError') ||
    msg.includes('OverQuotaMapError') ||
    msg.includes('429')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

interface RouteOverlayProps {
  pickup: GeoPoint | null;
  destination: GeoPoint | null;
  onRouteComputed?: (metrics: { distanceKm: number; durationMin: number }) => void;
}

function RouteOverlay({ pickup, destination, onRouteComputed }: RouteOverlayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!routesLib || !map || !pickup || !destination) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const sameSpot =
      Math.abs(pickup.lat - destination.lat) < 0.0002 &&
      Math.abs(pickup.lng - destination.lng) < 0.0002;
    if (sameSpot) return;

    const request = {
      origin: { lat: pickup.lat, lng: pickup.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: 'DRIVING',
      fields: ['path', 'distanceMeters', 'durationMillis', 'viewport'],
    };

    (routesLib.Route as any)
      .computeRoutes(request)
      .then((res: { routes?: any[] }) => {
        const primaryRoute = res?.routes?.[0];
        if (!primaryRoute) return;

        const createdPolys: google.maps.Polyline[] = primaryRoute.createPolylines();
        createdPolys.forEach((poly) => {
          poly.setOptions({
            strokeColor: '#059669',
            strokeOpacity: 0.92,
            strokeWeight: 5,
          });
          poly.setMap(map);
        });
        polylinesRef.current = createdPolys;

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, 56);
        }

        const distanceKm = Number(((primaryRoute.distanceMeters ?? 3200) / 1000).toFixed(2));
        const durationMin = Math.max(
          3,
          Math.round((primaryRoute.durationMillis ?? 600000) / 60000)
        );
        onRouteComputed?.({ distanceKm, durationMin });
      })
      .catch((err: unknown) => {
        console.error('Routes API computeRoutes error:', err);
        checkQuotaError(err);
      });

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [routesLib, map, pickup?.lat, pickup?.lng, destination?.lat, destination?.lng]);

  return null;
}

export function PlacesSearchField({
  label,
  value,
  placeholder,
  onSelectPlace,
}: {
  label: string;
  value: string;
  placeholder: string;
  onSelectPlace: (place: GeoPoint & { address: string }) => void;
}) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!placesLib || !focused) return;
    const trimmed = query.trim();
    if (trimmed.length < 2 || trimmed === value.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib;
      if (!sessionTokenRef.current) {
        sessionTokenRef.current = new AutocompleteSessionToken();
      }

      AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: trimmed,
        region: 'ke',
        sessionToken: sessionTokenRef.current,
      })
        .then((res: { suggestions: google.maps.places.AutocompleteSuggestion[] }) => {
          setSuggestions(res?.suggestions || []);
        })
        .catch((err: unknown) => {
          console.error('Places AutocompleteSuggestion error:', err);
          checkQuotaError(err);
        });
    }, 240);

    return () => window.clearTimeout(timer);
  }, [placesLib, query, focused, value]);

  const handleChoose = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!placesLib || !suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport'],
        });
        sessionTokenRef.current = null;
        setSuggestions([]);
        setFocused(false);

        const loc = place.location;
        if (loc) {
          const formatted =
            place.formattedAddress ||
            place.displayName ||
            suggestion.placePrediction.text.text;
          setQuery(formatted);
          onSelectPlace({
            lat: loc.lat(),
            lng: loc.lng(),
            address: formatted,
          });
        }
      } catch (err) {
        console.error('Place.fetchFields error:', err);
        checkQuotaError(err);
      }
    },
    [placesLib, onSelectPlace]
  );

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      <div className="relative">
        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 180)}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 transition-colors"
        />
      </div>
      {focused && suggestions.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
          {suggestions.map((s, idx) => (
            <li key={idx}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  void handleChoose(s);
                }}
                className="w-full text-left px-3.5 py-2.5 text-xs text-slate-700 hover:bg-slate-50 transition-colors min-h-[44px] flex items-center gap-2"
              >
                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="truncate">{s.placePrediction?.text.text}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BodaLinkLiveMap({
  pickup,
  destination,
  onlineRiders,
  activeRiderGps,
  onRouteComputed,
  onMapClickSelect,
  heightClass = 'h-[480px] lg:h-[580px]',
}: {
  pickup: GeoPoint | null;
  destination: GeoPoint | null;
  onlineRiders: OnlineRiderPin[];
  activeRiderGps?: { lat: number; lng: number; speedKmh?: number } | null;
  onRouteComputed?: (metrics: { distanceKm: number; durationMin: number }) => void;
  onMapClickSelect?: (point: GeoPoint) => void;
  heightClass?: string;
}) {
  const defaultNairobiCenter = { lat: -1.2833, lng: 36.8167 };

  return (
    <div className={`w-full ${heightClass} rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 relative`}>
      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={pickup || defaultNairobiCenter}
        defaultZoom={13}
        gestureHandling="greedy"
        streetViewControl={false}
        mapTypeControl={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        onClick={(ev) => {
          const latLng = ev.detail?.latLng;
          if (latLng && onMapClickSelect) {
            onMapClickSelect({ lat: latLng.lat, lng: latLng.lng });
          }
        }}
        className="w-full h-full"
      >
        <RouteOverlay
          pickup={pickup}
          destination={destination}
          onRouteComputed={onRouteComputed}
        />

        {pickup && (
          <AdvancedMarker position={{ lat: pickup.lat, lng: pickup.lng }} title="Pickup Location">
            <div className="flex items-center gap-1.5 bg-slate-900 text-white px-2.5 py-1.5 rounded-lg shadow-md text-xs font-medium">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pickup</span>
            </div>
          </AdvancedMarker>
        )}

        {destination && (
          <AdvancedMarker
            position={{ lat: destination.lat, lng: destination.lng }}
            title="Destination"
          >
            <div className="flex items-center gap-1.5 bg-emerald-700 text-white px-2.5 py-1.5 rounded-lg shadow-md text-xs font-medium">
              <MapPin className="w-3.5 h-3.5 text-white" />
              <span>Dropoff</span>
            </div>
          </AdvancedMarker>
        )}

        {onlineRiders.map((rider) => {
          if (typeof rider.currentLat !== 'number' || typeof rider.currentLng !== 'number') {
            return null;
          }
          return (
            <AdvancedMarker
              key={`rider-${rider.userId}`}
              position={{ lat: rider.currentLat, lng: rider.currentLng }}
              title={`${rider.fullName} · ${rider.motorcycle?.registrationNumber || 'Verified Boda'}`}
            >
              <div className="flex items-center gap-1 bg-white border border-slate-300 text-slate-900 px-2 py-1 rounded-lg shadow-sm text-[11px] font-medium">
                <Bike className="w-3.5 h-3.5 text-emerald-600" />
                <span className="tabular-nums">
                  {rider.motorcycle?.registrationNumber || rider.fullName.split(' ')[0]}
                </span>
              </div>
            </AdvancedMarker>
          );
        })}

        {activeRiderGps && (
          <AdvancedMarker
            position={{ lat: activeRiderGps.lat, lng: activeRiderGps.lng }}
            title="Assigned BodaLink Rider (Live GPS)"
          >
            <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 py-1.5 rounded-xl shadow-lg text-xs font-semibold">
              <Bike className="w-4 h-4" />
              <span className="tabular-nums">
                Rider Live · {Math.round(activeRiderGps.speedKmh || 34)} km/h
              </span>
            </div>
          </AdvancedMarker>
        )}
      </GoogleMap>
    </div>
  );
}
