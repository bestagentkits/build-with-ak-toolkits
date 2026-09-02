import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CliContext } from '../../src/cli/context';
import { OutputWriter, type OutputSink } from '../../src/cli/output';
import { runInit } from '../../src/cli/commands/init';
import { runTemplateList, runTemplateApply } from '../../src/cli/commands/template';
import { runSlugCheck } from '../../src/cli/commands/slug';
import { runMediaUpload } from '../../src/cli/commands/media';
import { runValidate } from '../../src/cli/commands/validate';
import { runSubmit } from '../../src/cli/commands/submit';
import { EXIT_CODES } from '../../src/cli/exit-codes';
import { BuildWithAkClient } from '../../src/client/client';

interface HarnessContext {
  ctx: CliContext;
  lines: string[];
}

function makeContext(tmpDir: string, mockFetch: ReturnType<typeof vi.fn>): HarnessContext {
  const lines: string[] = [];
  const sink: OutputSink = {
    stdout: (l) => lines.push(l),
    stderr: () => {},
  };
  const out = new OutputWriter({ json: true, sink });
  const ctx = new CliContext({
    cwd: tmpDir,
    apiKey: 'ck_live_test_key_1234567890',
    environment: 'staging',
    output: out,
    clientFactory: (config) =>
      new BuildWithAkClient({
        apiKey: config.apiKey,
        environment: config.environment,
        capabilities: config.capabilities,
        fetch: mockFetch as unknown as typeof fetch,
      }),
  });
  return { ctx, lines };
}

function lastEnvelope<T>(lines: string[]): { ok: boolean; data?: T; error?: { message: string; code?: string } } {
  // Boundary parse of the CLI's own JSON envelope; the caller declares the data shape it asserts.
  return JSON.parse(lines[lines.length - 1]) as { ok: boolean; data?: T; error?: { message: string; code?: string } };
}

interface WorkspaceFile {
  blocks: { id: string; order: number; content: Record<string, unknown> }[];
  media: Record<string, { assetId?: string }>;
}

function readWorkspace(tmpDir: string): WorkspaceFile {
  return JSON.parse(fs.readFileSync(path.join(tmpDir, 'build-with-ak.json'), 'utf8')) as WorkspaceFile;
}

describe('Phase 4: CLI Commands', () => {
  let tmpDir: string;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bwak-cli-'));
    mockFetch = vi.fn();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('init --template scaffolds a workspace with template blocks', () => {
    const { ctx, lines } = makeContext(tmpDir, mockFetch);
    const code = runInit(ctx, { template: 'minimalist_showcase', env: 'staging' });
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(fs.existsSync(path.join(tmpDir, 'build-with-ak.json'))).toBe(true);
    const env = lastEnvelope<{ blockCount: number }>(lines);
    expect(env.ok).toBe(true);
    expect(env.data?.blockCount).toBeGreaterThan(0);
  });

  it('template list returns all 5 templates as JSON', () => {
    const { ctx, lines } = makeContext(tmpDir, mockFetch);
    const code = runTemplateList(ctx);
    expect(code).toBe(EXIT_CODES.SUCCESS);
    const env = lastEnvelope<unknown[]>(lines);
    expect(env.data).toHaveLength(5);
  });

  it('template apply updates the draft blocks', () => {
    const { ctx } = makeContext(tmpDir, mockFetch);
    runInit(ctx, { env: 'staging' });
    const code = runTemplateApply(ctx, 'saas_product_launch');
    expect(code).toBe(EXIT_CODES.SUCCESS);
    expect(readWorkspace(tmpDir).blocks.length).toBeGreaterThan(0);
  });

  it('slug check falls back to local format validation for reserved slugs', async () => {
    const { ctx, lines } = makeContext(tmpDir, mockFetch);
    const code = await runSlugCheck(ctx, 'admin'); // reserved -> locally invalid, no network
    expect(code).toBe(EXIT_CODES.SUCCESS);
    const env = lastEnvelope<{ locallyValid: boolean }>(lines);
    expect(env.data?.locallyValid).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('media upload runs the 3-step pipeline and returns the assetId', async () => {
    const { ctx, lines } = makeContext(tmpDir, mockFetch);
    runInit(ctx, { env: 'staging' });

    const filePath = path.join(tmpDir, 'logo.png');
    fs.writeFileSync(filePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ intentId: 'i-1', presignedUrl: 'https://r2.example/put?sig=x', stagingKey: 'staging/logo.png', maxByteSize: 2097152, expiresIn: 900 }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => '' })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, assetId: '123e4567-e89b-12d3-a456-426614174000', assetUrl: 'https://cdn/logo.png', mime: 'image/png', width: 128, height: 128 }),
      });

    const code = await runMediaUpload(ctx, 'logo.png', { kind: 'logo' });
    expect(code).toBe(EXIT_CODES.SUCCESS);
    const env = lastEnvelope<{ assetId: string }>(lines);
    expect(env.data?.assetId).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(readWorkspace(tmpDir).media.logo.assetId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('validate draft mode passes for an empty scaffold; --ready fails without content', () => {
    const { ctx } = makeContext(tmpDir, mockFetch);
    runInit(ctx, { env: 'staging' });
    expect(runValidate(ctx, {})).toBe(EXIT_CODES.SUCCESS);
    expect(runValidate(ctx, { ready: true })).toBe(EXIT_CODES.VALIDATION_ERROR);
  });

  it('submit sends listingId and expectedDraftRevisionId', async () => {
    const { ctx, lines } = makeContext(tmpDir, mockFetch);
    runInit(ctx, { env: 'staging' });
    ctx.store.writeState({ listingId: 'listing-1', baseDraftRevisionId: '123e4567-e89b-12d3-a456-426614174000' });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, listingId: 'listing-1', status: 'pending_review', submittedRevisionId: '123e4567-e89b-12d3-a456-426614174000' }),
    });

    const code = await runSubmit(ctx, { yes: true });
    expect(code).toBe(EXIT_CODES.SUCCESS);
    const env = lastEnvelope<{ status: string }>(lines);
    expect(env.data?.status).toBe('pending_review');

    const call = mockFetch.mock.calls[0];
    const init = call[1] as { body: string };
    const body = JSON.parse(init.body) as { listingId: string; expectedDraftRevisionId?: string };
    expect(body.listingId).toBe('listing-1');
    expect(body.expectedDraftRevisionId).toBe('123e4567-e89b-12d3-a456-426614174000');
  });

  it('submit without --yes requires confirmation in non-json mode', async () => {
    const lines: string[] = [];
    const out = new OutputWriter({ json: false, noColor: true, sink: { stdout: (l) => lines.push(l), stderr: () => {} } });
    const ctx = new CliContext({ cwd: tmpDir, apiKey: 'ck_live_x', environment: 'staging', output: out });
    runInit(ctx, { env: 'staging' });
    ctx.store.writeState({ listingId: 'listing-1' });
    const code = await runSubmit(ctx, {});
    expect(code).toBe(EXIT_CODES.VALIDATION_ERROR);
  });
});
