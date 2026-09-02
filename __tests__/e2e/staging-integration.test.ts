import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CliContext } from '../../src/cli/context';
import { OutputWriter, type OutputSink } from '../../src/cli/output';
import { BuildWithAkClient } from '../../src/client/client';
import { runInit } from '../../src/cli/commands/init';
import { runTemplateApply } from '../../src/cli/commands/template';
import { runMediaUpload } from '../../src/cli/commands/media';
import { runValidate } from '../../src/cli/commands/validate';
import { runPush } from '../../src/cli/commands/push';
import { runSubmit } from '../../src/cli/commands/submit';
import { EXIT_CODES } from '../../src/cli/exit-codes';

const LOGO_UUID = '123e4567-e89b-12d3-a456-426614174000';
const REV_1 = '00000000-0000-4000-8000-000000000001';
const REV_2 = '00000000-0000-4000-8000-000000000002';

interface JsonResponseInit {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

function jsonRes(status: number, body: unknown): JsonResponseInit {
  return { ok: status < 400, status, json: async () => body };
}

describe('Phase 6: Staging E2E lifecycle (init → validate → upload → push → submit)', () => {
  let tmpDir: string;
  let mockFetch: ReturnType<typeof vi.fn>;
  let ctx: CliContext;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bwak-e2e-'));
    mockFetch = vi.fn();
    const sink: OutputSink = { stdout: () => {}, stderr: () => {} };
    ctx = new CliContext({
      cwd: tmpDir,
      apiKey: 'ck_live_e2e_key_1234567890',
      environment: 'staging',
      output: new OutputWriter({ json: true, sink }),
      clientFactory: (config) =>
        new BuildWithAkClient({
          apiKey: config.apiKey,
          environment: config.environment,
          capabilities: config.capabilities,
          fetch: mockFetch as unknown as typeof fetch,
        }),
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('runs the complete base-contract lifecycle', async () => {
    // 1. init with template
    expect(runInit(ctx, { template: 'minimalist_showcase', env: 'staging' })).toBe(EXIT_CODES.SUCCESS);

    // 2. seed listing metadata + reapply template
    const doc = ctx.store.readDocument();
    doc.listing.name = 'FlowForge';
    doc.listing.slug = 'flow-forge';
    doc.listing.tagline = 'Composable AI workflow builder for teams';
    doc.listing.category = 'ai_agents';
    doc.listing.websiteUrl = 'https://flowforge.dev';
    doc.listing.logoMediaRef = 'logo';
    ctx.store.writeDocument(doc);
    expect(runTemplateApply(ctx, 'saas_product_launch')).toBe(EXIT_CODES.SUCCESS);

    // 3. draft validation passes
    expect(runValidate(ctx, {})).toBe(EXIT_CODES.SUCCESS);

    // 4. media upload (3-step)
    const logoFile = path.join(tmpDir, 'logo.png');
    fs.writeFileSync(logoFile, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { intentId: 'i-1', presignedUrl: 'https://r2/put?sig=1', stagingKey: 'staging/logo.png', maxByteSize: 2097152, expiresIn: 900 }))
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })
      .mockResolvedValueOnce(jsonRes(200, { success: true, assetId: LOGO_UUID, assetUrl: 'https://cdn/logo.png', mime: 'image/png', width: 128, height: 128 }));
    expect(await runMediaUpload(ctx, 'logo.png', { kind: 'logo', ref: 'logo' })).toBe(EXIT_CODES.SUCCESS);

    // Readiness now passes (logo resolved, blocks present, metadata complete)
    expect(runValidate(ctx, { ready: true })).toBe(EXIT_CODES.SUCCESS);

    // 5. push (CAS): first push to a listing with no existing draft (no prior pull needed).
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'listing-1', name: 'FlowForge', slug: 'flow-forge', status: 'draft' } }))
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'listing-1', name: 'FlowForge', slug: 'flow-forge', status: 'draft', draftRevisionId: REV_2 } }));
    expect(await runPush(ctx, { yes: true })).toBe(EXIT_CODES.SUCCESS);

    const stateAfterPush = ctx.store.readState();
    expect(stateAfterPush.listingId).toBe('listing-1');
    expect(stateAfterPush.baseDraftRevisionId).toBe(REV_2);

    // Verify the PUT carried the compiled wire draft with logo UUID
    const putCall = mockFetch.mock.calls.find((c) => c[1]?.method === 'PUT' && typeof c[0] === 'string' && c[0].endsWith('/listing'));
    expect(putCall).toBeDefined();
    const putBody = JSON.parse(putCall![1].body) as { logoAssetId: string; blocks: unknown[] };
    expect(putBody.logoAssetId).toBe(LOGO_UUID);
    expect(putBody.blocks.length).toBeGreaterThan(0);

    // 6. submit (frozen): POST /submit with listingId + expectedDraftRevisionId
    mockFetch.mockResolvedValueOnce(jsonRes(200, { success: true, listingId: 'listing-1', status: 'pending_review', submittedRevisionId: REV_2 }));
    expect(await runSubmit(ctx, { yes: true })).toBe(EXIT_CODES.SUCCESS);

    const submitCall = mockFetch.mock.calls.find((c) => typeof c[0] === 'string' && c[0].endsWith('/listing/submit'));
    expect(submitCall).toBeDefined();
    const submitBody = JSON.parse(submitCall![1].body) as { listingId: string; expectedDraftRevisionId: string };
    expect(submitBody.listingId).toBe('listing-1');
    expect(submitBody.expectedDraftRevisionId).toBe(REV_2);
  });

  it('surfaces a CAS conflict as exit code 5 when the remote revision advanced', async () => {
    runInit(ctx, { template: 'minimalist_showcase', env: 'staging' });
    const doc = ctx.store.readDocument();
    doc.listing.name = 'Conflict';
    doc.listing.slug = 'conflict-app';
    doc.listing.tagline = 'Testing CAS conflict handling';
    doc.listing.category = 'developer_tools';
    doc.listing.websiteUrl = 'https://conflict.dev';
    doc.listing.logoMediaRef = 'logo';
    doc.media.logo = { assetId: LOGO_UUID };
    ctx.store.writeDocument(doc);
    ctx.store.writeState({ listingId: 'listing-1', baseDraftRevisionId: REV_1 });

    // Remote advanced to REV_2 → local base REV_1 mismatch → CAS conflict.
    mockFetch.mockResolvedValueOnce(jsonRes(200, { listing: { id: 'listing-1', name: 'Conflict', slug: 'conflict-app', status: 'draft', draftRevisionId: REV_2 } }));
    expect(await runPush(ctx, { yes: true })).toBe(EXIT_CODES.CAS_CONFLICT);
  });
});
