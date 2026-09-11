import { useCallback, useEffect, useRef, useState } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { ArrowLeft, ChevronRight, Navigation, Loader2, Search, X, MapPin, AlertCircle, CheckCircle2 } from "lucide-react";
import type { DeliveryLocation } from "../../utils/validation";
import { isValidPincode, getDeliveryZone } from "../../data/deliveryZones";

// Default center: Coimbatore, Tamil Nadu
const DEFAULT_LAT = 11.0168;
const DEFAULT_LNG = 76.9558;

// Google Maps API Key provided by user
const GOOGLE_MAPS_API_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) || "AIzaSyB6qf6mqx6iOI5ZVWbWT1bUAIZabYK_jYs";

export interface MapLocationResult extends Omit<DeliveryLocation, "houseNo" | "landmark"> {}

interface MapLocationPickerProps {
  initialLat?: number | null;
  initialLng?: number | null;
  onConfirm: (result: MapLocationResult) => void;
  onClose: () => void;
}

let isGoogleConfigured = false;

// ─── Address Component Parser ────────────────────────────────────────────────
interface ParsedAddress {
  street: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  formattedAddress: string;
}

function extractPincode(components: google.maps.GeocoderAddressComponent[], formattedAddress: string): string {
  const comp = components.find((c) => c.types.includes("postal_code"));
  if (comp && comp.long_name && /^\d{6}$/.test(comp.long_name.trim())) {
    return comp.long_name.trim();
  }
  // Regex fallback from formatted address
  const match = formattedAddress.match(/\b(6\d{5})\b/);
  return match ? match[1] : "";
}

function parseGoogleAddressComponents(
  components: google.maps.GeocoderAddressComponent[],
  formattedAddress: string
): ParsedAddress {
  const get = (types: string[]) =>
    components.find((c) => types.some((t) => c.types.includes(t)))?.long_name ?? "";

  // Door number + street/road
  const streetNumber = get(["street_number", "premise"]);
  const route = get(["route", "sublocality_level_2"]);
  const street = [streetNumber, route].filter(Boolean).join(", ");

  // Neighbourhood / locality / area
  const area =
    get(["sublocality_level_1", "sublocality", "neighborhood", "political"]) ||
    get(["administrative_area_level_4", "administrative_area_level_3"]);

  const city = get(["locality"]) || get(["administrative_area_level_3"]) || "Coimbatore";
  const district = get(["administrative_area_level_2"]) || "Coimbatore";
  const state = get(["administrative_area_level_1"]) || "Tamil Nadu";
  const pincode = extractPincode(components, formattedAddress);

  return { street, area, city, district, state, pincode, formattedAddress };
}

// Fallback reverse geocoder in case Google Cloud project billing is not yet active
async function fallbackReverseGeocode(lat: number, lng: number): Promise<ParsedAddress | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
      { headers: { "Accept-Language": "en" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address || {};

    const street = [addr.house_number, addr.road || addr.street].filter(Boolean).join(", ");
    const area = addr.suburb || addr.neighbourhood || addr.residential || addr.village || "";
    const city = addr.city || addr.town || addr.municipality || "Coimbatore";
    const district = addr.county || addr.state_district || "Coimbatore";
    const state = addr.state || "Tamil Nadu";
    const formattedAddress = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    const match = formattedAddress.match(/\b(6\d{5})\b/);
    const pincode = addr.postcode || (match ? match[1] : "");

    return { street, area, city, district, state, pincode, formattedAddress };
  } catch {
    return null;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function MapLocationPicker({
  initialLat,
  initialLng,
  onConfirm,
  onClose,
}: MapLocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const startLat = initialLat && initialLat !== 0 ? initialLat : DEFAULT_LAT;
  const startLng = initialLng && initialLng !== 0 ? initialLng : DEFAULT_LNG;

  const [parsed, setParsed] = useState<ParsedAddress | null>(null);
  const [selectedLatLng, setSelectedLatLng] = useState<{ lat: number; lng: number } | null>(
    initialLat && initialLng ? { lat: initialLat, lng: initialLng } : null
  );
  const [loading, setLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [locating, setLocating] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // ── Reverse-geocode a lat/lng and update parsed state ──────────────────────
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setGeocoding(true);
    setSelectedLatLng({ lat, lng });

    // 1. Try Google Geocoding API first
    if (geocoderRef.current) {
      try {
        const res = await geocoderRef.current.geocode({ location: { lat, lng } });
        if (res.results && res.results.length > 0) {
          const first = res.results[0];
          const result = parseGoogleAddressComponents(first.address_components, first.formatted_address);
          setParsed(result);
          setGeocoding(false);
          return;
        }
      } catch (err) {
        console.warn("Google Geocoder encountered an error, falling back:", err);
      }
    }

    // 2. Fallback geocoder
    const fallbackResult = await fallbackReverseGeocode(lat, lng);
    if (fallbackResult) {
      setParsed(fallbackResult);
    } else {
      setParsed({
        street: "",
        area: "",
        city: "Coimbatore",
        district: "Coimbatore",
        state: "Tamil Nadu",
        pincode: "",
        formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      });
    }
    setGeocoding(false);
  }, []);

  // ── Move / place marker at given lat/lng ──────────────────────────────────
  const setMarkerAt = useCallback(
    (lat: number, lng: number, shouldGeocode = true) => {
      const position = { lat, lng };

      if (!mapRef.current) return;

      if (!markerRef.current) {
        markerRef.current = new google.maps.Marker({
          position,
          map: mapRef.current,
          draggable: true,
          animation: google.maps.Animation.DROP,
          icon: {
            path: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z",
            fillColor: "#00A651",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 2,
            anchor: new google.maps.Point(12, 22),
          },
        });

        markerRef.current.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const newLat = e.latLng.lat();
            const newLng = e.latLng.lng();
            reverseGeocode(newLat, newLng);
          }
        });
      } else {
        markerRef.current.setPosition(position);
        markerRef.current.setMap(mapRef.current);
      }

      if (shouldGeocode) {
        reverseGeocode(lat, lng);
      }
    },
    [reverseGeocode]
  );

  // ── Initialize Google Map & Autocomplete ───────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      try {
        if (!isGoogleConfigured) {
          setOptions({
            key: GOOGLE_MAPS_API_KEY,
            v: "weekly",
          });
          isGoogleConfigured = true;
        }

        const [{ Map }, { Geocoder }] = await Promise.all([
          importLibrary("maps") as Promise<google.maps.MapsLibrary>,
          importLibrary("geocoding") as Promise<google.maps.GeocodingLibrary>,
          importLibrary("places") as Promise<google.maps.PlacesLibrary>,
        ]);

        if (isCancelled || !mapContainerRef.current) return;

        geocoderRef.current = new Geocoder();

        const map = new Map(mapContainerRef.current, {
          center: { lat: startLat, lng: startLng },
          zoom: initialLat && initialLng ? 17 : 14,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        mapRef.current = map;

        // Click on map to place/move pin
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) {
            const lat = e.latLng.lat();
            const lng = e.latLng.lng();
            setMarkerAt(lat, lng, true);
          }
        });

        // Set up Places Autocomplete on search input
        if (searchInputRef.current) {
          const autocomplete = new google.maps.places.Autocomplete(searchInputRef.current, {
            componentRestrictions: { country: "in" },
            fields: ["geometry", "formatted_address", "address_components", "name"],
          });

          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (place.geometry?.location) {
              const lat = place.geometry.location.lat();
              const lng = place.geometry.location.lng();

              map.setCenter({ lat, lng });
              map.setZoom(17);
              setMarkerAt(lat, lng, false);

              if (place.address_components && place.formatted_address) {
                const parsedResult = parseGoogleAddressComponents(
                  place.address_components,
                  place.formatted_address
                );
                setParsed(parsedResult);
                setSelectedLatLng({ lat, lng });
              } else {
                reverseGeocode(lat, lng);
              }
            }
          });

          autocompleteRef.current = autocomplete;
        }

        // If initial location provided, drop marker and geocode
        if (initialLat && initialLng) {
          setMarkerAt(initialLat, initialLng, true);
        }

        setLoading(false);
      } catch (err) {
        console.error("Failed to load Google Maps SDK:", err);
        setLoading(false);
      }
    }

    initMap();

    return () => {
      isCancelled = true;
    };
  }, [startLat, startLng, initialLat, initialLng, setMarkerAt, reverseGeocode]);

  // ── "Use My Current Location" GPS button ──────────────────────────────────
  const handleCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (mapRef.current) {
          mapRef.current.setCenter({ lat, lng });
          mapRef.current.setZoom(17);
        }
        setMarkerAt(lat, lng, true);
        setLocating(false);
      },
      (err) => {
        console.warn("GPS Geolocation error:", err);
        setLocating(false);
        alert("Could not get your current location. Please ensure location permission is allowed.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // ── Delivery Pincode Validation ───────────────────────────────────────────
  const detectedPincode = parsed?.pincode || "";
  const isDeliverable = Boolean(detectedPincode && isValidPincode(detectedPincode));
  const deliveryZone = isDeliverable ? getDeliveryZone(detectedPincode) : null;
  const hasLocation = Boolean(selectedLatLng);

  // ── Confirm handler ───────────────────────────────────────────────────────
  const handleConfirm = () => {
    if (!selectedLatLng || !isDeliverable) return;

    const { lat, lng } = selectedLatLng;
    const finalParsed = parsed || {
      street: "",
      area: "",
      city: "Coimbatore",
      district: "Coimbatore",
      state: "Tamil Nadu",
      pincode: detectedPincode,
      formattedAddress: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    };

    onConfirm({
      lat,
      lng,
      formattedAddress: finalParsed.formattedAddress,
      street: finalParsed.street,
      area: finalParsed.area,
      city: finalParsed.city,
      district: finalParsed.district,
      state: finalParsed.state,
      pincode: finalParsed.pincode,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="map-picker-title"
    >
      {/* ── Top Bar ────────────────────────────────────────────────────────── */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#F0F0F0] flex-shrink-0">
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-full bg-[#F5F5F5] hover:bg-[#EEEEEE] text-[#111111] transition-colors cursor-pointer"
          aria-label="Back to checkout"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h2 id="map-picker-title" className="text-base font-bold text-[#111111] leading-none">
            Choose Delivery Location
          </h2>
          <p className="text-xs text-[#888888] mt-0.5">
            Search or tap anywhere on Google Maps to verify delivery location
          </p>
        </div>
      </div>

      {/* ── Places Search ──────────────────────────────────────────────────── */}
      <div className="bg-white px-4 py-3 border-b border-[#F0F0F0] flex-shrink-0">
        <div className="relative flex items-center">
          <Search size={16} className="absolute left-3.5 text-[#888888] pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search street, area, or landmark in Coimbatore…"
            className="w-full h-11 pl-10 pr-10 bg-[#F5F5F5] rounded-[12px] text-sm font-medium text-[#111111] placeholder-[#AAAAAA] focus:outline-none focus:ring-2 focus:ring-[#00A651]/30 transition-all"
            id="location-search-input"
            autoComplete="off"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 text-[#AAAAAA] cursor-pointer"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* ── Map ────────────────────────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-hidden bg-[#E5E3DF]">
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#E5E3DF] gap-3">
            <Loader2 size={30} className="animate-spin text-[#00A651]" />
            <p className="text-sm text-gray-500 font-medium">Loading Google Maps…</p>
          </div>
        )}

        {/* Map canvas */}
        <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" />

        {/* "Tap to place pin" prompt — shown only when no pin placed yet */}
        {!loading && !hasLocation && (
          <div
            className="absolute z-10 flex justify-center pointer-events-none"
            style={{ top: 14, left: 0, right: 0 }}
          >
            <div
              style={{
                background: "rgba(0,0,0,0.82)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 20,
                padding: "8px 18px",
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
              }}
            >
              👆 Tap on map or drag pin to your delivery address
            </div>
          </div>
        )}

        {/* Geocoding spinner overlay on map */}
        {geocoding && (
          <div className="absolute top-4 right-4 z-10 bg-white rounded-full px-3.5 py-1.5 flex items-center gap-2 shadow-md border border-gray-100">
            <Loader2 size={14} className="animate-spin text-[#00A651]" />
            <span className="text-xs font-bold text-[#333333]">Detecting Pincode…</span>
          </div>
        )}

        {/* GPS button */}
        {!loading && (
          <div
            className="absolute z-10 flex justify-center"
            style={{ bottom: 16, left: 0, right: 0 }}
          >
            <button
              onClick={handleCurrentLocation}
              disabled={locating}
              className="flex items-center gap-2 bg-white font-semibold text-sm px-5 py-2.5 rounded-full shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60"
              style={{ color: "#00A651" }}
              aria-label="Use current location"
            >
              <Navigation
                size={16}
                className={`flex-shrink-0 ${locating ? "animate-pulse" : ""}`}
                style={{ color: "#00A651" }}
              />
              {locating ? "Locating…" : "Use my current location"}
            </button>
          </div>
        )}
      </div>

      {/* ── Address Preview + Validation + Confirm ──────────────────────────── */}
      <div
        className="bg-white flex-shrink-0"
        style={{ borderTop: "1px solid #F0F0F0" }}
      >
        {hasLocation && parsed ? (
          <div className="px-4 pt-3.5 pb-2">
            {/* Delivery Availability Status Banner */}
            {!geocoding && (
              isDeliverable ? (
                <div className="bg-[#EAF8F0] border border-[#B9E8CE] rounded-[14px] px-3.5 py-2.5 mb-2.5 flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-[#00A651] flex-shrink-0" />
                    <div>
                      <p className="text-xs font-bold text-[#087A43]">
                        ✓ Delivery Available to {detectedPincode}
                      </p>
                      <p className="text-[11px] text-[#555555]">
                        {deliveryZone?.zoneName || "Coimbatore Zone"} · Delivery ₹{deliveryZone?.charge} (Min order ₹{deliveryZone?.minimumOrder})
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-[#00A651] bg-white px-2 py-0.5 rounded-full border border-[#B9E8CE] flex-shrink-0">
                    Serviceable
                  </span>
                </div>
              ) : (
                <div className="bg-[#FFF2F2] border border-[#FFD0D0] rounded-[14px] p-3 mb-2.5 flex items-start gap-2.5 shadow-xs">
                  <AlertCircle size={18} className="text-[#EA4335] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-[#EA4335]">
                      Sorry, we currently do not deliver to this location.
                    </p>
                    <p className="text-[11px] text-[#666666] mt-0.5 leading-tight">
                      {detectedPincode
                        ? `Detected pincode ${detectedPincode} is outside our active delivery area.`
                        : "No serviceable pincode detected for this pin spot."}{" "}
                      Please choose a location within Coimbatore service zones.
                    </p>
                  </div>
                </div>
              )
            )}

            {/* Address detail chips */}
            <div className="bg-[#F9F9F9] rounded-[14px] px-3.5 py-2.5 mb-2.5 space-y-1.5">
              {parsed.formattedAddress && (
                <p className="text-[12px] font-semibold text-[#111111] leading-snug line-clamp-2">
                  {parsed.formattedAddress}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {parsed.street && (
                  <Chip color="blue" label={parsed.street} />
                )}
                {parsed.area && (
                  <Chip color="green" label={parsed.area} />
                )}
                {parsed.city && (
                  <Chip color="green" label={`🏙 ${parsed.city}`} />
                )}
                {parsed.pincode && (
                  <Chip
                    color={isDeliverable ? "green" : "red"}
                    label={`📮 ${parsed.pincode} ${isDeliverable ? "✓" : "✕"}`}
                    bold
                  />
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 bg-[#F5F5F5] rounded-[14px] p-3.5">
              <MapPin size={18} className="text-[#AAAAAA]" />
              <p className="text-sm text-[#AAAAAA] font-medium">
                Tap anywhere on the map above to select your delivery location
              </p>
            </div>
          </div>
        )}

        {/* Confirm button */}
        <div
          className="px-4"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom, 14px), 14px)" }}
        >
          <button
            onClick={handleConfirm}
            disabled={!hasLocation || geocoding || !isDeliverable}
            className={`w-full font-bold text-sm sm:text-base rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md ${
              !hasLocation
                ? "bg-[#CCCCCC] text-[#666666] cursor-not-allowed"
                : geocoding
                ? "bg-[#00A651] text-white cursor-wait opacity-80"
                : isDeliverable
                ? "bg-[#00A651] hover:bg-[#087A43] active:scale-[0.98] text-white cursor-pointer"
                : "bg-[#EAEAEA] text-[#999999] cursor-not-allowed shadow-none"
            }`}
            style={{ height: 52 }}
          >
            {geocoding ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying Delivery Location…
              </>
            ) : !hasLocation ? (
              "Tap the map to select location"
            ) : isDeliverable ? (
              <>
                Confirm Delivery Location
                <ChevronRight size={20} strokeWidth={2.5} />
              </>
            ) : (
              "Sorry, we currently do not deliver to this location"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// Small reusable chip
function Chip({
  label,
  color,
  bold,
}: {
  label: string;
  color: "green" | "gray" | "blue" | "red";
  bold?: boolean;
}) {
  const styles: Record<string, string> = {
    green: "bg-[#EAF8F0] text-[#087A43]",
    gray: "bg-[#F0F0F0] text-[#555555]",
    blue: "bg-[#EBF3FF] text-[#1A73E8]",
    red: "bg-[#FFF2F2] text-[#EA4335]",
  };
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full ${styles[color]} ${bold ? "font-bold" : "font-semibold"}`}
    >
      {label}
    </span>
  );
}
