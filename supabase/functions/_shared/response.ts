import { corsHeaders } from './cors.ts'

// Standard response format for all edge functions
export interface StandardResponse {
  success: boolean
  code: string | null
  message: string | null
  ui_behavior: 'silent' | 'toast' | 'block'
  data?: Record<string, unknown>
}

// Error codes registry
export const ErrorCodes = {
  // Auth errors
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Input errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELDS: 'MISSING_FIELDS',
  INVALID_UUID: 'INVALID_UUID',
  
  // Driver errors
  DRIVER_NOT_FOUND: 'DRIVER_NOT_FOUND',
  UNAUTHORIZED_DRIVER: 'UNAUTHORIZED_DRIVER',
  OUT_OF_RADIUS: 'OUT_OF_RADIUS',
  DRIVER_HAS_ACTIVE_DELIVERY: 'DRIVER_HAS_ACTIVE_DELIVERY',
  
  // Delivery errors
  DELIVERY_NOT_FOUND: 'DELIVERY_NOT_FOUND',
  DELIVERY_ALREADY_ACCEPTED: 'DELIVERY_ALREADY_ACCEPTED',
  DELIVERY_UNAVAILABLE: 'DELIVERY_UNAVAILABLE',
  DELIVERY_ALREADY_PICKED_UP: 'DELIVERY_ALREADY_PICKED_UP',
  DELIVERY_ALREADY_COMPLETED: 'DELIVERY_ALREADY_COMPLETED',
  DELIVERY_WRONG_STATUS: 'DELIVERY_WRONG_STATUS',
  DELIVERY_NOT_ASSIGNED: 'DELIVERY_NOT_ASSIGNED',
  
  // Transaction errors
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]

// Determine UI behavior based on error code
function getUiBehavior(code: ErrorCode): 'silent' | 'toast' | 'block' {
  switch (code) {
    // Auth errors require user action
    case ErrorCodes.AUTH_REQUIRED:
    case ErrorCodes.INVALID_TOKEN:
    case ErrorCodes.SESSION_EXPIRED:
    case ErrorCodes.UNAUTHORIZED:
      return 'block'
    
    // Already completed operations are silent
    case ErrorCodes.DELIVERY_ALREADY_COMPLETED:
    case ErrorCodes.DELIVERY_ALREADY_PICKED_UP:
      return 'silent'
    
    // Most errors show toast
    default:
      return 'toast'
  }
}

// Create standardized success response - ALWAYS HTTP 200
export function successResponse(
  data?: Record<string, unknown>,
  message?: string
): Response {
  const response: StandardResponse = {
    success: true,
    code: null,
    message: message || null,
    ui_behavior: 'silent',
    data
  }
  
  return new Response(
    JSON.stringify(response),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Create standardized error response - ALWAYS HTTP 200
export function errorResponse(
  code: ErrorCode,
  message: string,
  data?: Record<string, unknown>
): Response {
  const ui_behavior = getUiBehavior(code)
  
  const response: StandardResponse = {
    success: false,
    code,
    message,
    ui_behavior,
    data
  }
  
  console.error(`[EdgeFunction] Error: ${code} - ${message}`, data || '')
  
  // ALWAYS return HTTP 200 - errors are in the response body
  return new Response(
    JSON.stringify(response),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

// Wrap entire function logic in try/catch - guaranteed no HTTP errors
export async function safeHandler(
  handler: () => Promise<Response>
): Promise<Response> {
  try {
    return await handler()
  } catch (error) {
    console.error('[EdgeFunction] Unhandled error:', error)
    const message = error instanceof Error ? error.message : 'Erro interno'
    return errorResponse(
      ErrorCodes.INTERNAL_ERROR,
      'Ocorreu um erro inesperado. Tente novamente.',
      { internal_message: message }
    )
  }
}

// UUID validation
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Validate UUID
export function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id)
}
