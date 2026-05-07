import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
    })),
    removeChannel: vi.fn(),
  },
}));

vi.mock('@/lib/productTypes', () => ({
  DEFAULT_ACCEPTED_TYPES: ['Alimentos', 'Documentos', 'Encomenda Pequena'],
}));

import { supabase } from '@/integrations/supabase/client';

// ── Haversine (isolated, same formula as hook) ────────────────────────────────
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Query functions (extracted from hook for unit testing) ────────────────────
// We test the pure filter logic, not the React hook itself

function filterDeliveries(
  deliveries: any[],
  driverLat: number,
  driverLng: number,
  radiusKm: number,
  acceptedProductTypes: string[],
) {
  return deliveries
    .map((d) => ({
      ...d,
      distanceFromDriver: haversine(
        driverLat, driverLng,
        Number(d.pickup_latitude), Number(d.pickup_longitude),
      ),
    }))
    .filter((d) => {
      if (d.distanceFromDriver > radiusKm) return false;
      if (!d.product_type) return true;
      return acceptedProductTypes.includes(d.product_type);
    })
    .sort((a, b) => a.distanceFromDriver - b.distanceFromDriver);
}

// ── Test data ─────────────────────────────────────────────────────────────────
const DRIVER = { lat: -19.87, lng: -44.99 }; // Betim-MG aproximado

const makeDelivery = (overrides: Partial<any> = {}): any => ({
  id: 'del-1',
  status: 'pending',
  pickup_address: 'Rua A',
  delivery_address: 'Rua B',
  pickup_latitude: DRIVER.lat,       // same spot → 0km
  pickup_longitude: DRIVER.lng,
  distance_km: 2,
  price: 12,
  created_at: new Date().toISOString(),
  product_type: null,
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('filterDeliveries (useNearbyDeliveries logic)', () => {

  describe('radius filtering', () => {
    it('includes delivery inside radius', () => {
      const deliveries = [makeDelivery()]; // 0km from driver
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 5, ['Alimentos']);
      expect(result).toHaveLength(1);
    });

    it('excludes delivery outside radius', () => {
      // Place pickup far away (~11km N of driver)
      const farLat = DRIVER.lat + 0.1;
      const deliveries = [makeDelivery({ pickup_latitude: farLat })];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 5, ['Alimentos']);
      expect(result).toHaveLength(0);
    });

    it('includes delivery exactly at radius boundary (within 0.1km tolerance)', () => {
      // 5km north
      const borderLat = DRIVER.lat + (5 / 111.32);
      const deliveries = [makeDelivery({ pickup_latitude: borderLat })];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 5.5, ['Alimentos']);
      expect(result).toHaveLength(1);
    });
  });

  describe('product type filtering', () => {
    it('shows delivery with no product_type to all drivers', () => {
      const deliveries = [makeDelivery({ product_type: null })];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 20, []);
      expect(result).toHaveLength(1);
    });

    it('shows delivery if product_type matches accepted types', () => {
      const deliveries = [makeDelivery({ product_type: 'Alimentos' })];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 20, ['Alimentos', 'Documentos']);
      expect(result).toHaveLength(1);
    });

    it('hides delivery if product_type NOT in accepted types', () => {
      const deliveries = [makeDelivery({ product_type: 'Eletrônicos' })];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 20, ['Alimentos']);
      expect(result).toHaveLength(0);
    });

    it('shows multiple product types if all accepted', () => {
      const deliveries = [
        makeDelivery({ id: '1', product_type: 'Alimentos' }),
        makeDelivery({ id: '2', product_type: 'Documentos' }),
        makeDelivery({ id: '3', product_type: 'Eletrônicos' }),
      ];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 20, ['Alimentos', 'Documentos']);
      expect(result).toHaveLength(2);
      expect(result.map((r: any) => r.product_type)).toEqual(
        expect.arrayContaining(['Alimentos', 'Documentos']),
      );
    });
  });

  describe('sorting', () => {
    it('sorts deliveries by distance ascending', () => {
      const near  = makeDelivery({ id: 'near',  pickup_latitude: DRIVER.lat + 0.001 });
      const far   = makeDelivery({ id: 'far',   pickup_latitude: DRIVER.lat + 0.05  });
      const mid   = makeDelivery({ id: 'mid',   pickup_latitude: DRIVER.lat + 0.02  });

      const result = filterDeliveries(
        [far, near, mid], DRIVER.lat, DRIVER.lng, 20, ['Alimentos'],
      );
      expect(result[0].id).toBe('near');
      expect(result[1].id).toBe('mid');
      expect(result[2].id).toBe('far');
    });
  });

  describe('combined filters', () => {
    it('applies both radius and product type filter together', () => {
      const deliveries = [
        makeDelivery({ id: '1', pickup_latitude: DRIVER.lat,       product_type: 'Alimentos' }), // ok
        makeDelivery({ id: '2', pickup_latitude: DRIVER.lat + 0.1, product_type: 'Alimentos' }), // too far
        makeDelivery({ id: '3', pickup_latitude: DRIVER.lat,       product_type: 'Eletrônicos' }), // wrong type
        makeDelivery({ id: '4', pickup_latitude: DRIVER.lat,       product_type: null }),          // no type — ok
      ];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 5, ['Alimentos']);
      expect(result.map((r: any) => r.id)).toEqual(expect.arrayContaining(['1', '4']));
      expect(result).toHaveLength(2);
    });

    it('returns empty array when no deliveries match', () => {
      const deliveries = [
        makeDelivery({ pickup_latitude: DRIVER.lat + 0.2, product_type: 'Eletrônicos' }),
      ];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 5, ['Alimentos']);
      expect(result).toHaveLength(0);
    });

    it('returns all deliveries when none have product_type and all are in radius', () => {
      const deliveries = [
        makeDelivery({ id: '1', product_type: null }),
        makeDelivery({ id: '2', product_type: null }),
        makeDelivery({ id: '3', product_type: null }),
      ];
      const result = filterDeliveries(deliveries, DRIVER.lat, DRIVER.lng, 20, []);
      expect(result).toHaveLength(3);
    });
  });
});

// ── Haversine formula tests ───────────────────────────────────────────────────
describe('haversine distance', () => {
  it('returns 0 for same coordinates', () => {
    expect(haversine(0, 0, 0, 0)).toBe(0);
  });

  it('returns positive distance for different coordinates', () => {
    const dist = haversine(-19.87, -44.99, -19.97, -44.99);
    expect(dist).toBeGreaterThan(0);
  });

  it('returns approximately 111km per degree of latitude', () => {
    const dist = haversine(0, 0, 1, 0);
    expect(dist).toBeCloseTo(111.19, 0);
  });

  it('is commutative (A→B same as B→A)', () => {
    const d1 = haversine(-19.87, -44.99, -20.0, -45.1);
    const d2 = haversine(-20.0, -45.1, -19.87, -44.99);
    expect(d1).toBeCloseTo(d2, 5);
  });

  it('returns ~1km for typical small urban distance', () => {
    // ~0.009 degrees ≈ 1km
    const dist = haversine(-19.87, -44.99, -19.879, -44.99);
    expect(dist).toBeLessThan(2);
    expect(dist).toBeGreaterThan(0.5);
  });
});
