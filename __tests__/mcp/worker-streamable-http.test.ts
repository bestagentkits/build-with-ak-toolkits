import { describe, it, expect, vi, beforeEach } from 'vitest';
import worker, { type WorkerEnv } from '../../src/worker';

const INIT_BODY = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'test', version: '1.0.0' },
  },
};

function initRequest(headers: Record<string, string>, accept = 'application/json, text/event-stream'): Request {
  return new Request('https://worker.example/mcp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: accept, ...headers },
    body: JSON.stringify(INIT_BODY),
  });
}

describe('Phase 5: Cloudflare Worker Streamable HTTP & Dual Auth', () => {
  beforeEach(() => {
    // Prevent any real upstream calls if a handler slips through.
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  });

  it('serves RFC 9728 Protected Resource Metadata', async () => {
    const env: WorkerEnv = { OAUTH_ISSUER: 'https://agentkit.best', WORKER_RESOURCE_URL: 'https://worker.example' };
    const res = await worker.fetch(new Request('https://worker.example/.well-known/oauth-protected-resource'), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { resource: string; authorization_servers: string[]; scopes_supported: string[] };
    expect(body.resource).toBe('https://worker.example');
    expect(body.authorization_servers).toContain('https://agentkit.best');
    expect(body.scopes_supported).toContain('build-with-ak:read');
  });

  it('challenges unauthenticated requests with 401 and WWW-Authenticate', async () => {
    const env: WorkerEnv = { WORKER_RESOURCE_URL: 'https://worker.example' };
    const res = await worker.fetch(initRequest({}), env);
    expect(res.status).toBe(401);
    const wwwAuth = res.headers.get('WWW-Authenticate');
    expect(wwwAuth).toContain('Bearer resource_metadata=');
    expect(wwwAuth).toContain('/.well-known/oauth-protected-resource');
  });

  it('rejects a malformed x-api-key', async () => {
    const env: WorkerEnv = {};
    const res = await worker.fetch(initRequest({ 'x-api-key': 'bad_key' }), env);
    expect(res.status).toBe(401);
  });

  it('accepts a valid x-api-key and returns a Streamable HTTP response (SSE)', async () => {
    const env: WorkerEnv = { AGENTKIT_ENV: 'staging' };
    const res = await worker.fetch(initRequest({ 'x-api-key': 'ck_live_valid_key_1234567890' }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
    const text = await res.text();
    expect(text).toContain('build-with-ak'); // serverInfo streamed in the SSE body, not truncated
  });

  it('supports application/json responses when MCP_JSON_RESPONSE is enabled', async () => {
    const env: WorkerEnv = { AGENTKIT_ENV: 'staging', MCP_JSON_RESPONSE: 'true' };
    const res = await worker.fetch(initRequest({ 'x-api-key': 'ck_live_valid_key_1234567890' }), env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    const body = (await res.json()) as { result?: { serverInfo?: { name?: string } } };
    expect(body.result?.serverInfo?.name).toBe('build-with-ak');
  });

  it('rejects an OAuth Bearer when OAuth is not configured on the worker', async () => {
    const env: WorkerEnv = {};
    const res = await worker.fetch(initRequest({ Authorization: 'Bearer sometoken' }), env);
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('oauth_not_configured');
  });

  it('rejects unknown paths with 404', async () => {
    const res = await worker.fetch(new Request('https://worker.example/other'), {});
    expect(res.status).toBe(404);
  });
});
