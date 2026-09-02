export class BuildWithAkError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, status: number = 500, code?: string, details?: unknown) {
    super(message);
    this.name = 'BuildWithAkError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BuildWithAkAuthError extends BuildWithAkError {
  constructor(message: string = 'Authentication failed. Please verify your API key.', status: number = 401) {
    super(message, status, 'AUTH_FAILED');
    this.name = 'BuildWithAkAuthError';
  }
}

export class BuildWithAkConflictError extends BuildWithAkError {
  constructor(message: string = 'Revision conflict. The remote draft was updated concurrently.', code: string = 'STALE_REVISION') {
    super(message, 409, code);
    this.name = 'BuildWithAkConflictError';
  }
}

export class BuildWithAkValidationError extends BuildWithAkError {
  constructor(message: string = 'Validation failed.', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
    this.name = 'BuildWithAkValidationError';
  }
}

export class BuildWithAkNotFoundError extends BuildWithAkError {
  constructor(message: string = 'Resource not found.') {
    super(message, 404, 'NOT_FOUND');
    this.name = 'BuildWithAkNotFoundError';
  }
}

export class BuildWithAkRateLimitError extends BuildWithAkError {
  public readonly retryAfter?: number;

  constructor(message: string = 'Too many requests. Please try again later.', retryAfter?: number) {
    super(message, 429, 'RATE_LIMITED');
    this.name = 'BuildWithAkRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class BuildWithAkCapabilityError extends BuildWithAkError {
  public readonly capability: string;

  constructor(
    capability: string,
    message: string = `Capability "${capability}" is not supported on the active backend or requires target contract extension.`
  ) {
    super(message, 501, 'CAPABILITY_UNSUPPORTED');
    this.name = 'BuildWithAkCapabilityError';
    this.capability = capability;
  }
}
