/**
 * @file Custom Error Classes
 * @description Typed application error classes mapped to HTTP status codes and domain error codes.
 * @module services/errors
 */

/**
 * Base application error class extending native `Error`.
 */
export class AppError extends Error {
  /**
   * Constructs an `AppError`.
   *
   * @param statusCode - HTTP status code (e.g. 409, 500).
   * @param code - Machine-readable error code string (e.g. `ALIAS_TAKEN`).
   * @param message - Human-readable error message.
   */
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Thrown when a requested custom alias is already in use by another link (HTTP 409 Conflict).
 */
export class AliasConflictError extends AppError {
  /**
   * @param alias - The taken custom alias string.
   */
  constructor(alias: string) {
    super(409, 'ALIAS_TAKEN', `customAlias '${alias}' is already in use`);
  }
}

/**
 * Thrown when the service fails to generate a unique short code after maximum retry attempts (HTTP 500).
 */
export class CodeGenerationError extends AppError {
  constructor() {
    super(500, 'CODE_GEN_FAILED', 'failed to allocate a unique short code');
  }
}
