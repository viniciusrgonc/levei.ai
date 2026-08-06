import { useQuery } from '@tanstack/react-query';
import { fetchPricingConfig } from './pricing';

/**
 * Returns the driver's commission percentage (e.g. 80 when platform takes 20%).
 * Cached for 5 minutes — safe to call in multiple components simultaneously.
 */
export function useDriverCommission(): number {
  const { data } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: fetchPricingConfig,
    staleTime: 5 * 60 * 1000,
  });
  return 100 - (data?.platform_commission_percentage ?? 20);
}

/** Net amount the driver receives for a given gross price. */
export function calcDriverAmount(gross: number, driverPct: number): number {
  return gross * (driverPct / 100);
}

/** Formatted net amount string (e.g. "R$ 32,00"). */
export function fmtDriverAmount(gross: number, driverPct: number): string {
  return `R$ ${calcDriverAmount(gross, driverPct).toFixed(2)}`;
}
