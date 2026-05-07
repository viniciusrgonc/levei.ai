import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase ─────────────────────────────────────────────────────────────
const mockGetSession = vi.fn();
const mockInvoke = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: mockGetSession },
    functions: { invoke: mockInvoke },
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: (args: unknown) => mockToast(args),
}));

// ── Import AFTER mocks ────────────────────────────────────────────────────────
import {
  parseEdgeFunctionResponse,
  validateDeliveryAction,
  isSessionExpired,
  isAlreadyCompleted,
  handleResponseUI,
} from '@/lib/edgeFunctionResponse';

// ─────────────────────────────────────────────────────────────────────────────
// parseEdgeFunctionResponse
// ─────────────────────────────────────────────────────────────────────────────
describe('parseEdgeFunctionResponse', () => {
  describe('standard format (success field present)', () => {
    it('parses successful response correctly', () => {
      const raw = { success: true, code: null, message: 'Entrega aceita!', ui_behavior: 'toast', data: { delivery: { id: '123' } } };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.success).toBe(true);
      expect(result.message).toBe('Entrega aceita!');
      expect(result.data).toEqual({ delivery: { id: '123' } });
    });

    it('parses error response with code', () => {
      const raw = { success: false, code: 'DELIVERY_ALREADY_ACCEPTED', message: 'Entrega já aceita', ui_behavior: 'toast' };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.success).toBe(false);
      expect(result.code).toBe('DELIVERY_ALREADY_ACCEPTED');
      expect(result.ui_behavior).toBe('toast');
    });

    it('defaults ui_behavior to toast when missing', () => {
      const raw = { success: false, code: 'SOME_ERROR', message: 'Erro' };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.ui_behavior).toBe('toast');
    });

    it('normalizes null code and message', () => {
      const raw = { success: true };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.code).toBeNull();
      expect(result.message).toBeNull();
    });
  });

  describe('legacy format (error field present)', () => {
    it('parses legacy string error', () => {
      const raw = { error: 'Something went wrong' };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.success).toBe(false);
      expect(result.code).toBe('UNKNOWN');
      expect(result.message).toBe('Something went wrong');
    });

    it('parses legacy object error with code', () => {
      const raw = { error: { code: 'DELIVERY_UNAVAILABLE', message: 'Não disponível' } };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.success).toBe(false);
      expect(result.code).toBe('DELIVERY_UNAVAILABLE');
      expect(result.message).toBe('Não disponível');
    });

    it('applies block ui_behavior for AUTH_REQUIRED code', () => {
      const raw = { error: { code: 'AUTH_REQUIRED', message: 'Faça login' } };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.ui_behavior).toBe('block');
    });

    it('applies block ui_behavior for SESSION_EXPIRED code', () => {
      const raw = { error: { code: 'SESSION_EXPIRED', message: 'Sessão expirada' } };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.ui_behavior).toBe('block');
    });

    it('applies toast ui_behavior for non-block codes', () => {
      const raw = { error: { code: 'DELIVERY_UNAVAILABLE', message: 'Indisponível' } };
      const result = parseEdgeFunctionResponse(raw);
      expect(result.ui_behavior).toBe('toast');
    });
  });

  describe('unknown / null format', () => {
    it('treats null as success', () => {
      const result = parseEdgeFunctionResponse(null);
      expect(result.success).toBe(true);
    });

    it('treats plain object without known fields as success', () => {
      const result = parseEdgeFunctionResponse({ delivery: { id: 'abc' } });
      expect(result.success).toBe(true);
    });

    it('treats undefined as success', () => {
      const result = parseEdgeFunctionResponse(undefined);
      expect(result.success).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateDeliveryAction
// ─────────────────────────────────────────────────────────────────────────────
describe('validateDeliveryAction', () => {
  const validId = 'a0000000-0000-0000-0000-000000000001';
  const validDriverId = 'b0000000-0000-0000-0000-000000000002';

  it('returns ok:true for two valid UUIDs', () => {
    const result = validateDeliveryAction(validId, validDriverId);
    expect(result.ok).toBe(true);
  });

  it('returns ok:false when delivery_id is not a UUID', () => {
    const result = validateDeliveryAction('not-a-uuid', validDriverId);
    expect(result.ok).toBe(false);
    expect((result as any).error).toBeTruthy();
  });

  it('returns ok:false when driver_id is not a UUID', () => {
    const result = validateDeliveryAction(validId, '12345');
    expect(result.ok).toBe(false);
    expect((result as any).error).toBeTruthy();
  });

  it('returns ok:false when both IDs are empty strings', () => {
    const result = validateDeliveryAction('', '');
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when IDs are null', () => {
    const result = validateDeliveryAction(null, null);
    expect(result.ok).toBe(false);
  });

  it('returns ok:false when IDs are undefined', () => {
    const result = validateDeliveryAction(undefined, undefined);
    expect(result.ok).toBe(false);
  });

  it('returns error string in the error field', () => {
    const result = validateDeliveryAction('bad', validDriverId);
    if (!result.ok) {
      expect(typeof result.error).toBe('string');
      expect(result.error.length).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isSessionExpired
// ─────────────────────────────────────────────────────────────────────────────
describe('isSessionExpired', () => {
  const makeResponse = (success: boolean, code: string | null) => ({
    success,
    code,
    message: null,
    ui_behavior: 'toast' as const,
  });

  it('returns true for AUTH_REQUIRED code', () => {
    expect(isSessionExpired(makeResponse(false, 'AUTH_REQUIRED'))).toBe(true);
  });

  it('returns true for SESSION_EXPIRED code', () => {
    expect(isSessionExpired(makeResponse(false, 'SESSION_EXPIRED'))).toBe(true);
  });

  it('returns true for INVALID_TOKEN code', () => {
    expect(isSessionExpired(makeResponse(false, 'INVALID_TOKEN'))).toBe(true);
  });

  it('returns true for UNAUTHORIZED code', () => {
    expect(isSessionExpired(makeResponse(false, 'UNAUTHORIZED'))).toBe(true);
  });

  it('returns false for DELIVERY_ALREADY_ACCEPTED', () => {
    expect(isSessionExpired(makeResponse(false, 'DELIVERY_ALREADY_ACCEPTED'))).toBe(false);
  });

  it('returns false for successful response', () => {
    expect(isSessionExpired(makeResponse(true, null))).toBe(false);
  });

  it('returns false for null code', () => {
    expect(isSessionExpired(makeResponse(false, null))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// isAlreadyCompleted
// ─────────────────────────────────────────────────────────────────────────────
describe('isAlreadyCompleted', () => {
  const makeResponse = (success: boolean, code: string | null) => ({
    success,
    code,
    message: null,
    ui_behavior: 'toast' as const,
  });

  it('returns true for successful response', () => {
    expect(isAlreadyCompleted(makeResponse(true, null))).toBe(true);
  });

  it('returns true for DELIVERY_ALREADY_COMPLETED code', () => {
    expect(isAlreadyCompleted(makeResponse(false, 'DELIVERY_ALREADY_COMPLETED'))).toBe(true);
  });

  it('returns true for DELIVERY_ALREADY_PICKED_UP code', () => {
    expect(isAlreadyCompleted(makeResponse(false, 'DELIVERY_ALREADY_PICKED_UP'))).toBe(true);
  });

  it('returns false for generic error codes', () => {
    expect(isAlreadyCompleted(makeResponse(false, 'DELIVERY_UNAVAILABLE'))).toBe(false);
  });

  it('returns false for auth error codes', () => {
    expect(isAlreadyCompleted(makeResponse(false, 'AUTH_REQUIRED'))).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// handleResponseUI — toast behavior
// ─────────────────────────────────────────────────────────────────────────────
describe('handleResponseUI', () => {
  beforeEach(() => {
    mockToast.mockClear();
  });

  it('shows success toast when success=true and ui_behavior=toast and message present', () => {
    handleResponseUI(
      { success: true, code: null, message: 'Entrega aceita!', ui_behavior: 'toast' },
      { successTitle: '🎉 Sucesso', successDescription: 'Tudo certo' },
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '🎉 Sucesso' }),
    );
  });

  it('does NOT show toast when success=true and ui_behavior=silent', () => {
    handleResponseUI({ success: true, code: null, message: 'ok', ui_behavior: 'silent' });
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('shows warning toast for ui_behavior=toast on error', () => {
    handleResponseUI({ success: false, code: 'GENERIC', message: 'Algo deu errado', ui_behavior: 'toast' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Aviso', description: 'Algo deu errado' }),
    );
  });

  it('shows blocking toast and calls onBlock for ui_behavior=block', () => {
    const onBlock = vi.fn();
    handleResponseUI(
      { success: false, code: 'AUTH_REQUIRED', message: 'Faça login', ui_behavior: 'block' },
      { onBlock },
    );
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: '⚠️ Ação necessária' }),
    );
    expect(onBlock).toHaveBeenCalledOnce();
  });

  it('does NOT call onBlock when success=true', () => {
    const onBlock = vi.fn();
    handleResponseUI(
      { success: true, code: null, message: null, ui_behavior: 'silent' },
      { onBlock },
    );
    expect(onBlock).not.toHaveBeenCalled();
  });

  it('handles missing message in block mode with fallback text', () => {
    handleResponseUI({ success: false, code: 'AUTH_REQUIRED', message: null, ui_behavior: 'block' });
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ description: 'Por favor, faça login novamente.' }),
    );
  });

  it('silent error does not show toast', () => {
    handleResponseUI({ success: false, code: 'SILENT', message: 'x', ui_behavior: 'silent' });
    expect(mockToast).not.toHaveBeenCalled();
  });
});
