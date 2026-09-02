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
const AI_PLUGIN_PATH = '/.well-known/ai-plugin.json';
const OPENAPI_PATH = '/openapi.json';
const HEALTH_PATH = '/health';

function resourceUrl(env: WorkerEnv, url: URL): string {
  return env.WORKER_RESOURCE_URL ?? url.origin;
}

function authServers(env: WorkerEnv): string[] {
  if (env.OAUTH_AUTH_SERVERS) return env.OAUTH_AUTH_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  if (env.OAUTH_ISSUER) return [env.OAUTH_ISSUER];
  return ['https://agentkit.best'];
}

function buildAiPluginManifest(env: WorkerEnv, url: URL) {
  const origin = resourceUrl(env, url);
  const authServer = authServers(env)[0] ?? 'https://agentkit.best';
  return {
    schema_version: 'v1',
    name_for_human: 'Build with AK',
    name_for_model: 'build_with_ak',
    description_for_human: 'Create, customize, and submit product showcases to the Build with AK Customer Directory on agentkit.best.',
    description_for_model: 'Official plugin and action interface for authoring, validating, previewing, and managing product showcase listings and layout blocks on Build with AK (agentkit.best).',
    auth: {
      type: 'oauth',
      client_url: `${authServer}/oauth/authorize`,
      scope: 'build-with-ak:read build-with-ak:write',
      authorization_url: `${authServer}/oauth/token`,
      authorization_content_type: 'application/x-www-form-urlencoded',
      verification_tokens: {},
    },
    api: {
      type: 'openapi',
      url: `${origin}/openapi.json`,
      is_user_authenticated: false,
    },
    logo_url: 'https://agentkit.best/logo.png',
    contact_email: 'support@agentkit.best',
    legal_info_url: 'https://agentkit.best/legal',
  };
}

export function buildOpenApiSpec(origin: string) {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Build with AK API & MCP Service',
      version: '1.0.0',
      description: 'Official API and Model Context Protocol (MCP) server for authoring, validating, and submitting product showcases to the Build with AK Customer Directory on agentkit.best.',
      contact: {
        name: 'AgentKit Support',
        url: 'https://agentkit.best',
        email: 'support@agentkit.best',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [{ url: origin, description: 'Production Cloudflare Worker Edge Server' }],
    security: [
      { ApiKeyAuth: [] },
      { OAuth2: ['build-with-ak:read', 'build-with-ak:write'] },
    ],
    paths: {
      '/': {
        get: {
          summary: 'Service Index & Discovery',
          description: 'Returns service capability index, endpoint URLs, and documentation links.',
          operationId: 'getServiceIndex',
          security: [],
          responses: {
            '200': {
              description: 'Service index metadata',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ServiceIndex' },
                },
              },
            },
          },
        },
      },
      '/health': {
        get: {
          summary: 'Health Check',
          description: 'Returns status ok and current timestamp.',
          operationId: 'getHealth',
          security: [],
          responses: {
            '200': {
              description: 'Service health status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: { type: 'string', example: 'ok' },
                      timestamp: { type: 'string', format: 'date-time' },
                    },
                    required: ['status', 'timestamp'],
                  },
                },
              },
            },
          },
        },
      },
      '/.well-known/oauth-protected-resource': {
        get: {
          summary: 'OAuth 2.1 Protected Resource Metadata (RFC 9728)',
          description: 'Exposes resource URI, authorization servers, and supported scopes for OAuth discovery.',
          operationId: 'getOAuthProtectedResourceMetadata',
          security: [],
          responses: {
            '200': {
              description: 'RFC 9728 Metadata Document',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ProtectedResourceMetadata' },
                },
              },
            },
          },
        },
      },
      '/.well-known/ai-plugin.json': {
        get: {
          summary: 'AI Plugin Manifest',
          description: 'OpenAI AI Plugin discovery manifest for ChatGPT and Custom GPT Actions.',
          operationId: 'getAiPluginManifest',
          security: [],
          responses: {
            '200': {
              description: 'AI Plugin manifest',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AiPluginManifest' },
                },
              },
            },
          },
        },
      },
      '/openapi.json': {
        get: {
          summary: 'OpenAPI 3.1.0 Specification',
          description: 'Returns this OpenAPI schema definition.',
          operationId: 'getOpenApiSpec',
          security: [],
          responses: {
            '200': {
              description: 'OpenAPI schema',
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
          },
        },
      },
      '/mcp': {
        post: {
          summary: 'Streamable HTTP MCP Endpoint',
          description: 'Executes Model Context Protocol (MCP) JSON-RPC 2.0 commands over Streamable HTTP.',
          operationId: 'executeMcp',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    jsonrpc: { type: 'string', example: '2.0' },
                    id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                    method: { type: 'string', example: 'tools/call' },
                    params: { type: 'object' },
                  },
                  required: ['jsonrpc', 'method'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Streamed MCP response or JSON-RPC result',
              content: {
                'text/event-stream': { schema: { type: 'string' } },
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      jsonrpc: { type: 'string', example: '2.0' },
                      id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                      result: { type: 'object' },
                      error: { type: 'object' },
                    },
                  },
                },
              },
            },
            '401': {
              description: 'Unauthorized — Missing or invalid API key or Bearer token with WWW-Authenticate challenge',
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'AgentKit customer API key (ck_live_...)',
        },
        OAuth2: {
          type: 'oauth2',
          description: 'OAuth 2.1 Authorization Code Flow with PKCE (S256)',
          flows: {
            authorizationCode: {
              authorizationUrl: 'https://agentkit.best/oauth/authorize',
              tokenUrl: 'https://agentkit.best/oauth/token',
              scopes: {
                'build-with-ak:read': 'Read product showcase draft and live listing',
                'build-with-ak:write': 'Create, edit layout blocks, upload media, and submit showcase',
              },
            },
          },
        },
      },
      schemas: {
        ServiceIndex: {
          type: 'object',
          properties: {
            service: { type: 'string', example: 'Build with AK MCP Server' },
            version: { type: 'string', example: '1.0.0' },
            documentation: { type: 'string', format: 'uri' },
            endpoints: {
              type: 'object',
              properties: {
                mcp: { type: 'string' },
                oauth_metadata: { type: 'string' },
                ai_plugin: { type: 'string' },
                openapi: { type: 'string' },
              },
            },
          },
          required: ['service', 'version', 'endpoints'],
        },
        ProtectedResourceMetadata: {
          type: 'object',
          properties: {
            resource: { type: 'string', format: 'uri' },
            authorization_servers: {
              type: 'array',
              items: { type: 'string', format: 'uri' },
            },
            scopes_supported: {
              type: 'array',
              items: { type: 'string' },
            },
            bearer_methods_supported: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['resource', 'authorization_servers', 'scopes_supported', 'bearer_methods_supported'],
        },
        AiPluginManifest: {
          type: 'object',
          properties: {
            schema_version: { type: 'string', example: 'v1' },
            name_for_human: { type: 'string', example: 'Build with AK' },
            name_for_model: { type: 'string', example: 'build_with_ak' },
            description_for_human: { type: 'string' },
            description_for_model: { type: 'string' },
            auth: { type: 'object' },
            api: { type: 'object' },
            logo_url: { type: 'string', format: 'uri' },
            contact_email: { type: 'string', format: 'email' },
            legal_info_url: { type: 'string', format: 'uri' },
          },
          required: [
            'schema_version',
            'name_for_human',
            'name_for_model',
            'description_for_human',
            'description_for_model',
            'auth',
            'api',
            'logo_url',
            'contact_email',
            'legal_info_url',
          ],
        },
      },
    },
  };
}

function buildServiceIndex(origin: string) {
  return {
    service: 'Build with AK MCP Server',
    version: '1.0.0',
    documentation: 'https://agentkit.best/build-with-ak',
    endpoints: {
      mcp: `${origin}/mcp`,
      oauth_metadata: `${origin}${METADATA_PATH}`,
      ai_plugin: `${origin}${AI_PLUGIN_PATH}`,
      openapi: `${origin}${OPENAPI_PATH}`,
      health: `${origin}${HEALTH_PATH}`,
    },
  };
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
    const origin = resourceUrl(env, url);

    if (request.method === 'GET') {
      if (url.pathname === METADATA_PATH) {
        return jsonResponse(
          buildProtectedResourceMetadata({
            resource: origin,
            authorizationServers: authServers(env),
            scopes: DEFAULT_SCOPES,
          })
        );
      }

      if (url.pathname === AI_PLUGIN_PATH) {
        return jsonResponse(buildAiPluginManifest(env, url));
      }

      if (url.pathname === OPENAPI_PATH) {
        return jsonResponse(buildOpenApiSpec(origin));
      }

      if (url.pathname === HEALTH_PATH) {
        return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
      }

      // Plain browser/discovery GET / returns service index
      if (url.pathname === '/' && !request.headers.get('x-api-key') && !request.headers.get('Authorization') && !request.headers.get('Accept')?.includes('text/event-stream')) {
        return jsonResponse(buildServiceIndex(origin));
      }
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
