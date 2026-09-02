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
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      audience: config.audience,
    });
    const scopeClaim = typeof payload.scope === 'string' ? payload.scope.split(' ') : [];
    return { valid: true, subject: payload.sub, scopes: scopeClaim };
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : 'Token verification failed' };
  }
}

export function extractBearerToken(authorizationHeader: string | null): string | undefined {
  if (!authorizationHeader) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorizationHeader.trim());
  return match ? match[1] : undefined;
}
