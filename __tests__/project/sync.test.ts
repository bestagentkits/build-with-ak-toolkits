import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProjectStore } from '../../src/project/project-store';
import { pushDraft, CASConflictError } from '../../src/project/sync';
import { BuildWithAkClient } from '../../src/client/client';

const LOGO_UUID = '123e4567-e89b-12d3-a456-426614174000';
const REV_1 = '00000000-0000-4000-8000-000000000001';
const REV_2 = '00000000-0000-4000-8000-000000000002';

function jsonRes(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function seedReadyWorkspace(store: ProjectStore): void {
  store.init({ environment: 'staging' });
  const doc = store.readDocument();
  doc.listing.name = 'SyncApp';
  doc.listing.slug = 'sync-app';
  doc.listing.tagline = 'Deterministic CAS sync testing';
  doc.listing.category = 'developer_tools';
  doc.listing.websiteUrl = 'https://sync.dev';
  doc.listing.logoMediaRef = 'logo';
  doc.media.logo = { assetId: LOGO_UUID };
  doc.blocks = [{ id: 'b1', order: 0, content: { type: 'hero_banner', title: 'Sync', tagline: 'CAS', badges: [] } }];
  store.writeDocument(doc);
}

describe('Phase 3: CAS push (sync)', () => {
  let tmpDir: string;
  let store: ProjectStore;
  let mockFetch: ReturnType<typeof vi.fn>;
  let client: BuildWithAkClient;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bwak-sync-'));
    store = new ProjectStore(tmpDir);
    mockFetch = vi.fn();
    client = new BuildWithAkClient({ apiKey: 'ck_live_x_1234567890', environment: 'staging', fetch: mockFetch as unknown as typeof fetch });
    seedReadyWorkspace(store);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('pushes to a listing with no existing draft and records the new base revision', async () => {
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft' } }))
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft', draftRevisionId: REV_2 } }));

    const result = await pushDraft(client, store);
    expect(result.listingId).toBe('l-1');
    expect(result.newDraftRevisionId).toBe(REV_2);
    expect(store.readState().baseDraftRevisionId).toBe(REV_2);

    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body) as { expectedDraftRevisionId?: string };
    expect(putBody.expectedDraftRevisionId).toBeUndefined();
  });

  it('sends expectedDraftRevisionId when a base revision is known', async () => {
    store.writeState({ listingId: 'l-1', baseDraftRevisionId: REV_1 });
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft', draftRevisionId: REV_1 } }))
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft', draftRevisionId: REV_2 } }));

    await pushDraft(client, store);
    const putBody = JSON.parse(mockFetch.mock.calls[1][1].body) as { expectedDraftRevisionId?: string };
    expect(putBody.expectedDraftRevisionId).toBe(REV_1);
  });

  it('refuses to blind-overwrite an existing remote draft when never pulled', async () => {
    // No baseDraftRevisionId in state, but remote already has a draft.
    mockFetch.mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft', draftRevisionId: REV_1 } }));
    await expect(pushDraft(client, store)).rejects.toBeInstanceOf(CASConflictError);
    // Only the GET happened; no PUT was attempted.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('detects a client-side revision mismatch before attempting the PUT', async () => {
    store.writeState({ listingId: 'l-1', baseDraftRevisionId: REV_1 });
    mockFetch.mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft', draftRevisionId: REV_2 } }));
    await expect(pushDraft(client, store)).rejects.toBeInstanceOf(CASConflictError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('translates a server-side 409 into a CASConflictError', async () => {
    store.writeState({ listingId: 'l-1', baseDraftRevisionId: REV_1 });
    mockFetch
      .mockResolvedValueOnce(jsonRes(200, { listing: { id: 'l-1', name: 'SyncApp', slug: 'sync-app', status: 'draft', draftRevisionId: REV_1 } }))
      .mockResolvedValueOnce(jsonRes(409, { error: 'Stale revision', code: 'STALE_REVISION' }));
    await expect(pushDraft(client, store)).rejects.toBeInstanceOf(CASConflictError);
  });
});
