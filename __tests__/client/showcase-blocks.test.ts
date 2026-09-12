import { describe, expect, it, vi } from 'vitest';
import { BuildWithAkClient } from '../../src/client/client';
import { showcaseBlocks } from '../fixtures/showcase-blocks';

describe('Showcase block API payloads', () => {
  it('preserves new content on get/add/patch and ordered IDs on reorder', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ blocks: showcaseBlocks }));
    const client = new BuildWithAkClient({ apiKey: 'test-key', fetch });
    expect(await client.getBlocks()).toEqual({ blocks: showcaseBlocks });
    expect(fetch.mock.calls[0][1]?.method).toBe('GET');
    for (const block of showcaseBlocks) {
      fetch.mockResolvedValueOnce(Response.json({ block }));
      expect(await client.addBlock(block)).toEqual({ block });
      const add = fetch.mock.calls.at(-1)!;
      expect(new URL(String(add[0])).pathname).toBe('/api/build-with-ak/listing/blocks');
      expect(add[1]?.method).toBe('POST');
      expect(JSON.parse(String(add[1]?.body))).toEqual(block);
      fetch.mockResolvedValueOnce(Response.json({ block }));
      const patch = { order: 3, content: block.content };
      expect(await client.patchBlock(`${block.id}/part`, patch)).toEqual({ block });
      const patched = fetch.mock.calls.at(-1)!;
      expect(new URL(String(patched[0])).pathname).toBe(`/api/build-with-ak/listing/blocks/${block.id}%2Fpart`);
      expect(patched[1]?.method).toBe('PATCH');
      expect(JSON.parse(String(patched[1]?.body))).toEqual(patch);
    }
    const blockIds = ['video', 'pulse', 'activities'];
    await client.reorderBlocks(blockIds);
    const reorder = fetch.mock.calls.at(-1)!;
    expect(new URL(String(reorder[0])).pathname).toBe('/api/build-with-ak/listing/blocks/reorder');
    expect(reorder[1]?.method).toBe('POST');
    expect(JSON.parse(String(reorder[1]?.body))).toEqual({ blockIds });
  });
});
