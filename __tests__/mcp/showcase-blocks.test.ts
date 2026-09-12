import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { BuildWithAkClient } from '../../src/client/client';
import { createMcpServer } from '../../src/mcp/factory';
import worker from '../../src/worker';
import { showcaseBlocks, showcaseDraft } from '../fixtures/showcase-blocks';

interface ToolResult { isError?: boolean; content: Array<{ text: string }> }
type CallTool = (name: string, args: Record<string, unknown>) => Promise<ToolResult>;

describe('Showcase blocks across MCP transports', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each(['stdio', 'http-json', 'http-sse'] as const)('validates, creates, reads, patches, and reorders new blocks via %s', async (transport) => {
    const fetch = vi.fn<typeof globalThis.fetch>(async (_url, init) => {
      if (init?.method === 'GET') return Response.json({ blocks: showcaseBlocks });
      return Response.json({ success: true });
    });
    let call: CallTool;
    let close = async () => {};
    if (transport === 'stdio') {
      const upstream = new BuildWithAkClient({ apiKey: 'test-key', fetch });
      const server = createMcpServer({ transport: 'stdio', getClient: () => upstream, uploadFromPayload: vi.fn() });
      const client = new Client({ name: 'showcase-test', version: '1.0.0' });
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      call = async (name, args) => await client.callTool({ name, arguments: args }) as ToolResult;
      close = async () => { await client.close(); await server.close(); };
    } else {
      vi.stubGlobal('fetch', fetch);
      call = async (name, args) => {
        const response = await worker.fetch(new Request('https://worker.example/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', 'x-api-key': 'ck_live_valid_key_1234567890' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
        }), { AGENTKIT_ENV: 'staging', MCP_JSON_RESPONSE: String(transport === 'http-json') });
        expect(response.status).toBe(200);
        const body = await response.text();
        const rpc = JSON.parse(transport === 'http-json' ? body : body.split('\n').find((line) => line.startsWith('data: '))!.slice(6));
        expect(rpc.error).toBeUndefined();
        return rpc.result;
      };
    }
    try {
      const valid = await call('build_with_ak_validate_listing', { draft: showcaseDraft });
      expect(JSON.parse(valid.content[0].text)).toMatchObject({ isDraftValid: true, isSubmissionReady: true, errors: [] });
      const invalid = structuredClone(showcaseDraft);
      if (invalid.blocks[0].content.type !== 'activities') throw new Error('Expected Activities fixture');
      invalid.blocks[0].content.items[0].date = '2026-02-30';
      const validation = await call('build_with_ak_validate_listing', { draft: invalid });
      expect(JSON.parse(validation.content[0].text)).toMatchObject({ isSubmissionReady: false, errors: expect.arrayContaining([expect.objectContaining({ path: 'blocks.0.content.items.0.date' })]) });
      expect(fetch).not.toHaveBeenCalled();

      expect((await call('build_with_ak_update_listing', showcaseDraft)).isError).not.toBe(true);
      expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]?.body))).toMatchObject(showcaseDraft);
      expect(fetch.mock.calls.at(-1)![1]?.method).toBe('PUT');
      const read = await call('build_with_ak_get_blocks', {});
      expect(JSON.parse(read.content[0].text)).toEqual({ blocks: showcaseBlocks });
      for (const block of showcaseBlocks) {
        const patch = { content: block.content, order: 2 };
        expect((await call('build_with_ak_patch_block', { blockId: block.id, patch })).isError).not.toBe(true);
        expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]?.body))).toEqual(patch);
        expect(fetch.mock.calls.at(-1)![1]?.method).toBe('PATCH');
      }
      const blockIds = ['pulse', 'activities', 'video'];
      expect((await call('build_with_ak_reorder_blocks', { blockIds })).isError).not.toBe(true);
      expect(JSON.parse(String(fetch.mock.calls.at(-1)![1]?.body))).toEqual({ blockIds });

      const beforeInvalid = fetch.mock.calls.length;
      for (const patch of [
        { content: invalid.blocks[0].content },
        { content: { type: 'activities', items: [{ title: 'Release', description: 'Notes', date: '2026-09-12', url: 'https://127.0.0.1' }] } },
        { content: { title: 'Missing discriminator' } },
        { order: -1 },
      ]) {
        expect((await call('build_with_ak_patch_block', { blockId: 'activities', patch })).isError).toBe(true);
      }
      expect((await call('build_with_ak_update_listing', invalid)).isError).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(beforeInvalid);
    } finally {
      await close();
    }
  });
});
