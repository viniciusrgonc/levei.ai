import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatAddress(address: string): string {
  if (!address) return 'Endereço não informado';

  if (/^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(address.trim())) {
    return 'Localização selecionada no mapa';
  }

  return address
    .replace(/,\s*Brasil$/i, '')
    .replace(/,\s*Região Geográfica (Imediata|Intermediária) de [^,]+/gi, '')
    .replace(/,\s*Região (Norte|Sul|Sudeste|Centro-Oeste|Nordeste)/gi, '')
    .replace(/,\s*\d{5}-\d{3}/g, '')
    .trim()
    .replace(/,\s*$/, '');
}

export function shortAddress(address: string): string {
  const formatted = formatAddress(address);
  if (formatted === 'Localização selecionada no mapa') return formatted;
  const parts = formatted.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length <= 3) return formatted;
  return parts.slice(0, 3).join(', ');
}

export function getGoogleMapsLink(
  origin: [number, number] | undefined,
  destination: [number, number]
): string {
  const destCoords = `${destination[0]},${destination[1]}`;
  if (origin) {
    const originCoords = `${origin[0]},${origin[1]}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${originCoords}&destination=${destCoords}&travelmode=driving`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${destCoords}&travelmode=driving`;
}

export function openNavigation(
  origin: [number, number] | undefined,
  destination: [number, number],
  app: 'google' | 'waze' = 'google'
): void {
  const destCoords = `${destination[0]},${destination[1]}`;
  let url: string;
  if (app === 'waze') {
    url = `https://waze.com/ul?ll=${destCoords}&navigate=yes`;
  } else {
    url = getGoogleMapsLink(origin, destination);
  }
  window.open(url, '_blank');
}
