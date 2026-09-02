export interface ApiKeyValidationResult {
  valid: boolean;
  apiKey?: string;
  reason?: string;
}

const CUSTOMER_KEY_PREFIX = 'ck_live_';

/**
 * Validate the inbound customer API key header. The worker forwards the key
 * upstream to ak-web, which is the authoritative validator; here we enforce the
 * expected `ck_live_` format and reject obviously malformed keys before making
 * any upstream call.
 */
export function validateApiKeyHeader(headerValue: string | null): ApiKeyValidationResult {
  if (!headerValue) {
    return { valid: false, reason: 'Missing x-api-key header' };
  }
  const key = headerValue.trim();
  if (!key.startsWith(CUSTOMER_KEY_PREFIX)) {
    return { valid: false, reason: `API key must start with "${CUSTOMER_KEY_PREFIX}"` };
  }
  if (key.length < 16) {
    return { valid: false, reason: 'API key is too short to be valid' };
  }
  return { valid: true, apiKey: key };
}

export function readApiKeyHeader(headers: Headers): string | null {
  return headers.get('x-api-key') ?? headers.get('X-API-Key');
}
