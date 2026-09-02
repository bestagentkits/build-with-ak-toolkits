import { describe, it, expect, vi } from 'vitest';
import { createTools, type McpServices, type McpToolResult } from '../../src/mcp/tools';
import type { BuildWithAkClient } from '../../src/client/client';

const dummyUUID = '123e4567-e89b-12d3-a456-426614174000';

interface FakeClient {
  getListing: ReturnType<typeof vi.fn>;
  updateListing: ReturnType<typeof vi.fn>;
  submitListing: ReturnType<typeof vi.fn>;
  getBlocks: ReturnType<typeof vi.fn>;
  patchBlock: ReturnType<typeof vi.fn>;
  reorderBlocks: ReturnType<typeof vi.fn>;
  checkSlugAvailability: ReturnType<typeof vi.fn>;
  listMediaAssets: ReturnType<typeof vi.fn>;
}

function makeServices(transport: 'stdio' | 'http', client: FakeClient): McpServices {
  return {
    transport,
    getClient: () => client as unknown as BuildWithAkClient,
    readWorkspaceDoc: transport === 'stdio' ? () => ({ $schema: '', schemaVersion: 1, environment: 'staging', listing: {}, media: {}, blocks: [] }) : undefined,
    uploadFromPath: transport === 'stdio' ? vi.fn(async () => ({ assetId: dummyUUID, assetUrl: 'x', mime: 'image/png', width: 1, height: 1 })) : undefined,
    uploadFromPayload: vi.fn(async () => ({ assetId: dummyUUID, assetUrl: 'x', mime: 'image/png', width: 1, height: 1 })),
  } as McpServices;
}

function fakeClient(): FakeClient {
  return {
    getListing: vi.fn(async () => ({ listing: { id: 'l-1', name: 'X', slug: 'x', status: 'draft' } })),
    updateListing: vi.fn(async () => ({ listing: { id: 'l-1', name: 'X', slug: 'x', status: 'draft' } })),
    submitListing: vi.fn(async () => ({ success: true, listingId: 'l-1', status: 'pending_review' })),
    getBlocks: vi.fn(async () => ({ blocks: [] })),
    patchBlock: vi.fn(async () => ({ block: { id: 'b-1' } })),
    reorderBlocks: vi.fn(async () => ({ success: true })),
    checkSlugAvailability: vi.fn(async () => ({ available: true, slug: 's', suggestions: [] })),
    listMediaAssets: vi.fn(async () => ({ assets: [] })),
  };
}

function parseResult(result: McpToolResult): unknown {
  return JSON.parse(result.content[0].text);
}

describe('Phase 5: MCP Tools', () => {
  it('registers all 11 core tools plus payload upload on http transport', () => {
    const tools = createTools(makeServices('http', fakeClient()));
    const names = tools.map((t) => t.name);
    expect(names).toContain('build_with_ak_get_listing');
    expect(names).toContain('build_with_ak_update_listing');
    expect(names).toContain('build_with_ak_submit_listing');
    expect(names).toContain('build_with_ak_validate_listing');
    expect(names).toContain('build_with_ak_list_templates');
    expect(names).toContain('build_with_ak_apply_template');
    expect(names).toContain('build_with_ak_check_slug_availability');
    expect(names).toContain('build_with_ak_list_media_assets');
    expect(names).toContain('build_with_ak_get_blocks');
    expect(names).toContain('build_with_ak_patch_block');
    expect(names).toContain('build_with_ak_reorder_blocks');
    expect(names).toContain('build_with_ak_upload_media_payload');
    // Local-path upload is stdio-only
    expect(names).not.toContain('build_with_ak_upload_media_file');
  });

  it('exposes the local-path upload tool only on the stdio transport', () => {
    const tools = createTools(makeServices('stdio', fakeClient()));
    expect(tools.map((t) => t.name)).toContain('build_with_ak_upload_media_file');
  });

  it('validate_listing returns split draft and readiness flags', async () => {
    const tools = createTools(makeServices('http', fakeClient()));
    const validate = tools.find((t) => t.name === 'build_with_ak_validate_listing');
    expect(validate).toBeDefined();

    const emptyResult = parseResult(await validate!.handler({ draft: { name: '', slug: '', tagline: '', blocks: [] } }));
    expect(emptyResult).toMatchObject({ isDraftValid: true, isSubmissionReady: false });

    const readyDraft = {
      name: 'Ready',
      slug: 'ready-app',
      tagline: 'A complete and ready tagline',
      category: 'ai_agents',
      websiteUrl: 'https://ready.dev',
      logoAssetId: dummyUUID,
      blocks: [{ id: 'b1', order: 0, content: { type: 'hero_banner', title: 'T', tagline: 'Tag', badges: [] } }],
    };
    const readyResult = parseResult(await validate!.handler({ draft: readyDraft }));
    expect(readyResult).toMatchObject({ isDraftValid: true, isSubmissionReady: true });
  });

  it('submit_listing forwards listingId and optional expectedDraftRevisionId', async () => {
    const client = fakeClient();
    const tools = createTools(makeServices('http', client));
    const submit = tools.find((t) => t.name === 'build_with_ak_submit_listing')!;

    await submit.handler({ listingId: 'l-1', expectedDraftRevisionId: dummyUUID });
    expect(client.submitListing).toHaveBeenCalledWith({ listingId: 'l-1', expectedDraftRevisionId: dummyUUID });

    // Missing listingId fails validation (returns isError)
    const bad = await submit.handler({});
    expect(bad.isError).toBe(true);
  });

  it('apply_template returns schema-valid blocks', async () => {
    const tools = createTools(makeServices('http', fakeClient()));
    const apply = tools.find((t) => t.name === 'build_with_ak_apply_template')!;
    const result = parseResult(
      await apply.handler({ templateId: 'minimalist_showcase', metadata: { name: 'N', tagline: 'A valid tagline here' } })
    ) as { blocks: unknown[] };
    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it('upload_media_payload rejects oversized base64 payloads', async () => {
    const tools = createTools(makeServices('http', fakeClient()));
    const upload = tools.find((t) => t.name === 'build_with_ak_upload_media_payload')!;
    const bigBase64 = 'A'.repeat(8 * 1024 * 1024); // ~6MB decoded > 5MB cap
    const result = await upload.handler({ filename: 'big.png', kind: 'logo', mimeType: 'image/png', base64Content: bigBase64 });
    expect(result.isError).toBe(true);
  });
});
