import { describe, it, expect, vi } from 'vitest';
import { BuildWithAkClient } from '../../src/client/client';
import { createTools, type McpServices, type McpToolResult } from '../../src/mcp/tools';
import { MCP_TOOL_SCOPES } from '../../src/mcp/tool-scopes';

const baseUrl = 'https://test.agentkit.best/api/build-with-ak';
const LISTING_ID = '6f1c1c6e-3c2b-4a59-9a59-1f5f0f2b9d11';
const draft = {
  name: 'Multix',
  slug: 'multix-cli',
  tagline: 'One CLI for every model',
  category: 'developer_tools',
  websiteUrl: 'https://multix.zuey.me',
  logoAssetId: LISTING_ID,
  blocks: [],
};

function clientWith(body: unknown = { listing: { id: LISTING_ID } }) {
  const fetch = vi.fn(async (_url: string, _init?: unknown) => ({ ok: true, status: 200, json: async () => body }));
  return { fetch, client: new BuildWithAkClient({ apiKey: 'ck_live_test', baseUrl, fetch: fetch as unknown as typeof globalThis.fetch }) };
}

describe('multi-listing client', () => {
  it('scopes listing and block calls with ?listingId and omits it when unset', async () => {
    const { fetch, client } = clientWith();
    await client.getListing({ listingId: LISTING_ID });
    await client.getListing();
    await client.updateListing(draft as never, { listingId: LISTING_ID });
    await client.patchBlock('b-1', { order: 1 }, { listingId: LISTING_ID });
    await client.reorderBlocks(['b-1'], { listingId: LISTING_ID });
    const urls = fetch.mock.calls.map(([url]) => url);
    expect(urls).toEqual([
      `${baseUrl}/listing?listingId=${LISTING_ID}`,
      `${baseUrl}/listing`,
      `${baseUrl}/listing?listingId=${LISTING_ID}`,
      `${baseUrl}/listing/blocks/b-1?listingId=${LISTING_ID}`,
      `${baseUrl}/listing/blocks/reorder?listingId=${LISTING_ID}`,
    ]);
  });

  it('creates with POST /listing and lists with GET /listings', async () => {
    const { fetch, client } = clientWith();
    await client.createListing(draft as never);
    await client.listListings({ limit: 5, offset: 10 });
    expect(fetch.mock.calls[0]).toEqual([`${baseUrl}/listing`, expect.objectContaining({ method: 'POST' })]);
    expect(fetch.mock.calls[1]![0]).toBe(`${baseUrl}/listings?limit=5&offset=10`);
  });
});

describe('multi-listing MCP tools', () => {
  function tools() {
    const client = {
      createListing: vi.fn(async () => ({ listing: { id: LISTING_ID } })),
      listListings: vi.fn(async () => ({ listings: [], total: 0 })),
      getListing: vi.fn(async () => ({ listing: { id: LISTING_ID } })),
      updateListing: vi.fn(async () => ({ listing: { id: LISTING_ID } })),
      getBlocks: vi.fn(async () => ({ blocks: [] })),
    };
    const services = { transport: 'http', getClient: () => client, uploadFromPayload: vi.fn() } as unknown as McpServices;
    const byName = (name: string) => createTools(services).find((t) => t.name === name)!;
    return { client, byName };
  }

  it('exposes create/list tools with scopes', () => {
    const { byName } = tools();
    expect(byName('build_with_ak_create_listing')).toBeDefined();
    expect(byName('build_with_ak_list_listings')).toBeDefined();
    expect(MCP_TOOL_SCOPES.build_with_ak_create_listing).toBe('build-with-ak:write');
    expect(MCP_TOOL_SCOPES.build_with_ak_list_listings).toBe('build-with-ak:read');
  });

  it('forwards listingId and strips it from the update body', async () => {
    const { client, byName } = tools();
    await byName('build_with_ak_update_listing').handler({ ...draft, listingId: LISTING_ID });
    expect(client.updateListing).toHaveBeenCalledWith(expect.not.objectContaining({ listingId: LISTING_ID }), { listingId: LISTING_ID });
    await byName('build_with_ak_get_blocks').handler({ listingId: LISTING_ID });
    expect(client.getBlocks).toHaveBeenCalledWith({ listingId: LISTING_ID });
    await byName('build_with_ak_get_listing').handler({});
    expect(client.getListing).toHaveBeenCalledWith({ listingId: undefined });
  });

  it('creates a listing and rejects a malformed listingId', async () => {
    const { client, byName } = tools();
    await byName('build_with_ak_create_listing').handler(draft);
    expect(client.createListing).toHaveBeenCalledWith(expect.objectContaining({ slug: 'multix-cli' }));
    const bad: McpToolResult = await byName('build_with_ak_get_listing').handler({ listingId: 'nope' });
    expect(bad.isError).toBe(true);
  });
});
