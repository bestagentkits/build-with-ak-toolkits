import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildWithAkClient } from '../../src/client/client';
import { BuildWithAkCapabilityError } from '../../src/client/errors';

describe('Phase 2: Universal API Client (Target Extension Endpoints)', () => {
  const apiKey = 'ck_live_test_api_key_1234567890';
  const baseUrl = 'https://test.agentkit.best/api/build-with-ak';

  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  it('throws BuildWithAkCapabilityError when target extensions are disabled', async () => {
    const baseClient = new BuildWithAkClient({
      apiKey,
      baseUrl,
      fetch: mockFetch as unknown as typeof fetch,
      capabilities: { targetExtensions: false },
    });

    await expect(baseClient.listMediaAssets()).rejects.toThrow(BuildWithAkCapabilityError);
    await expect(baseClient.checkSlugAvailability('my-slug')).rejects.toThrow(BuildWithAkCapabilityError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('executes listMediaAssets when target capability is enabled', async () => {
    const targetClient = new BuildWithAkClient({
      apiKey,
      baseUrl,
      fetch: mockFetch as unknown as typeof fetch,
      capabilities: { targetExtensions: true },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        assets: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            kind: 'logo',
            publicUrl: 'https://cdn.agentkit.best/logo.png',
          },
        ],
      }),
    });

    const res = await targetClient.listMediaAssets({ kind: 'logo' });
    expect(res.assets).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/media?kind=logo`,
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('executes checkSlugAvailability when target capability is enabled', async () => {
    const targetClient = new BuildWithAkClient({
      apiKey,
      baseUrl,
      fetch: mockFetch as unknown as typeof fetch,
      capabilities: { targetExtensions: true },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        available: true,
        slug: 'my-cool-agent',
        suggestions: ['my-cool-agent-2', 'my-cool-agent-ai'],
      }),
    });

    const res = await targetClient.checkSlugAvailability('my-cool-agent');
    expect(res.available).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      `${baseUrl}/slug-availability?slug=my-cool-agent`,
      expect.objectContaining({ method: 'GET' })
    );
  });
});
