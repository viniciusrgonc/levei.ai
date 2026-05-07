import { supabase } from '@/integrations/supabase/client';

// ── Types ────────────────────────────────────────────────────────────────────
export interface PricingBreakdown {
  base_price: number;
  product_addon: number;
  addon_type: 'fixed' | 'percentage';
  addon_value: number;
  return_price: number;
  return_percentage: number;
  dynamic_enabled: boolean;
  dynamic_multiplier: number;
  dynamic_description: string;
  final_price: number;
  platform_commission_percentage: number;
  driver_earnings: number;
}

export interface DistanceRange {
  id: string;
  min_km: number;
  max_km: number;
  price: number;
  is_active: boolean;
}

export interface ProductAddon {
  id: string;
  product_type: string;
  addon_type: 'fixed' | 'percentage';
  addon_value: number;
}

export interface PricingConfig {
  id: string;
  return_percentage: number;
  dynamic_enabled: boolean;
  dynamic_multiplier: number;
  dynamic_description: string;
  platform_commission_percentage: number;
}

// ── RPC call ─────────────────────────────────────────────────────────────────
export async function calculateDeliveryPrice(
  distanceKm: number,
  productType?: string,
  requiresReturn?: boolean,
): Promise<PricingBreakdown> {
  const { data, error } = await supabase.rpc('calculate_delivery_price', {
    p_distance_km: distanceKm,
    p_product_type: productType ?? null,
    p_requires_return: requiresReturn ?? false,
  });
  if (error) throw error;
  return data as PricingBreakdown;
}

// ── Data fetchers ─────────────────────────────────────────────────────────────
export async function fetchDistanceRanges(): Promise<DistanceRange[]> {
  const { data, error } = await supabase
    .from('pricing_distance_ranges')
    .select('*')
    .order('min_km', { ascending: true });
  if (error) throw error;
  return (data ?? []) as DistanceRange[];
}

export async function fetchProductAddons(): Promise<ProductAddon[]> {
  const { data, error } = await supabase
    .from('pricing_product_addons')
    .select('*')
    .order('product_type', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProductAddon[];
}

export async function fetchPricingConfig(): Promise<PricingConfig | null> {
  const { data, error } = await supabase
    .from('pricing_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as PricingConfig | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

export function getDistanceLabel(range: DistanceRange): string {
  if (range.max_km >= 9999) return `Acima de ${range.min_km} km`;
  return `${range.min_km}–${range.max_km} km`;
}
