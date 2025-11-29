import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generates a Google Maps link for navigation
 * Works on both mobile (opens native app if available) and desktop
 * 
 * @param origin - Origin coordinates [lat, lng] or undefined (will use current location)
 * @param destination - Destination coordinates [lat, lng]
 * @returns URL string for Google Maps
 */
export function getGoogleMapsLink(
  origin: [number, number] | undefined,
  destination: [number, number]
): string {
  const destCoords = `${destination[0]},${destination[1]}`;
  
  if (origin) {
    const originCoords = `${origin[0]},${origin[1]}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=driving`;
  }
  
  // Without origin, Google Maps will use current location
  return `https://www.google.com/maps/dir/?api=1&destination=${destCoords}&travelmode=driving`;
}

/**
 * Opens navigation in Google Maps or Waze
 * Detects if mobile or desktop and opens accordingly
 * 
 * @param origin - Origin coordinates [lat, lng] or undefined (will use current location)
 * @param destination - Destination coordinates [lat, lng]
 * @param app - 'google' or 'waze' (default: 'google')
 */
export function openNavigation(
  origin: [number, number] | undefined,
  destination: [number, number],
  app: 'google' | 'waze' = 'google'
): void {
  const destCoords = `${destination[0]},${destination[1]}`;
  
  let url: string;
  
  if (app === 'waze') {
    // Waze deep link format
    url = `https://waze.com/ul?ll=${destCoords}&navigate=yes`;
  } else {
    // Google Maps
    url = getGoogleMapsLink(origin, destination);
  }
  
  // Open in new tab/window (mobile will trigger native app if installed)
  window.open(url, '_blank');
}
