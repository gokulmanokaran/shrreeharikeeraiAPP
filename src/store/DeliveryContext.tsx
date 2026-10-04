import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getDeliveryCharge,
  getMinimumOrder,
  isValidPincode,
} from "../data/deliveryZones";
import { getItem, setItem, removeItem, STORAGE_KEYS } from "../utils/storage";
import { useAuth } from "./AuthContext";
import { getSupabaseClient } from "../lib/supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SavedLocation {
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
  street: string;
  area: string;
  city: string;
  district: string;
  state: string;
  pincode: string;
  houseNo?: string;
  landmark?: string;
}

interface DeliveryState {
  pincode: string;
  deliveryCharge: number | null;
  minimumOrder: number | null;
  isAvailable: boolean;
  isChecked: boolean;
  savedLocation: SavedLocation | null;
}

export interface DeliveryContextValue extends DeliveryState {
  setPincode: (pincode: string) => void;
  checkPincode: (pincode: string) => { success: boolean; charge: number | null; minimumOrder: number | null };
  clearPincode: () => void;
  saveLocation: (location: SavedLocation) => Promise<{ success: boolean; error?: string }>;
  clearLocation: () => Promise<void>;
  locationLabel: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function formatLocationLabel(loc: SavedLocation | null | undefined): string {
  if (!loc) return "";
  const parts: string[] = [];
  if (loc.area) parts.push(loc.area);
  else if (loc.city) parts.push(loc.city);
  if (loc.pincode) parts.push(loc.pincode);
  if (parts.length > 0) return parts.join(" - ");
  return loc.formattedAddress || "";
}

// ── Context ──────────────────────────────────────────────────────────────────

const DeliveryContext = createContext<DeliveryContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function DeliveryProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [state, setState] = useState<DeliveryState>(() => {
    // 1. Check local storage for previously saved location
    const storedLoc = getItem<SavedLocation | null>(STORAGE_KEYS.SAVED_LOCATION, null);
    if (storedLoc && storedLoc.pincode && isValidPincode(storedLoc.pincode)) {
      const pincode = storedLoc.pincode.trim();
      return {
        pincode,
        deliveryCharge: getDeliveryCharge(pincode),
        minimumOrder: getMinimumOrder(pincode),
        isAvailable: true,
        isChecked: true,
        savedLocation: storedLoc,
      };
    }

    // 2. Legacy pincode fallback if valid
    const rawPincode = getItem<string>(STORAGE_KEYS.PINCODE, "");
    const isValid = Boolean(rawPincode && isValidPincode(rawPincode));
    const pincode = isValid ? rawPincode.trim() : "";
    const deliveryCharge = isValid ? getDeliveryCharge(pincode) : null;
    const minimumOrder = isValid ? getMinimumOrder(pincode) : null;
    return {
      pincode,
      deliveryCharge,
      minimumOrder,
      isAvailable: isValid,
      isChecked: isValid,
      savedLocation: null,
    };
  });

  // Hydrate cloud location from Supabase user_metadata if available and not yet loaded
  useEffect(() => {
    if (!user) return;
    const cloudLoc = user.user_metadata?.saved_location as SavedLocation | undefined;
    if (cloudLoc && cloudLoc.pincode && isValidPincode(cloudLoc.pincode)) {
      setState((prev) => {
        if (
          prev.savedLocation?.pincode === cloudLoc.pincode &&
          prev.savedLocation?.formattedAddress === cloudLoc.formattedAddress
        ) {
          return prev;
        }
        const cleanPin = cloudLoc.pincode.trim();
        return {
          pincode: cleanPin,
          deliveryCharge: getDeliveryCharge(cleanPin),
          minimumOrder: getMinimumOrder(cleanPin),
          isAvailable: true,
          isChecked: true,
          savedLocation: cloudLoc,
        };
      });
      setItem(STORAGE_KEYS.SAVED_LOCATION, cloudLoc);
      setItem(STORAGE_KEYS.PINCODE, cloudLoc.pincode.trim());
      setItem(STORAGE_KEYS.DELIVERY_AVAILABLE, true);
    }
  }, [user]);

  // Persist state to local storage
  useEffect(() => {
    if (state.savedLocation) {
      setItem(STORAGE_KEYS.SAVED_LOCATION, state.savedLocation);
    }
    setItem(STORAGE_KEYS.PINCODE, state.pincode);
    setItem(STORAGE_KEYS.DELIVERY_CHARGE, state.deliveryCharge);
    setItem(STORAGE_KEYS.DELIVERY_AVAILABLE, state.isAvailable);
  }, [state]);

  const checkPincode = useCallback(
    (pincode: string): { success: boolean; charge: number | null; minimumOrder: number | null } => {
      const clean = pincode.trim();
      const available = isValidPincode(clean);
      const charge = available ? getDeliveryCharge(clean) : null;
      const minOrder = available ? getMinimumOrder(clean) : null;
      setState((prev) => ({
        ...prev,
        pincode: clean,
        deliveryCharge: charge,
        minimumOrder: minOrder,
        isAvailable: available,
        isChecked: true,
      }));
      return { success: available, charge, minimumOrder: minOrder };
    },
    []
  );

  const setPincode = useCallback((pincode: string) => {
    const clean = pincode.trim();
    const available = isValidPincode(clean);
    const charge = available ? getDeliveryCharge(clean) : null;
    const minOrder = available ? getMinimumOrder(clean) : null;
    setState((prev) => ({
      ...prev,
      pincode: clean,
      deliveryCharge: charge,
      minimumOrder: minOrder,
      isAvailable: available,
      isChecked: true,
    }));
  }, []);

  const clearPincode = useCallback(() => {
    setState((prev) => ({
      ...prev,
      pincode: "",
      deliveryCharge: null,
      minimumOrder: null,
      isAvailable: false,
      isChecked: false,
    }));
  }, []);

  const saveLocation = useCallback(
    async (loc: SavedLocation): Promise<{ success: boolean; error?: string }> => {
      const cleanPin = (loc.pincode || "").trim();
      if (!cleanPin || !isValidPincode(cleanPin)) {
        return {
          success: false,
          error: "Delivery is not available in this area.",
        };
      }

      const charge = getDeliveryCharge(cleanPin);
      const minOrder = getMinimumOrder(cleanPin);

      const finalLocation: SavedLocation = {
        ...loc,
        pincode: cleanPin,
      };

      // 1. Update React state immediately
      setState({
        pincode: cleanPin,
        deliveryCharge: charge,
        minimumOrder: minOrder,
        isAvailable: true,
        isChecked: true,
        savedLocation: finalLocation,
      });

      // 2. Persist locally
      setItem(STORAGE_KEYS.SAVED_LOCATION, finalLocation);
      setItem(STORAGE_KEYS.PINCODE, cleanPin);
      setItem(STORAGE_KEYS.DELIVERY_AVAILABLE, true);

      // 3. Persist to Supabase user_metadata if user is logged in
      const supabase = getSupabaseClient();
      if (supabase) {
        try {
          await supabase.auth.updateUser({
            data: {
              saved_location: finalLocation,
            },
          });
        } catch (err) {
          console.warn("[DeliveryContext] Failed to persist location to Supabase user metadata:", err);
        }
      }

      return { success: true };
    },
    []
  );

  const clearLocation = useCallback(async () => {
    setState({
      pincode: "",
      deliveryCharge: null,
      minimumOrder: null,
      isAvailable: false,
      isChecked: false,
      savedLocation: null,
    });
    removeItem(STORAGE_KEYS.SAVED_LOCATION);
    removeItem(STORAGE_KEYS.PINCODE);
    removeItem(STORAGE_KEYS.DELIVERY_CHARGE);
    removeItem(STORAGE_KEYS.DELIVERY_AVAILABLE);

    const supabase = getSupabaseClient();
    if (supabase) {
      try {
        await supabase.auth.updateUser({
          data: {
            saved_location: null,
          },
        });
      } catch (err) {
        console.warn("[DeliveryContext] Failed to clear location from Supabase user metadata:", err);
      }
    }
  }, []);

  const locationLabel = useMemo(
    () => formatLocationLabel(state.savedLocation),
    [state.savedLocation]
  );

  const value = useMemo<DeliveryContextValue>(
    () => ({
      ...state,
      setPincode,
      checkPincode,
      clearPincode,
      saveLocation,
      clearLocation,
      locationLabel,
    }),
    [
      state,
      setPincode,
      checkPincode,
      clearPincode,
      saveLocation,
      clearLocation,
      locationLabel,
    ]
  );

  return (
    <DeliveryContext.Provider value={value}>
      {children}
    </DeliveryContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useDelivery(): DeliveryContextValue {
  const ctx = useContext(DeliveryContext);
  if (!ctx) throw new Error("useDelivery must be used inside DeliveryProvider");
  return ctx;
}
