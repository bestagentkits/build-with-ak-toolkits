import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuildWithAkClient } from '../../src/client/client';
import { uploadMediaFile } from '../../src/media/upload';

describe('Phase 2: 3-Step Media Upload Pipeline', () => {
  const dummyAssetId = '123e4567-e89b-12d3-a456-426614174000';
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

  it('executes all 3 steps (upload-intent -> presigned R2 PUT -> finalize) and returns assetId UUID', async () => {
    const presignedUrl = 'https://r2-upload.storage.cloudflare.com/staging/user123/file.png?sig=abc';
    const stagingKey = 'build-with-ak/staging/user123/nanoid-logo.png';
    const fakeData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG header

    // Step 1: POST /media/upload-intent
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        intentId: 'intent-123',
        presignedUrl,
        stagingKey,
        maxByteSize: 2 * 1024 * 1024,
        expiresIn: 900,
      }),
    });

    // Step 2: Direct PUT to presigned R2 URL
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => '',
    });

    // Step 3: POST /media/finalize
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        assetId: dummyAssetId,
        assetUrl: `https://cdn.agentkit.best/${stagingKey}`,
        mime: 'image/png',
        width: 512,
        height: 512,
      }),
    });

    const result = await uploadMediaFile(client, {
      data: fakeData,
      kind: 'logo',
      mimeType: 'image/png',
    });

    expect(result.assetId).toBe(dummyAssetId);
    expect(result.mime).toBe('image/png');

    // Verify 3 calls occurred
    expect(mockFetch).toHaveBeenCalledTimes(3);

    // Check Call 1: Intent
    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      `${baseUrl}/media/upload-intent`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': apiKey }),
        body: JSON.stringify({ kind: 'logo', mimeType: 'image/png' }),
      })
    );

    // Check Call 2: Presigned PUT (CRITICAL: MUST NOT CARRY x-api-key HEADER!)
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      presignedUrl,
      expect.objectContaining({
        method: 'PUT',
        headers: {
          'Content-Type': 'image/png',
        },
      })
    );
    const step2Headers = mockFetch.mock.calls[1][1].headers;
    expect(step2Headers).not.toHaveProperty('x-api-key');
    expect(step2Headers).not.toHaveProperty('authorization');

    // Check Call 3: Finalize
    expect(mockFetch).toHaveBeenNthCalledWith(
      3,
      `${baseUrl}/media/finalize`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'x-api-key': apiKey }),
        body: JSON.stringify({ stagingKey, kind: 'logo' }),
      })
    );
  });

  it('rejects oversized buffer before uploading to R2', async () => {
    const presignedUrl = 'https://r2-upload.storage.cloudflare.com/staging/user123/file.png';
    const stagingKey = 'build-with-ak/staging/user123/logo.png';
    const oversizedData = new Uint8Array(3 * 1024 * 1024); // 3MB > 2MB limit

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        intentId: 'intent-123',
        presignedUrl,
        stagingKey,
        maxByteSize: 2 * 1024 * 1024,
        expiresIn: 900,
      }),
    });

    await expect(
      uploadMediaFile(client, {
        data: oversizedData,
        kind: 'logo',
        mimeType: 'image/png',
      })
    ).rejects.toThrow(/exceeds maximum allowed size/);

    expect(mockFetch).toHaveBeenCalledTimes(1); // Only intent was called, R2 PUT was skipped
  });
});
