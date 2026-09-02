import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { BuildWithAkClient, type BuildWithAkEnvironment } from './client/client';
import { createMcpServer } from './mcp/factory';
import { createHttpServices } from './mcp/http-services';
import {
  buildProtectedResourceMetadata,
  buildWwwAuthenticate,
  verifyBearerToken,
  extractBearerToken,
  DEFAULT_SCOPES,
  hasRequiredScope,
} from './auth/oauth-worker';
import { validateApiKeyHeader, readApiKeyHeader } from './auth/api-key-worker';

export interface WorkerEnv {
  AGENTKIT_ENV?: string;
  /** Optional service API key enabling OAuth single-tenant self-deploy (never a customer secret in shared deployments). */
  AGENTKIT_API_KEY?: string;
  OAUTH_ISSUER?: string;
  OAUTH_JWKS_URL?: string;
  OAUTH_AUTH_SERVERS?: string;
  WORKER_RESOURCE_URL?: string;
  /** When 'true', respond with application/json instead of streamed text/event-stream. */
  MCP_JSON_RESPONSE?: string;
}

const METADATA_PATH = '/.well-known/oauth-protected-resource';

function resourceUrl(env: WorkerEnv, url: URL): string {
  return env.WORKER_RESOURCE_URL ?? url.origin;
}

function authServers(env: WorkerEnv): string[] {
  if (env.OAUTH_AUTH_SERVERS) return env.OAUTH_AUTH_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (env.OAUTH_ISSUER) return [env.OAUTH_ISSUER];
  return ['https://agentkit.best'];
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

interface AuthOutcome {
  ok: boolean;
  apiKey?: string;
  challenge?: Response;
}

async function authenticate(request: Request, env: WorkerEnv, url: URL): Promise<AuthOutcome> {
  const metadataUrl = `${resourceUrl(env, url)}${METADATA_PATH}`;
  const challenge = () =>
    jsonResponse(
      { error: 'unauthorized', error_description: 'Authentication required.' },
      401,
      { 'WWW-Authenticate': buildWwwAuthenticate(metadataUrl) }
    );

  // Lane 1: customer x-api-key passthrough (multi-tenant base lane).
  const apiKeyHeader = readApiKeyHeader(request.headers);
  if (apiKeyHeader) {
    const validation = validateApiKeyHeader(apiKeyHeader);
    if (validation.valid && validation.apiKey) {
      return { ok: true, apiKey: validation.apiKey };
    }
    return { ok: false, challenge: jsonResponse({ error: 'invalid_api_key', error_description: validation.reason }, 401) };
  }

  // Lane 2: OAuth 2.1 Bearer (RS role). Base contract has no upstream token
  // exchange, so a valid Bearer authorizes use of the worker's own configured
  // service key (single-tenant self-deploy). Without that key, fail closed.
  const bearer = extractBearerToken(request.headers.get('Authorization'));
  if (bearer) {
    if (!env.OAUTH_ISSUER || !env.OAUTH_JWKS_URL) {
      return { ok: false, challenge: jsonResponse({ error: 'oauth_not_configured', error_description: 'OAuth is not configured on this worker.' }, 403) };
    }
    const result = await verifyBearerToken(bearer, {
      issuer: env.OAUTH_ISSUER,
      audience: resourceUrl(env, url),
      jwksUrl: env.OAUTH_JWKS_URL,
    });
    if (!result.valid) {
      return { ok: false, challenge: challenge() };
    }
    // Enforce scope: when the token carries a scope claim, at least one of the
    // resource's advertised scopes must be present. A scopeless token is
    // accepted (some authorization servers omit the claim) but a token scoped
    // to something else entirely is rejected — the advertised scopes are not
    // cosmetic.
    if (!hasRequiredScope(result.scopes, DEFAULT_SCOPES)) {
      return {
        ok: false,
        challenge: jsonResponse(
          {
            error: 'insufficient_scope',
            error_description: `Token scopes [${(result.scopes ?? []).join(' ')}] do not include any of [${DEFAULT_SCOPES.join(' ')}].`,
          },
          403,
          { 'WWW-Authenticate': `Bearer scope="${DEFAULT_SCOPES.join(' ')}", error="insufficient_scope"` }
        ),
      };
    }
    if (!env.AGENTKIT_API_KEY) {
      return {
        ok: false,
        challenge: jsonResponse(
          {
            error: 'upstream_delegation_unavailable',
            error_description:
              'OAuth Bearer is valid but this worker has no configured service key. Deploy with AGENTKIT_API_KEY (single-tenant) or send x-api-key.',
          },
          403
        ),
      };
    }
    return { ok: true, apiKey: env.AGENTKIT_API_KEY };
  }

  return { ok: false, challenge: challenge() };
}

/**
 * Cloudflare Workers Streamable HTTP MCP entrypoint. Single-endpoint handler
 * supporting application/json and text/event-stream responses, RFC 9728
 * Protected Resource Metadata, OAuth 2.1 Bearer validation, and x-api-key.
 */
export default {
  async fetch(request: Request, env: WorkerEnv, _ctx?: unknown): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === METADATA_PATH) {
      return jsonResponse(
        buildProtectedResourceMetadata({
          resource: resourceUrl(env, url),
          authorizationServers: authServers(env),
          scopes: DEFAULT_SCOPES,
        })
      );
    }

    if (url.pathname !== '/' && url.pathname !== '/mcp') {
      return jsonResponse({ error: 'not_found' }, 404);
    }

    const auth = await authenticate(request, env, url);
    if (!auth.ok || !auth.apiKey) {
      return auth.challenge ?? jsonResponse({ error: 'unauthorized' }, 401);
    }

    const environment: BuildWithAkEnvironment = env.AGENTKIT_ENV === 'staging' ? 'staging' : 'production';
    const client = new BuildWithAkClient({ apiKey: auth.apiKey, environment });
    const services = createHttpServices({ client });
    const server = createMcpServer(services);

    // Stateless: no session storage, no legacy /sse endpoint.
    const jsonMode = env.MCP_JSON_RESPONSE === 'true';
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: jsonMode,
    });
    await server.connect(transport);

    const response = await transport.handleRequest(request);

    // In JSON mode the body is fully materialized, so the per-request server can
    // be closed now. In SSE mode the body is a stream still being written by
    // tool handlers — closing here would truncate it; the stream and its
    // per-request server are released when the response stream ends.
    if (jsonMode) {
      await server.close();
    }
    return response;
  },
};
