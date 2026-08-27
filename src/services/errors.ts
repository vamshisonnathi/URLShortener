// Typed errors so routes can map to HTTP status without leaking internals.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class AliasConflictError extends AppError {
  constructor(alias: string) {
    super(409, 'ALIAS_TAKEN', `customAlias '${alias}' is already in use`);
  }
}

export class CodeGenerationError extends AppError {
  constructor() {
    super(500, 'CODE_GEN_FAILED', 'failed to allocate a unique short code');
  }
}
