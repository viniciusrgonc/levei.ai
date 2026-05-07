import { describe, it, expect } from 'vitest';
import {
  PRODUCT_TYPES,
  DEFAULT_ACCEPTED_TYPES,
  getProductTypeIcon,
  getProductTypeLabel,
} from '@/lib/productTypes';

// ── PRODUCT_TYPES array ────────────────────────────────────────────────────────

describe('PRODUCT_TYPES', () => {
  it('has 8 product types', () => {
    expect(PRODUCT_TYPES).toHaveLength(8);
  });

  it('every entry has key, label and icon', () => {
    for (const pt of PRODUCT_TYPES) {
      expect(pt.key).toBeTruthy();
      expect(pt.label).toBeTruthy();
      expect(pt.icon).toBeTruthy();
    }
  });

  it('contains Alimentos', () => {
    expect(PRODUCT_TYPES.some(p => p.key === 'Alimentos')).toBe(true);
  });

  it('contains Farmácia', () => {
    expect(PRODUCT_TYPES.some(p => p.key === 'Farmácia')).toBe(true);
  });

  it('all keys are unique', () => {
    const keys = PRODUCT_TYPES.map(p => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ── DEFAULT_ACCEPTED_TYPES ─────────────────────────────────────────────────────

describe('DEFAULT_ACCEPTED_TYPES', () => {
  it('is a non-empty array', () => {
    expect(DEFAULT_ACCEPTED_TYPES.length).toBeGreaterThan(0);
  });

  it('contains Alimentos', () => {
    expect(DEFAULT_ACCEPTED_TYPES).toContain('Alimentos');
  });

  it('contains Documentos', () => {
    expect(DEFAULT_ACCEPTED_TYPES).toContain('Documentos');
  });

  it('contains Encomenda Pequena', () => {
    expect(DEFAULT_ACCEPTED_TYPES).toContain('Encomenda Pequena');
  });

  it('every default type exists in PRODUCT_TYPES', () => {
    const allKeys = PRODUCT_TYPES.map(p => p.key);
    for (const key of DEFAULT_ACCEPTED_TYPES) {
      expect(allKeys).toContain(key);
    }
  });
});

// ── getProductTypeIcon ─────────────────────────────────────────────────────────

describe('getProductTypeIcon', () => {
  it('returns 🍔 for Alimentos', () => {
    expect(getProductTypeIcon('Alimentos')).toBe('🍔');
  });

  it('returns 📄 for Documentos', () => {
    expect(getProductTypeIcon('Documentos')).toBe('📄');
  });

  it('returns 📱 for Eletrônicos', () => {
    expect(getProductTypeIcon('Eletrônicos')).toBe('📱');
  });

  it('returns 💊 for Farmácia', () => {
    expect(getProductTypeIcon('Farmácia')).toBe('💊');
  });

  it('returns fallback 📦 for unknown key', () => {
    expect(getProductTypeIcon('Unicórnio')).toBe('📦');
  });

  it('returns fallback 📦 for empty string', () => {
    expect(getProductTypeIcon('')).toBe('📦');
  });

  it('is case-sensitive (wrong case returns fallback)', () => {
    expect(getProductTypeIcon('alimentos')).toBe('📦');
  });
});

// ── getProductTypeLabel ────────────────────────────────────────────────────────

describe('getProductTypeLabel', () => {
  it('returns label for known key', () => {
    expect(getProductTypeLabel('Alimentos')).toBe('Alimentos');
  });

  it('returns key itself for unknown key', () => {
    expect(getProductTypeLabel('Produto Raro')).toBe('Produto Raro');
  });

  it('returns empty string back when given empty string', () => {
    expect(getProductTypeLabel('')).toBe('');
  });

  it('returns correct label for Encomenda Grande', () => {
    expect(getProductTypeLabel('Encomenda Grande')).toBe('Encomenda Grande');
  });

  it('returns correct label for Outros', () => {
    expect(getProductTypeLabel('Outros')).toBe('Outros');
  });
});
