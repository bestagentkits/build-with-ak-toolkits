import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWTPayload } from 'jose';
import worker, { type WorkerEnv } from '../../src/worker';
import { verifyBearerToken } from '../../src/auth/oauth-worker';
import { createTools, type McpServices } from '../../src/mcp/tools';
import { MCP_TOOL_SCOPES } from '../../src/mcp/tool-scopes';
import { BuildWithAkClient } from '../../src/client/client';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const keyState = vi.hoisted(() => ({ jwks: undefined as ReturnType<typeof createLocalJWKSet> | undefined }));
vi.mock('jose', async (importOriginal) => {
  const actual = await importOriginal<typeof import('jose')>();
  return { ...actual, createRemoteJWKSet: () => (...args: Parameters<ReturnType<typeof createLocalJWKSet>>) => keyState.jwks!(...args) };
});
const issuer = 'https://agentkit.best';
const resource = 'https://bwak.agentkit.best/mcp';
const env: WorkerEnv = {
  OAUTH_ISSUER: issuer, OAUTH_JWKS_URL: `${issuer}/.well-known/jwks.json`,
  WORKER_RESOURCE_URL: resource, OAUTH_CLIENT_SECRET: 'test-exchange-client-secret',
  AGENTKIT_API_KEY: 'ck_live_must_never_be_used', MCP_JSON_RESPONSE: 'true',
};
let privateKey: CryptoKey;
async function token(overrides: JWTPayload = {}, omit?: string, typ = 'at+jwt') {
  const now = Math.floor(Date.now() / 1000);
  const claims: JWTPayload = { iss: issuer, aud: resource, sub: 'owner-a', exp: now + 600, iat: now,
    jti: crypto.randomUUID(), client_id: 'browser-client', grant_id: 'grant-a', scope: 'build-with-ak:read build-with-ak:write', ...overrides };
  if (omit) delete claims[omit];
  return new SignJWT(claims).setProtectedHeader({ alg: 'ES256', typ, kid: 'test-key' }).sign(privateKey);
}
function request(bearer: string, method = 'tools/list', params: unknown = {}) {
  return new Request(resource, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`,
    Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
}
const exchangeBody = (accessToken = 'delegated-owner-a', scope = 'build-with-ak:read build-with-ak:write') =>
  ({ access_token: accessToken, token_type: 'Bearer', expires_in: 60, scope });
let upstream: ReturnType<typeof vi.fn>;
beforeAll(async () => {
  const pair = await generateKeyPair('ES256'); privateKey = pair.privateKey;
  const key = await exportJWK(pair.publicKey); key.kid = 'test-key'; key.alg = 'ES256';
  keyState.jwks = createLocalJWKSet({ keys: [key] });
});
beforeEach(() => {
  upstream = vi.fn(async (url: URL | string) => String(url).endsWith('/oauth/token')
    ? Response.json(exchangeBody()) : Response.json({ listing: { id: 'owner-a-listing' } }));
  vi.stubGlobal('fetch', upstream);
});
afterEach(() => vi.unstubAllGlobals());

describe('OAuth access token validation', () => {
  const verify = (value: string) => verifyBearerToken(value, { issuer, audience: resource, jwksUrl: `${issuer}/.well-known/jwks.json` });
  it('verifies a signed ES256 access token with the canonical resource audience', async () => {
    expect(await verify(await token())).toMatchObject({ valid: true, subject: 'owner-a' });
  });
  it.each(['iss','aud','sub','exp','iat','jti','client_id','grant_id','scope'])('requires %s', async (claim) => {
    expect((await verify(await token({}, claim))).valid).toBe(false);
  });
  it.each([
    { aud: 'https://bwak.agentkit.best' }, { aud: ['https://bwak.agentkit.best/mcp'] },
    { aud: 'https://agentkit.best/api/build-with-ak' }, { iss: 'https://other.example' },
    { exp: 1 }, { iat: Math.floor(Date.now()/1000)+600 }, { sub: '' }, { grant_id: '' },
    { scope: '' }, { scope: 'openid' }, { scope: 'build-with-ak:read openid' },
  ])('rejects invalid claims %j', async (claims) => {
    expect((await verify(await token(claims))).valid).toBe(false);
  });
  it('requires access-token typ and an allowed signature algorithm', async () => {
    for (const typ of ['JWT', 'application/at+jwt', 'AT+JWT']) {
      expect((await verify(await token({}, undefined, typ))).valid).toBe(false);
    }
    const forged = await new SignJWT({ sub: 'owner-a' }).setProtectedHeader({ alg: 'HS256', typ: 'at+jwt' }).sign(new TextEncoder().encode('irrelevant-test-key-at-least-32-bytes'));
    expect((await verify(forged)).valid).toBe(false);
  });
});

describe('Per-user Worker OAuth delegation', () => {
  it.each([false, true])('completes an SDK OAuth handshake, discovery and read call with JSON mode %s', async (jsonMode) => {
    const subject = await token({ scope: 'build-with-ak:read' });
    upstream.mockImplementation(async (url: URL | string) => String(url).endsWith('/oauth/token')
      ? Response.json(exchangeBody('delegated-owner-a', 'build-with-ak:read'))
      : Response.json({ listing: { id: 'owner-a-listing' } }));
    const messages: string[] = [];
    const responses: { method: string; status: number; contentType: string | null }[] = [];
    const provider = {
      redirectUrl: 'http://127.0.0.1:3000/callback',
      clientMetadata: { redirect_uris: ['http://127.0.0.1:3000/callback'], token_endpoint_auth_method: 'none' as const },
      clientInformation: () => ({ client_id: 'browser-client' }),
      tokens: vi.fn(() => ({ access_token: subject, token_type: 'Bearer' })),
      saveTokens: vi.fn(), redirectToAuthorization: vi.fn(), saveCodeVerifier: vi.fn(),
      codeVerifier: () => 'unused-existing-access-token',
    };
    const transport = new StreamableHTTPClientTransport(new URL(resource), {
      authProvider: provider,
      fetch: async (input, init) => {
        const req = new Request(input, init);
        expect(req.headers.get('Authorization')).toBe(`Bearer ${subject}`);
        expect(req.headers.has('x-api-key')).toBe(false);
        const method = req.method === 'POST' ? (await req.clone().json()).method as string : req.method;
        if (req.method === 'POST') messages.push(method);
        const response = await worker.fetch(req, { ...env, MCP_JSON_RESPONSE: jsonMode ? 'true' : undefined });
        responses.push({ method, status: response.status, contentType: response.headers.get('content-type') });
        return response;
      },
    });
    const client = new Client({ name: 'oauth-sdk-client', version: '1.0.0' });
    try {
      await client.connect(transport);
      expect(client.getServerVersion()?.name).toBe('build-with-ak');
      const tools = await client.listTools();
      expect(tools.tools.some(tool => tool.name === 'build_with_ak_get_listing')).toBe(true);
      const result = await client.callTool({ name: 'build_with_ak_get_listing', arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([{ type: 'text', text: JSON.stringify({ listing: { id: 'owner-a-listing' } }, null, 2) }]);
      expect(messages).toEqual(['initialize', 'notifications/initialized', 'tools/list', 'tools/call']);
      expect(responses.find(response => response.method === 'notifications/initialized')?.status).toBe(202);
      for (const method of ['initialize', 'tools/list', 'tools/call']) {
        expect(responses.find(response => response.method === method)).toMatchObject({
          status: 200, contentType: expect.stringContaining(jsonMode ? 'application/json' : 'text/event-stream'),
        });
      }
      const exchanges = upstream.mock.calls.filter(([url]) => String(url).endsWith('/oauth/token'));
      expect(exchanges.length).toBeGreaterThanOrEqual(4);
      for (const [, init] of exchanges) expect((init.body as URLSearchParams).get('subject_token')).toBe(subject);
      const apiCalls = upstream.mock.calls.filter(([url]) => !String(url).endsWith('/oauth/token'));
      expect(apiCalls).toHaveLength(1);
      expect(new Headers(apiCalls[0]![1].headers).get('Authorization')).toBe('Bearer delegated-owner-a');
      expect(provider.redirectToAuthorization).not.toHaveBeenCalled();
      expect(provider.saveTokens).not.toHaveBeenCalled();
    } finally {
      await client.close();
    }
  });
  it('exchanges once and sends only the delegated credential upstream', async () => {
    const subject = await token();
    const response = await worker.fetch(request(subject, 'tools/call', { name: 'build_with_ak_get_listing', arguments: {} }), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect((await response.json()).result.isError).not.toBe(true);
    expect(upstream).toHaveBeenCalledTimes(2);
    const [exchangeUrl, exchangeInit] = upstream.mock.calls[0]!;
    expect(String(exchangeUrl)).toBe(`${issuer}/oauth/token`);
    const fields = exchangeInit.body as URLSearchParams;
    expect(Object.fromEntries(fields)).toEqual({ grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      client_id: 'build-with-ak-mcp', client_secret: env.OAUTH_CLIENT_SECRET, subject_token: subject,
      subject_token_type: 'urn:ietf:params:oauth:token-type:access_token', requested_token_type: 'urn:ietf:params:oauth:token-type:access_token', resource: 'https://agentkit.best/api/build-with-ak' });
    expect(exchangeInit.redirect).toBe('error');
    expect(String(upstream.mock.calls[1]![0])).toBe('https://agentkit.best/api/build-with-ak/listing');
    const headers = new Headers(upstream.mock.calls[1]![1].headers);
    expect(headers.get('Authorization')).toBe('Bearer delegated-owner-a');
    expect(headers.has('x-api-key')).toBe(false);
    expect(headers.get('Authorization')).not.toContain(subject);
  });
  it.each(['build_with_ak_update_listing','build_with_ak_submit_listing','build_with_ak_patch_block','build_with_ak_reorder_blocks','build_with_ak_upload_media_payload'])('read scope cannot execute %s', async (name) => {
    const response = await worker.fetch(request(await token({ scope: 'build-with-ak:read' }), 'tools/call', { name, arguments: {} }), env);
    expect(response.status).toBe(403);
    expect(response.headers.get('www-authenticate')).toContain('error="insufficient_scope"');
    expect(response.headers.get('www-authenticate')).toContain('scope="build-with-ak:write"');
    expect(upstream).not.toHaveBeenCalled();
  });
  it('write-only scope cannot read customer resources', async () => {
    const response = await worker.fetch(request(await token({ scope: 'build-with-ak:write' }), 'resources/read', { uri: 'build-with-ak://remote/analytics' }), env);
    expect(response.status).toBe(403); expect(upstream).not.toHaveBeenCalled();
  });
  it.each(['build-with-ak:read','build-with-ak:write'])('allows discovery with %s', async (scope) => {
    upstream.mockImplementation(async () => Response.json(exchangeBody('delegated', scope)));
    const response = await worker.fetch(request(await token({ scope })), env);
    expect(response.status).toBe(200); expect((await response.json()).result.tools).toBeInstanceOf(Array);
    expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('authorizes writes with write scope before sending the delegated token', async () => {
    const response = await worker.fetch(request(await token(), 'tools/call', { name: 'build_with_ak_reorder_blocks', arguments: { blockIds: ['block-a'] } }), env);
    expect(response.status).toBe(200); await response.text(); expect(upstream).toHaveBeenCalledTimes(2);
    expect(upstream.mock.calls[1]![1].method).toBe('POST');
  });
  it('has explicit authorization policy for every implemented tool', () => {
    const services = { transport: 'stdio', getClient: () => new BuildWithAkClient({ apiKey: 'test' }), uploadFromPath: vi.fn(), uploadFromPayload: vi.fn() } as McpServices;
    expect(createTools(services).map(t=>t.name).sort()).toEqual(Object.keys(MCP_TOOL_SCOPES).sort());
  });
  it('challenges missing credentials with minimal read scope and rejects mixed credentials', async () => {
    const unauth = await worker.fetch(new Request(resource, { method: 'POST' }), env);
    expect(unauth.status).toBe(401);
    expect(unauth.headers.get('www-authenticate')).toContain('scope="build-with-ak:read"');
    const mixed = request(await token()); mixed.headers.set('x-api-key','ck_live_legacy_customer_key');
    expect((await worker.fetch(mixed, env)).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('invalid signed claims stop before exchange', async () => {
    const response = await worker.fetch(request(await token({}, 'grant_id')), env);
    expect(response.status).toBe(401); expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects ambiguous runtime client credentials', () => {
    expect(() => new BuildWithAkClient({ apiKey:'key', delegatedAccessToken:'token' } as never)).toThrow('Exactly one');
  });
  it('fails closed without client secret even when a shared API key exists', async () => {
    const response = await worker.fetch(request(await token()), { ...env, OAUTH_CLIENT_SECRET: undefined });
    expect(response.status).toBe(503); expect(upstream).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(env.AGENTKIT_API_KEY!);
  });
  it.each([['invalid_grant',401],['invalid_token',401],['insufficient_scope',403],['invalid_scope',403],['access_denied',403],['invalid_client',503],['server_error',503]])('handles failed exchange %s', async (error, status) => {
    upstream.mockResolvedValue(Response.json({ error, error_description: env.OAUTH_CLIENT_SECRET }, { status: 400 }));
    const response = await worker.fetch(request(await token()), env);
    expect(response.status).toBe(status); expect(upstream).toHaveBeenCalledTimes(1);
    expect(await response.text()).not.toContain(env.OAUTH_CLIENT_SECRET!);
  });
  it.each([
    { access_token: '' }, { access_token: 'contains spaces' }, { token_type: 'MAC' },
    { expires_in: 61 }, { expires_in: 0 }, { expires_in: '60' }, { expires_in: 1.5 },
    { scope: 'openid' }, { refresh_token: 'not-allowed' }, { issued_token_type: 'wrong' },
  ])('rejects invalid exchange response %j', async (invalid) => {
    upstream.mockResolvedValue(Response.json({ ...exchangeBody(), ...invalid }));
    const response = await worker.fetch(request(await token()), env);
    expect(response.status).toBe(502); expect(upstream).toHaveBeenCalledTimes(1);
  });
  it('rejects an exchange returning the original token or escalated scopes', async () => {
    const original = await token({ scope: 'build-with-ak:read' });
    upstream.mockResolvedValue(Response.json(exchangeBody(original, 'build-with-ak:read')));
    expect((await worker.fetch(request(original), env)).status).toBe(502);
    upstream.mockResolvedValue(Response.json(exchangeBody()));
    expect((await worker.fetch(request(original), env)).status).toBe(502);
  });
  it('rejects an exchange that loses the operation scope', async () => {
    upstream.mockResolvedValue(Response.json(exchangeBody('delegated','build-with-ak:write')));
    expect((await worker.fetch(request(await token(), 'resources/read', { uri: 'build-with-ak://remote/listing' }), env)).status).toBe(403);
  });
  it('handles invalid JSON and network failure without leaking upstream details', async () => {
    upstream.mockResolvedValue(new Response('not json'));
    expect((await worker.fetch(request(await token()), env)).status).toBe(502);
    upstream.mockRejectedValue(new Error(env.OAUTH_CLIENT_SECRET));
    const response = await worker.fetch(request(await token()), env);
    expect(response.status).toBe(503); expect(await response.text()).not.toContain(env.OAUTH_CLIENT_SECRET!);
  });
  it('isolates concurrent users and exchanges again on every request', async () => {
    const subjects = [await token({ sub:'owner-a' }), await token({ sub:'owner-b', grant_id:'grant-b' })];
    const seen: string[] = [];
    upstream.mockImplementation(async (url: URL | string, init: RequestInit) => {
      if (String(url).endsWith('/oauth/token')) {
        const subject = (init.body as URLSearchParams).get('subject_token');
        return Response.json(exchangeBody(`delegated-${subjects.indexOf(subject!)}`));
      }
      seen.push(new Headers(init.headers).get('Authorization')!);
      return Response.json({ listing: {} });
    });
    const requests = [...subjects, subjects[0]!].map(async subject => {
      const response = await worker.fetch(request(subject, 'tools/call', { name:'build_with_ak_get_listing', arguments:{} }), env);
      expect(response.status).toBe(200); await response.text();
    });
    await Promise.all(requests);
    expect(seen.sort()).toEqual(['Bearer delegated-0','Bearer delegated-0','Bearer delegated-1']);
    expect(upstream.mock.calls.filter(([url])=>String(url).endsWith('/oauth/token'))).toHaveLength(3);
  });
  it('keeps API-key authentication independent of OAuth exchange', async () => {
    const response = await worker.fetch(new Request(resource, { method:'POST',headers:{'x-api-key':'ck_live_legacy_customer_key',Accept:'application/json, text/event-stream','Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'build_with_ak_get_listing',arguments:{}}}) }), env);
    expect(response.status).toBe(200); await response.text(); expect(upstream).toHaveBeenCalledTimes(1);
    expect(new Headers(upstream.mock.calls[0]![1].headers).get('x-api-key')).toBe('ck_live_legacy_customer_key');
  });
  it.each(['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp'])('advertises canonical resource at %s', async path => {
    const response=await worker.fetch(new Request(`https://bwak.agentkit.best${path}`),env);
    expect(response.status).toBe(200); expect((await response.json()).resource).toBe(resource);
  });
});
