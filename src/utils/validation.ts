import { isValidPincode } from "../data/deliveryZones";

export function validatePincode(pincode: string): string | null {
  if (!pincode || pincode.trim() === "") return "Please enter your pincode.";
  if (!/^\d{6}$/.test(pincode.trim())) return "Please enter a valid 6-digit pincode.";
  return null;
}

/** Validates that a delivery location pin has coordinates and is in a serviceable zone */
export function validateLocationPin(
  lat: number | null,
  lng: number | null,
  pincode?: string
): string | null {
  if (lat === null || lng === null) {
    return "Please select your delivery location on Google Maps.";
  }
  if (lat === 0 && lng === 0) {
    return "Please select a valid delivery location on Google Maps.";
  }
  if (!pincode || !isValidPincode(pincode)) {
    return "Sorry, we currently do not deliver to this location.";
  }
  return null;
}

export function validatePhone(phone: string): string | null {
  if (!phone || phone.trim() === "") return "Please enter your mobile number.";
  const cleaned = phone.replace(/\s/g, "");
  if (!/^[6-9]\d{9}$/.test(cleaned))
    return "Please enter a valid 10-digit Indian mobile number.";
  return null;
}

export function validateAlternatePhone(phone?: string): string | null {
  if (!phone || phone.trim() === "") return null; // Optional
  const cleaned = phone.replace(/\s/g, "");
  if (!/^[6-9]\d{9}$/.test(cleaned))
    return "Please enter a valid 10-digit alternative mobile number.";
  return null;
}

export function validateName(name: string): string | null {
  if (!name || name.trim() === "") return "Please enter your full name.";
  if (name.trim().length < 2) return "Name must be at least 2 characters.";
  return null;
}

export function validateEmail(email?: string): string | null {
  // Email is optional — only validate format if the user typed something
  if (!email || email.trim() === "") return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    return "Please enter a valid email address.";
  return null;
}

export function validateRequiredEmail(email: string): string | null {
  if (!email || email.trim() === "") return "Please enter your email address.";
  return validateEmail(email);
}

export function validatePassword(password: string): string | null {
  if (!password) return "Please enter a password.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateConfirmPassword(password: string, confirm: string): string | null {
  if (!confirm) return "Please confirm your password.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}


export function validateAddress(address: string): string | null {
  if (!address || address.trim() === "") return "Please enter your delivery address.";
  if (address.trim().length < 5) return "Please enter a more complete delivery address.";
  return null;
}

// ── Guest Checkout Form ─────────────────────────────────────────────────────

export interface GuestDetails {
  fullName: string;
  mobile: string;
  alternateMobile?: string;
  email?: string;
}

export interface DeliveryLocation {
  lat: number | null;
  lng: number | null;
  formattedAddress: string;
  street: string;       // Door No + Street/Road name
  area: string;         // Locality / Neighbourhood
  city: string;
  district: string;
  state: string;
  pincode: string;      // Auto-detected from Google Maps pin
  houseNo: string;      // Customer-added house/flat no
  landmark: string;     // Customer-added landmark
}

export interface CheckoutFormData extends GuestDetails {
  delivery: DeliveryLocation;
}

export interface CheckoutErrors {
  fullName?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  location?: string;
  address?: string;
  payment?: string;
}

export function validateCheckoutForm(data: CheckoutFormData): CheckoutErrors {
  const errors: CheckoutErrors = {};

  const nameErr = validateName(data.fullName);
  if (nameErr) errors.fullName = nameErr;

  const phoneErr = validatePhone(data.mobile);
  if (phoneErr) errors.mobile = phoneErr;

  const altPhoneErr = validateAlternatePhone(data.alternateMobile);
  if (altPhoneErr) errors.alternateMobile = altPhoneErr;

  // Email is optional — only validate format if provided
  const emailErr = validateEmail(data.email);
  if (emailErr) errors.email = emailErr;

  // Location & Pincode validation directly from the pinned map location
  const locationErr = validateLocationPin(
    data.delivery.lat,
    data.delivery.lng,
    data.delivery.pincode
  );
  if (locationErr) errors.location = locationErr;

  return errors;
}

export function validateCheckoutPincode(pincode: string): string | null {
  const basic = validatePincode(pincode);
  if (basic) return basic;
  if (!isValidPincode(pincode.trim()))
    return "Sorry, we currently do not deliver to this location.";
  return null;
}
