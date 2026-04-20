/**
 * Errores de dominio. Se serializan en la API como
 * { error: { code, message, details? } } con el HTTP status adecuado.
 */

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'PLAN_DAY_PAST'
  | 'CLIENT_HAS_ACTIVE_PLAN'
  | 'SESSION_NOT_ACTIVE'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class DomainError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}

export const statusForCode: Record<ErrorCode, number> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  CONFLICT: 409,
  PLAN_DAY_PAST: 409,
  CLIENT_HAS_ACTIVE_PLAN: 409,
  SESSION_NOT_ACTIVE: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};
