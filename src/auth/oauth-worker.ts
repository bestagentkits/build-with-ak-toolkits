import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface ProtectedResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
  bearer_methods_supported: string[];
}

export const DEFAULT_SCOPES = ['build-with-ak:read', 'build-with-ak:write'];

/** RFC 9728 Protected Resource Metadata document served at /.well-known/oauth-protected-resource. */
export function buildProtectedResourceMetadata(config: {
  resource: string;
  authorizationServers: string[];
  scopes?: string[];
}): ProtectedResourceMetadata {
  return {
    resource: config.resource,
    authorization_servers: config.authorizationServers,
    scopes_supported: config.scopes ?? DEFAULT_SCOPES,
    bearer_methods_supported: ['header'],
  };
}

/** WWW-Authenticate challenge pointing clients at the resource metadata (RFC 9728 §5.1). */
export function buildWwwAuthenticate(resourceMetadataUrl: string): string {
  return `Bearer resource_metadata="${resourceMetadataUrl}"`;
}

export interface BearerValidationConfig {
  issuer: string;
  audience: string;
  jwksUrl: string;
}

export interface BearerValidationResult {
  valid: boolean;
  subject?: string;
  scopes?: string[];
  expiresAt?: number;
  reason?: string;
}

// A remote JWKS is cached per URL to avoid refetching on every request.
const jwksCache: Record<string, ReturnType<typeof createRemoteJWKSet>> = {};

function getJwks(jwksUrl: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksCache[jwksUrl];
  if (cached) return cached;
  const created = createRemoteJWKSet(new URL(jwksUrl));
  jwksCache[jwksUrl] = created;
  return created;
}

/**
 * Verify an inbound OAuth 2.1 Bearer token as the MCP Resource Server: checks
 * issuer, audience (this worker's resource URI), expiry, and cryptographic
 * signature against the AgentKit authorization server's JWKS.
 */
export async function verifyBearerToken(token: string, config: BearerValidationConfig): Promise<BearerValidationResult> {
  try {
    const jwks = getJwks(config.jwksUrl);
    const { payload, protectedHeader } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ['ES256'],
      typ: 'at+jwt',
      requiredClaims: ['iss', 'aud', 'sub', 'exp', 'iat', 'jti', 'client_id', 'grant_id', 'scope'],
    });
    const scopes = parseScopes(payload.scope);
    if (protectedHeader.typ !== 'at+jwt' || payload.aud !== config.audience || !scopes ||
        ['sub', 'jti', 'client_id', 'grant_id'].some((key) => typeof payload[key] !== 'string' || !payload[key]!.trim()) ||
        !Number.isInteger(payload.iat) || payload.iat! > Math.floor(Date.now() / 1000) ||
        !Number.isInteger(payload.exp) || payload.exp! <= payload.iat!) {
      return { valid: false, reason: 'Invalid access token claims' };
    }
    return { valid: true, subject: payload.sub, scopes, expiresAt: payload.exp };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'Token verification failed' };
  }
}

export function extractBearerToken(authorizationHeader: string | null): string | undefined {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match ? match[1] : undefined;
}

/**
 * At least one explicitly required scope must be granted. Missing scopes fail closed.
 */
export function hasRequiredScope(tokenScopes: string[] | undefined, requiredScopes: string[]): boolean {
  return Boolean(tokenScopes?.some((s) => requiredScopes.includes(s)));
}

export function parseScopes(value: unknown): string[] | undefined {
  if (typeof value !== 'string' || !value || value.trim() !== value) return undefined;
  const scopes = value.split(' ');
  return scopes.every((scope) => DEFAULT_SCOPES.includes(scope)) ? scopes : undefined;
}
