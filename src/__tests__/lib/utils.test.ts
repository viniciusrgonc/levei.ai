import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatAddress, shortAddress, getGoogleMapsLink, openNavigation } from '@/lib/utils';

// ── formatAddress ──────────────────────────────────────────────────────────────

describe('formatAddress', () => {
  it('returns placeholder for empty string', () => {
    expect(formatAddress('')).toBe('Endereço não informado');
  });

  it('converts coordinate string to human label', () => {
    expect(formatAddress('-19.87,-44.99')).toBe('Localização selecionada no mapa');
    expect(formatAddress('-3.1,-60.01')).toBe('Localização selecionada no mapa');
  });

  it('does NOT treat a normal address as coordinates', () => {
    const result = formatAddress('Rua Exemplo, 123, Belo Horizonte');
    expect(result).not.toBe('Localização selecionada no mapa');
  });

  it('removes ", Brasil" suffix (case-insensitive)', () => {
    expect(formatAddress('Rua das Flores, São Paulo, Brasil')).toBe('Rua das Flores, São Paulo');
    expect(formatAddress('Avenida Central, BRASIL')).toBe('Avenida Central');
  });

  it('removes Região Geográfica Imediata segment', () => {
    const addr = 'Rua A, Cidade, Região Geográfica Imediata de BH, Minas Gerais, Brasil';
    const result = formatAddress(addr);
    expect(result).not.toContain('Região Geográfica Imediata');
    expect(result).toContain('Rua A');
  });

  it('removes Região Geográfica Intermediária segment', () => {
    const addr = 'Rua B, Bairro, Região Geográfica Intermediária de Curitiba, Paraná, Brasil';
    const result = formatAddress(addr);
    expect(result).not.toContain('Região Geográfica Intermediária');
  });

  it('removes cardinal region names', () => {
    const addr = 'Rua C, Bairro, Região Nordeste, Brasil';
    const result = formatAddress(addr);
    expect(result).not.toContain('Região Nordeste');
  });

  it('removes CEP pattern', () => {
    const addr = 'Rua D, 30130-110, Belo Horizonte';
    const result = formatAddress(addr);
    expect(result).not.toContain('30130-110');
    expect(result).toContain('Rua D');
  });

  it('trims trailing comma', () => {
    const addr = 'Rua E, Brasil';
    const result = formatAddress(addr);
    expect(result.endsWith(',')).toBe(false);
  });
});

// ── shortAddress ───────────────────────────────────────────────────────────────

describe('shortAddress', () => {
  it('passes through coordinate placeholder unchanged', () => {
    expect(shortAddress('-10.0,-50.0')).toBe('Localização selecionada no mapa');
  });

  it('keeps 3 or fewer parts as-is', () => {
    const addr = 'Rua A, Bairro B, Cidade C';
    expect(shortAddress(addr)).toBe('Rua A, Bairro B, Cidade C');
  });

  it('truncates to 3 parts when more than 3 exist', () => {
    const addr = 'Rua X, 100, Bairro Y, Cidade Z, Estado W';
    const result = shortAddress(addr);
    const parts = result.split(',');
    expect(parts.length).toBeLessThanOrEqual(3);
  });

  it('returns formatted single-part address', () => {
    expect(shortAddress('Rua Única')).toBe('Rua Única');
  });
});

// ── getGoogleMapsLink ──────────────────────────────────────────────────────────

describe('getGoogleMapsLink', () => {
  it('builds URL without origin when origin is undefined', () => {
    const url = getGoogleMapsLink(undefined, [-19.92, -43.94]);
    expect(url).toContain('destination=-19.92,-43.94');
    expect(url).not.toContain('origin=');
    expect(url).toContain('travelmode=driving');
  });

  it('builds URL with origin when provided', () => {
    const url = getGoogleMapsLink([-20.0, -44.0], [-19.92, -43.94]);
    expect(url).toContain('origin=-20,-44');
    expect(url).toContain('destination=-19.92,-43.94');
    expect(url).toContain('travelmode=driving');
  });

  it('starts with Google Maps base URL', () => {
    const url = getGoogleMapsLink(undefined, [0, 0]);
    expect(url.startsWith('https://www.google.com/maps/dir/')).toBe(true);
  });

  it('includes api=1 parameter', () => {
    const url = getGoogleMapsLink(undefined, [-3.71, -38.54]);
    expect(url).toContain('api=1');
  });
});

// ── openNavigation ─────────────────────────────────────────────────────────────

describe('openNavigation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls window.open with Google Maps URL by default', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    openNavigation(undefined, [-19.92, -43.94]);
    expect(openSpy).toHaveBeenCalledOnce();
    const [url, target] = openSpy.mock.calls[0];
    expect(String(url)).toContain('google.com/maps');
    expect(target).toBe('_blank');
  });

  it('calls window.open with Waze URL when app is waze', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    openNavigation(undefined, [-19.92, -43.94], 'waze');
    const [url] = openSpy.mock.calls[0];
    expect(String(url)).toContain('waze.com/ul');
    expect(String(url)).toContain('navigate=yes');
  });

  it('passes destination coordinates to waze URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    openNavigation(undefined, [-3.71, -38.54], 'waze');
    const [url] = openSpy.mock.calls[0];
    expect(String(url)).toContain('-3.71,-38.54');
  });
});
