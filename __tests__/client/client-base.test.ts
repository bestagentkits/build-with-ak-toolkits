import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildWithAkClient } from '../../src/client/client';
import {
  BuildWithAkAuthError,
  BuildWithAkConflictError,
  BuildWithAkValidationError,
  BuildWithAkNotFoundError,
  BuildWithAkRateLimitError,
} from '../../src/client/errors';

describe('Phase 2: Universal API Client (Base 11 Endpoints)', () => {
  const dummyUUID = '123e4567-e89b-12d3-a456-426614174000';
  const apiKey = 'ck_live_test_api_key_1234567890';
  const baseUrl = 'https://test.agentkit.best/api/build-with-ak';

  let mockFetch: ReturnType<typeof vi.fn>;
  let client: BuildWithAkClient;

  beforeEach(() => {
    mockFetch = vi.fn();
    client = new BuildWithAkClient({
      apiKey,
      baseUrl,
      fetch: mockFetch as unknown as typeof fetch,
    });
  });

  it('sends x-api-key header on authenticated requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ listing: { id: 'l-1', name: 'Test' } }),
    });

    await client.getListing();

    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/listing`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'x-api-key': apiKey,
        }),
      })
    );
  });

  it('maps HTTP 401 and 403 to BuildWithAkAuthError', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Invalid API key' }),
    });

    await expect(client.getListing()).rejects.toThrow(BuildWithAkAuthError);
  });

  it('maps HTTP 409 to BuildWithAkConflictError with code STALE_REVISION', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: 'Stale revision', code: 'STALE_REVISION' }),
    });

    await expect(
      client.updateListing({
        name: 'Test',
        slug: 'test-app',
        tagline: 'Test tagline',
        category: 'developer_tools',
        websiteUrl: 'https://test.dev',
        logoAssetId: dummyUUID,
        blocks: [],
        expectedDraftRevisionId: dummyUUID,
      })
    ).rejects.toThrow(BuildWithAkConflictError);
  });

  it('maps HTTP 422 to BuildWithAkValidationError with details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({
        error: 'Validation failed',
        details: { name: { _errors: ['Name required'] } },
      }),
    });

    await expect(
      client.updateListing({
        name: '',
        slug: 'test-app',
        tagline: 'Test tagline',
        category: 'developer_tools',
        websiteUrl: 'https://test.dev',
        logoAssetId: dummyUUID,
        blocks: [],
      })
    ).rejects.toThrow(BuildWithAkValidationError);
  });

  it('executes submitListing with listingId and optional expectedDraftRevisionId', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, listingId: 'l-1', status: 'pending_review' }),
    });

    const res = await client.submitListing({
      listingId: 'l-1',
      expectedDraftRevisionId: dummyUUID,
    });

    expect(res.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/listing/submit`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          listingId: 'l-1',
          expectedDraftRevisionId: dummyUUID,
        }),
      })
    );
  });

  it('supports block CRUD and reorder operations', async () => {
    // getBlocks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blocks: [] }),
    });
    await client.getBlocks();
    expect(mockFetch).toHaveBeenLastCalledWith(`${baseUrl}/listing/blocks`, expect.anything());

    // replaceBlocks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ blocks: [] }),
    });
    await client.replaceBlocks([]);
    expect(mockFetch).toHaveBeenLastCalledWith(
      `${baseUrl}/listing/blocks`,
      expect.objectContaining({ method: 'PUT' })
    );

    // addBlock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ block: { id: 'b-1' } }),
    });
    await client.addBlock({
      content: {
        type: 'hero_banner',
        title: 'Title',
        tagline: 'Tagline',
        badges: [],
      },
    });
    expect(mockFetch).toHaveBeenLastCalledWith(
      `${baseUrl}/listing/blocks`,
      expect.objectContaining({ method: 'POST' })
    );

    // patchBlock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ block: { id: 'b-1' } }),
    });
    await client.patchBlock('b-1', { order: 2 });
    expect(mockFetch).toHaveBeenLastCalledWith(
      `${baseUrl}/listing/blocks/b-1`,
      expect.objectContaining({ method: 'PATCH' })
    );

    // deleteBlock
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    await client.deleteBlock('b-1');
    expect(mockFetch).toHaveBeenLastCalledWith(
      `${baseUrl}/listing/blocks/b-1`,
      expect.objectContaining({ method: 'DELETE' })
    );

    // reorderBlocks
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });
    await client.reorderBlocks(['b-2', 'b-1']);
    expect(mockFetch).toHaveBeenLastCalledWith(
      `${baseUrl}/listing/blocks/reorder`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ blockIds: ['b-2', 'b-1'] }),
      })
    );
  });
});
