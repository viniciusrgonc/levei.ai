import { describe, it, expect } from 'vitest';
import {
  getStatusConfig,
  getStatusLabel,
  getStatusIcon,
  getStatusColor,
  getStatusBadge,
  getStatusDot,
  getStatusVariant,
  isDeliveryActive,
  isPickupPhase,
  isDeliveryPhase,
  isDeliveryComplete,
  isReturning,
  getNextPossibleStatuses,
  type DeliveryStatus,
} from '@/lib/deliveryStatus';

// ── getStatusConfig ────────────────────────────────────────────────────────────

describe('getStatusConfig', () => {
  it('returns correct config for pending', () => {
    const cfg = getStatusConfig('pending');
    expect(cfg.label).toBe('Aguardando entregador');
    expect(cfg.icon).toBe('🕐');
    expect(cfg.color).toContain('amber');
    expect(cfg.variant).toBe('secondary');
  });

  it('returns correct config for delivered', () => {
    const cfg = getStatusConfig('delivered');
    expect(cfg.label).toBe('Entregue');
    expect(cfg.icon).toBe('✅');
    expect(cfg.color).toContain('green');
    expect(cfg.variant).toBe('default');
  });

  it('returns correct config for cancelled', () => {
    const cfg = getStatusConfig('cancelled');
    expect(cfg.label).toBe('Cancelada');
    expect(cfg.icon).toBe('❌');
    expect(cfg.variant).toBe('destructive');
  });

  it('returns correct config for returning', () => {
    const cfg = getStatusConfig('returning');
    expect(cfg.label).toBe('Retornando ao ponto');
    expect(cfg.color).toContain('orange');
  });

  it('returns FALLBACK for unknown status', () => {
    const cfg = getStatusConfig('foobar');
    expect(cfg.label).toBe('Desconhecido');
    expect(cfg.icon).toBe('❓');
    expect(cfg.variant).toBe('secondary');
  });

  it('handles empty string gracefully', () => {
    const cfg = getStatusConfig('');
    expect(cfg.label).toBe('Desconhecido');
  });

  const allStatuses: DeliveryStatus[] = [
    'scheduled', 'pending', 'accepted', 'picking_up', 'picked_up',
    'delivering', 'delivered', 'returning', 'cancelled',
  ];

  it.each(allStatuses)('has all required fields for status: %s', (status) => {
    const cfg = getStatusConfig(status);
    expect(cfg.label).toBeTruthy();
    expect(cfg.icon).toBeTruthy();
    expect(cfg.color).toBeTruthy();
    expect(cfg.badge).toBeTruthy();
    expect(cfg.dot).toBeTruthy();
    expect(['default', 'secondary', 'destructive', 'outline']).toContain(cfg.variant);
  });
});

// ── Simple delegates ───────────────────────────────────────────────────────────

describe('getStatusLabel', () => {
  it('returns label for accepted', () => {
    expect(getStatusLabel('accepted')).toBe('Coleta em andamento');
  });
  it('returns Desconhecido for unknown', () => {
    expect(getStatusLabel('xyz')).toBe('Desconhecido');
  });
});

describe('getStatusIcon', () => {
  it('returns icon for scheduled', () => {
    expect(getStatusIcon('scheduled')).toBe('📅');
  });
  it('returns fallback for unknown', () => {
    expect(getStatusIcon('nope')).toBe('❓');
  });
});

describe('getStatusColor', () => {
  it('returns blue color for picking_up', () => {
    expect(getStatusColor('picking_up')).toContain('blue');
  });
});

describe('getStatusBadge', () => {
  it('returns badge classes for delivered', () => {
    const badge = getStatusBadge('delivered');
    expect(badge).toContain('green');
  });
});

describe('getStatusDot', () => {
  it('returns dot class for pending', () => {
    expect(getStatusDot('pending')).toBe('bg-amber-400');
  });
});

describe('getStatusVariant', () => {
  it('returns destructive for cancelled', () => {
    expect(getStatusVariant('cancelled')).toBe('destructive');
  });
  it('returns secondary for unknown', () => {
    expect(getStatusVariant('whatever')).toBe('secondary');
  });
});

// ── Boolean predicates ─────────────────────────────────────────────────────────

describe('isDeliveryActive', () => {
  it.each(['accepted', 'picking_up', 'picked_up', 'delivering', 'returning'])(
    'returns true for active status: %s',
    (status) => expect(isDeliveryActive(status)).toBe(true),
  );

  it.each(['pending', 'delivered', 'cancelled', 'scheduled'])(
    'returns false for non-active status: %s',
    (status) => expect(isDeliveryActive(status)).toBe(false),
  );
});

describe('isPickupPhase', () => {
  it('returns true for accepted', () => expect(isPickupPhase('accepted')).toBe(true));
  it('returns true for picking_up', () => expect(isPickupPhase('picking_up')).toBe(true));
  it('returns false for picked_up', () => expect(isPickupPhase('picked_up')).toBe(false));
  it('returns false for delivered', () => expect(isPickupPhase('delivered')).toBe(false));
});

describe('isDeliveryPhase', () => {
  it('returns true for picked_up', () => expect(isDeliveryPhase('picked_up')).toBe(true));
  it('returns true for delivering', () => expect(isDeliveryPhase('delivering')).toBe(true));
  it('returns false for accepted', () => expect(isDeliveryPhase('accepted')).toBe(false));
  it('returns false for delivered', () => expect(isDeliveryPhase('delivered')).toBe(false));
});

describe('isDeliveryComplete', () => {
  it('returns true for delivered', () => expect(isDeliveryComplete('delivered')).toBe(true));
  it('returns true for cancelled', () => expect(isDeliveryComplete('cancelled')).toBe(true));
  it('returns false for picked_up', () => expect(isDeliveryComplete('picked_up')).toBe(false));
  it('returns false for pending', () => expect(isDeliveryComplete('pending')).toBe(false));
});

describe('isReturning', () => {
  it('returns true for returning', () => expect(isReturning('returning')).toBe(true));
  it('returns false for delivered', () => expect(isReturning('delivered')).toBe(false));
  it('returns false for picked_up', () => expect(isReturning('picked_up')).toBe(false));
});

// ── getNextPossibleStatuses ────────────────────────────────────────────────────

describe('getNextPossibleStatuses', () => {
  it('pending can go to accepted or cancelled', () => {
    const next = getNextPossibleStatuses('pending');
    expect(next).toContain('accepted');
    expect(next).toContain('cancelled');
  });

  it('delivered has no next statuses', () => {
    expect(getNextPossibleStatuses('delivered')).toHaveLength(0);
  });

  it('cancelled has no next statuses', () => {
    expect(getNextPossibleStatuses('cancelled')).toHaveLength(0);
  });

  it('returning can become delivered or cancelled', () => {
    const next = getNextPossibleStatuses('returning');
    expect(next).toContain('delivered');
    expect(next).toContain('cancelled');
  });

  it('picked_up can go to delivering, delivered, returning or cancelled', () => {
    const next = getNextPossibleStatuses('picked_up');
    expect(next).toContain('delivering');
    expect(next).toContain('delivered');
    expect(next).toContain('returning');
    expect(next).toContain('cancelled');
  });

  it('scheduled can become pending or cancelled', () => {
    const next = getNextPossibleStatuses('scheduled');
    expect(next).toContain('pending');
    expect(next).toContain('cancelled');
  });
});
