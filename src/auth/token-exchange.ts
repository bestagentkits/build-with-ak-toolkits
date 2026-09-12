import { parseScopes } from './oauth-worker';

export const API_RESOURCE = 'https://agentkit.best/api/build-with-ak';
const ACCESS_TOKEN_TYPE = 'urn:ietf:params:oauth:token-type:access_token';

export class TokenExchangeError extends Error {
  constructor(public readonly status: number, public readonly code: string) {
    super('Unable to delegate this OAuth request.');
  }
}

/** A delegated credential exists only for this MCP request, never in a shared cache. */
export async function exchangeAccessToken(input: {
  subjectToken: string;
  clientSecret: string;
  issuer: string;
  scopes: string[];
}): Promise<{ accessToken: string; scopes: string[] }> {
  let response: Response;
  try {
    response = await fetch(new URL('/oauth/token', input.issuer), {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
        client_id: 'build-with-ak-mcp',
        client_secret: input.clientSecret,
        subject_token: input.subjectToken,
        subject_token_type: ACCESS_TOKEN_TYPE,
        requested_token_type: ACCESS_TOKEN_TYPE,
        resource: API_RESOURCE,
      }),
    });
  } catch {
    throw new TokenExchangeError(503, 'temporarily_unavailable');
  }
  let data: Record<string, unknown>;
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error();
    data = body as Record<string, unknown>;
  } catch {
    throw new TokenExchangeError(502, 'invalid_exchange_response');
  }
  if (!response.ok) {
    if (data.error === 'invalid_grant' || data.error === 'invalid_token') {
      throw new TokenExchangeError(401, 'invalid_token');
    }
    if (data.error === 'insufficient_scope' || data.error === 'invalid_scope') {
      throw new TokenExchangeError(403, 'insufficient_scope');
    }
    if (data.error === 'access_denied') throw new TokenExchangeError(403, 'access_denied');
    // Never expose an authorization server response, which may contain credentials.
    throw new TokenExchangeError(503, 'temporarily_unavailable');
  }
  const scopes = parseScopes(data.scope);
  if (typeof data.access_token !== 'string' || !data.access_token.trim() ||
      /\s/.test(data.access_token) || data.access_token === input.subjectToken ||
      typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer' ||
      !Number.isInteger(data.expires_in) || (data.expires_in as number) <= 0 || (data.expires_in as number) > 60 ||
      !scopes || scopes.some((scope) => !input.scopes.includes(scope)) ||
      ('refresh_token' in data) ||
      (data.issued_token_type !== undefined && data.issued_token_type !== ACCESS_TOKEN_TYPE)) {
    throw new TokenExchangeError(502, 'invalid_exchange_response');
  }
  return { accessToken: data.access_token, scopes };
}
