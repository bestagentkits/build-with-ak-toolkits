import type { BuildWithAkClient, MediaKind, MediaMimeType, FinalizeMediaResponse } from '../client/client';
import { BuildWithAkError } from '../client/errors';

export interface UploadMediaInput {
  data: Uint8Array;
  kind: MediaKind;
  mimeType: MediaMimeType;
  signal?: AbortSignal;
}

export interface UploadMediaResult {
  assetId: string;
  assetUrl: string;
  mime: string;
  width: number;
  height: number;
}

/**
 * Strip presigned URL query parameters (temporary R2 signatures) so they never
 * appear in logs or error messages.
 */
export function redactPresignedUrl(url: string): string {
  const queryIndex = url.indexOf('?');
  return queryIndex === -1 ? url : `${url.slice(0, queryIndex)}?[redacted]`;
}

/**
 * Execute the 3-step media upload pipeline:
 *   1. POST /media/upload-intent (auth: x-api-key) -> presignedUrl + stagingKey.
 *   2. PUT presignedUrl (auth: NONE — R2 signed URL) streaming the raw bytes.
 *   3. POST /media/finalize (auth: x-api-key) -> asset UUID.
 */
export async function uploadMediaFile(client: BuildWithAkClient, input: UploadMediaInput): Promise<UploadMediaResult> {
  const options = input.signal ? { signal: input.signal } : undefined;

  // Step 1: Request an upload intent (authenticated).
  const intent = await client.createUploadIntent(input.kind, input.mimeType, options);

  // Enforce the server-declared size limit BEFORE spending bandwidth on the R2 PUT.
  if (input.data.byteLength > intent.maxByteSize) {
    throw new BuildWithAkError(
      `File size (${input.data.byteLength} bytes) exceeds maximum allowed size (${intent.maxByteSize} bytes) for ${input.kind}.`,
      413,
      'FILE_TOO_LARGE'
    );
  }

  // Step 2: Directly PUT the bytes to the presigned R2 URL.
  // CRITICAL: This request MUST NOT carry x-api-key or Authorization headers —
  // the presigned URL is the sole credential; forwarding the customer key here
  // would leak it to the storage layer.
  const fetchImpl = client.rawFetch;
  if (!fetchImpl) {
    throw new BuildWithAkError('No fetch implementation available for media upload.', 500, 'NO_FETCH');
  }

  // Uint8Array is a valid fetch body at runtime; the DOM BodyInit type omits it under NodeNext libs.
  const body = input.data as unknown as BodyInit;
  let putResponse: Response;
  try {
    putResponse = await fetchImpl(intent.presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': input.mimeType,
      },
      body,
      signal: input.signal,
    });
  } catch (error) {
    throw new BuildWithAkError(
      `Failed to upload to storage (${redactPresignedUrl(intent.presignedUrl)}): ${(error as Error).message}`,
      0,
      'R2_UPLOAD_FAILED'
    );
  }

  if (!putResponse.ok) {
    throw new BuildWithAkError(
      `Storage rejected upload (${redactPresignedUrl(intent.presignedUrl)}) with status ${putResponse.status}.`,
      putResponse.status,
      'R2_UPLOAD_REJECTED'
    );
  }

  // Step 3: Finalize the asset (authenticated) -> returns the durable asset UUID.
  const finalized: FinalizeMediaResponse = await client.finalizeMedia(intent.stagingKey, input.kind, options);

  return {
    assetId: finalized.assetId,
    assetUrl: finalized.assetUrl,
    mime: finalized.mime,
    width: finalized.width,
    height: finalized.height,
  };
}
