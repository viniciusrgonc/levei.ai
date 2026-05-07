import { describe, it, expect } from 'vitest';
import { formatCurrency, getDistanceLabel, type DistanceRange } from '@/lib/pricing';

// ── formatCurrency ─────────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats zero correctly', () => {
    expect(formatCurrency(0)).toBe('R$ 0,00');
  });

  it('formats integer with two decimal places', () => {
    expect(formatCurrency(10)).toBe('R$ 10,00');
  });

  it('uses comma as decimal separator (Brazilian format)', () => {
    expect(formatCurrency(7.5)).toBe('R$ 7,50');
  });

  it('formats a typical delivery price', () => {
    expect(formatCurrency(12.99)).toBe('R$ 12,99');
  });

  it('formats large values correctly', () => {
    expect(formatCurrency(1000)).toBe('R$ 1000,00');
  });

  it('rounds to 2 decimal places', () => {
    // toFixed(2) rounds 7.555 → 7.56 in most JS engines
    expect(formatCurrency(7.555)).toMatch(/^R\$ 7,5[56]$/);
  });

  it('always starts with "R$ "', () => {
    expect(formatCurrency(99.9)).toMatch(/^R\$ /);
  });
});

// ── getDistanceLabel ───────────────────────────────────────────────────────────

function makeRange(min_km: number, max_km: number): DistanceRange {
  return { id: 'test', min_km, max_km, price: 10, is_active: true };
}

describe('getDistanceLabel', () => {
  it('returns "Acima de X km" when max_km >= 9999', () => {
    expect(getDistanceLabel(makeRange(20, 9999))).toBe('Acima de 20 km');
  });

  it('returns "Acima de X km" for max_km exactly 9999', () => {
    expect(getDistanceLabel(makeRange(15, 9999))).toBe('Acima de 15 km');
  });

  it('returns range string for normal ranges', () => {
    expect(getDistanceLabel(makeRange(0, 5))).toBe('0–5 km');
  });

  it('returns correct range for mid-range', () => {
    expect(getDistanceLabel(makeRange(5, 10))).toBe('5–10 km');
  });

  it('uses en-dash (–) not hyphen (-) as separator', () => {
    const label = getDistanceLabel(makeRange(3, 7));
    expect(label).toContain('–');
    expect(label).not.toMatch(/\d-\d/); // no plain hyphen between digits
  });

  it('works for 0 to 3 km range', () => {
    expect(getDistanceLabel(makeRange(0, 3))).toBe('0–3 km');
  });
});
