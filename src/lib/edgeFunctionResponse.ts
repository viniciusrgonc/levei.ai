import { z } from 'zod';
import { toast } from '@/hooks/use-toast';

// ── Zod schemas — validação client-side antes de chamar edge functions ──────

const uuidSchema = z.string().uuid('ID inválido (deve ser UUID)');

/** Schema compartilhado pelos 3 hooks de entrega */
export const deliveryActionSchema = z.object({
  delivery_id: uuidSchema,
  driver_id: uuidSchema,
});

export type DeliveryActionPayload = z.infer<typeof deliveryActionSchema>;

/**
 * Valida o payload antes de invocar uma edge function.
 * Retorna { ok: true } ou { ok: false, error: string }.
 */
export function validateDeliveryAction(
  delivery_id: unknown,
  driver_id: unknown,
): { ok: true } | { ok: false; error: string } {
  const result = deliveryActionSchema.safeParse({ delivery_id, driver_id });
  if (result.success) return { ok: true };
  const first = result.error.issues[0];
  return { ok: false, error: first?.message ?? 'Dados inválidos' };
}

// Standard response format from edge functions
export interface StandardResponse {
  success: boolean;
  code: string | null;
  message: string | null;
  ui_behavior: 'silent' | 'toast' | 'block';
  data?: Record<string, unknown>;
}

// Error codes that require user action (block behavior)
const BLOCK_CODES = [
  'AUTH_REQUIRED',
  'INVALID_TOKEN',
  'SESSION_EXPIRED',
  'UNAUTHORIZED',
];

// Error codes that should be silent (already completed operations)
const SILENT_CODES = [
  'DELIVERY_ALREADY_COMPLETED',
  'DELIVERY_ALREADY_PICKED_UP',
];

// Parse response from edge function - handles all cases
export function parseEdgeFunctionResponse(response: unknown): StandardResponse {
  // If response is already in standard format
  if (response && typeof response === 'object' && 'success' in response) {
    const res = response as StandardResponse;
    return {
      success: res.success,
      code: res.code || null,
      message: res.message || null,
      ui_behavior: res.ui_behavior || 'toast',
      data: res.data,
    };
  }

  // Legacy format with error field
  if (response && typeof response === 'object' && 'error' in response) {
    const legacyError = response as { error: string | { code?: string; message?: string } };
    const errorData = typeof legacyError.error === 'string' 
      ? { code: 'UNKNOWN', message: legacyError.error }
      : legacyError.error;
    
    return {
      success: false,
      code: errorData.code || 'UNKNOWN',
      message: errorData.message || 'Erro desconhecido',
      ui_behavior: BLOCK_CODES.includes(errorData.code || '') ? 'block' : 'toast',
      data: undefined,
    };
  }

  // Assume success if no error indicators
  return {
    success: true,
    code: null,
    message: null,
    ui_behavior: 'silent',
    data: response as Record<string, unknown>,
  };
}

// Handle UI behavior based on response
export function handleResponseUI(
  response: StandardResponse,
  options?: {
    successTitle?: string;
    successDescription?: string;
    onBlock?: () => void;
  }
): void {
  const { success, message, ui_behavior, code } = response;

  // Handle success
  if (success) {
    if (ui_behavior === 'toast' && message) {
      toast({
        title: options?.successTitle || '✅ Sucesso',
        description: message,
      });
    }
    return;
  }

  // Handle errors based on ui_behavior
  switch (ui_behavior) {
    case 'silent':
      // Don't show anything, just log
      console.log(`[EdgeFunction] Silent error: ${code} - ${message}`);
      break;

    case 'block':
      // Show blocking toast and call handler
      toast({
        title: '⚠️ Ação necessária',
        description: message || 'Por favor, faça login novamente.',
        variant: 'destructive',
      });
      options?.onBlock?.();
      break;

    case 'toast':
    default:
      // Show regular toast
      toast({
        title: 'Aviso',
        description: message || 'Não foi possível completar a operação.',
      });
      break;
  }
}

// Combined helper: parse response and handle UI
export function processEdgeFunctionResponse(
  response: unknown,
  options?: {
    successTitle?: string;
    successDescription?: string;
    onBlock?: () => void;
  }
): StandardResponse {
  const parsed = parseEdgeFunctionResponse(response);
  handleResponseUI(parsed, options);
  return parsed;
}

// Check if response indicates session expired
export function isSessionExpired(response: StandardResponse): boolean {
  return !response.success && BLOCK_CODES.includes(response.code || '');
}

// Check if response indicates operation was already completed (idempotent)
export function isAlreadyCompleted(response: StandardResponse): boolean {
  return response.success || SILENT_CODES.includes(response.code || '');
}
