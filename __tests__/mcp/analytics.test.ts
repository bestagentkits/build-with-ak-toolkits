import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BuildWithAkClient } from '../../src/client/client';
import { createMcpServer } from '../../src/mcp/factory';
import worker, { buildOpenApiSpec } from '../../src/worker';

const listingId = '123e4567-e89b-12d3-a456-426614174000';
const report = {
  listing: { id: listingId, slug: 'test-product' },
  period: { from: '2026-08-01', to: '2026-08-02', timezone: 'UTC' },
  source: 'first_party_postgresql', generatedAt: '2026-08-03T00:00:00.000Z',
  totals: { views: 2, outboundClicks: 1, referralConversions: null },
  daily: [
    { date: '2026-08-01', views: 2, outboundClicks: 1, referralConversions: null },
    { date: '2026-08-02', views: 0, outboundClicks: 0, referralConversions: null },
  ],
};

describe('Analytics MCP protocol and discovery', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('discovers and reads analytics through the shared stdio factory, resource, and prompt', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(report));
    const upstream = new BuildWithAkClient({ apiKey: 'test-key', fetch });
    const server = createMcpServer({ transport: 'stdio', getClient: () => upstream, uploadFromPayload: vi.fn() });
    const client = new Client({ name: 'analytics-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    try {
      const tool = (await client.listTools()).tools.find((tool) => tool.name === 'build_with_ak_get_analytics');
      expect(tool?.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false });
      expect(tool?.inputSchema.properties).toHaveProperty('listingId');
      const query = { listingId, from: '2026-08-01', to: '2026-08-02' };
      const result = await client.callTool({ name: 'build_with_ak_get_analytics', arguments: query });
      expect(result.isError).not.toBe(true);
      expect(JSON.parse((result.content as Array<{ text: string }>)[0].text)).toEqual(report);
      expect(Object.fromEntries(new URL(String(fetch.mock.calls[0][0])).searchParams)).toEqual(query);

      const resource = await client.readResource({ uri: 'build-with-ak://remote/analytics' });
      expect('text' in resource.contents[0] && JSON.parse(resource.contents[0].text)).toEqual(report);
      expect(String(fetch.mock.calls[1][0])).not.toContain('?');
      const prompt = await client.getPrompt({ name: 'review_product_analytics', arguments: query });
      const promptContent = prompt.messages[0].content;
      expect(promptContent.type).toBe('text');
      expect(promptContent.type === 'text' && promptContent.text).toContain('not sales');
      expect(promptContent.type === 'text' && promptContent.text).toContain('Report unavailable, never zero');
      expect(promptContent.type === 'text' && promptContent.text).toContain('do not infer conversions or conversion rates');
      expect(promptContent.type === 'text' && promptContent.text).toContain(listingId);

      const invalid = await client.callTool({ name: 'build_with_ak_get_analytics', arguments: { from: '2026-02-30' } });
      expect(invalid.isError).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      await client.close();
      await server.close();
    }
  });

  async function httpCall(method: string, params: unknown, jsonMode: boolean) {
    const response = await worker.fetch(new Request('https://worker.example/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'x-api-key': 'ck_live_valid_key_1234567890' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    }), { AGENTKIT_ENV: 'staging', MCP_JSON_RESPONSE: String(jsonMode) });
    expect(response.status).toBe(200);
    const text = await response.text();
    return JSON.parse(jsonMode ? text : text.split('\n').find((line) => line.startsWith('data: '))!.slice(6));
  }

  it.each([true, false])('retrieves authenticated analytics over Worker HTTP (JSON=%s)', async (jsonMode) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json(report));
    vi.stubGlobal('fetch', fetch);
    const tools = await httpCall('tools/list', {}, jsonMode);
    expect(tools.result.tools.find((tool: { name: string }) => tool.name === 'build_with_ak_get_analytics').annotations.readOnlyHint).toBe(true);
    const result = await httpCall('tools/call', { name: 'build_with_ak_get_analytics', arguments: { listingId } }, jsonMode);
    expect(JSON.parse(result.result.content[0].text)).toEqual(report);
    expect(String(fetch.mock.calls[0][0])).toBe(`https://staging.agentkit.best/api/build-with-ak/listing/analytics?listingId=${listingId}`);
    expect(new Headers(fetch.mock.calls[0][1]?.headers).get('x-api-key')).toBe('ck_live_valid_key_1234567890');
  });

  it('preserves owner access errors as MCP tool failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: 'Listing not found' }, { status: 404 })));
    const result = await httpCall('tools/call', { name: 'build_with_ak_get_analytics', arguments: { listingId } }, true);
    expect(result.result.isError).toBe(true);
    expect(JSON.parse(result.result.content[0].text)).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps published OpenAPI analytics aligned with live discovery and upstream routing', () => {
    const spec = buildOpenApiSpec('https://worker.example');
    const published = JSON.parse(readFileSync(resolve(__dirname, '../../docs/openapi.json'), 'utf8'));
    const route = '/api/build-with-ak/listing/analytics';
    expect(published.paths[route]).toEqual(spec.paths[route]);
    expect(published.components.schemas.ListingAnalytics).toEqual(spec.components.schemas.ListingAnalytics);
    expect(published.components.schemas.AnalyticsMetrics).toEqual(spec.components.schemas.AnalyticsMetrics);
    expect(spec.paths[route].get.servers[0].url).toBe('https://agentkit.best');
    expect(spec.paths[route].get.security).toEqual([{ ApiKeyAuth: [] }]);
    expect(spec.components.schemas.ListingAnalytics.properties.listing.properties.slug).toEqual({ type: 'string' });
    expect(spec.components.schemas.AnalyticsMetrics.properties.referralConversions).toEqual({
      type: 'null', description: 'Unavailable: conversion tracking is not instrumented. Not external product sales.',
    });
  });
});
