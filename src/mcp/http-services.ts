import type { BuildWithAkClient } from '../client/client';
import { uploadMediaFile, type UploadMediaResult } from '../media/upload';
import type { McpServices, UploadPayloadInput } from './tools';

export interface HttpServiceConfig {
  client: BuildWithAkClient;
}

/** Decode base64 to bytes using the isomorphic `atob` (no Node Buffer dependency). */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Build services for the Cloudflare Worker adapter: payload uploads only, zero
 * filesystem dependency. Kept in its own module so `src/worker.ts` never pulls
 * in Node-only imports from the stdio services.
 */
export function createHttpServices(config: HttpServiceConfig): McpServices {
  return {
    transport: 'http',
    getClient: () => config.client,
    uploadFromPayload: async (input: UploadPayloadInput): Promise<UploadMediaResult> => {
      const data = base64ToBytes(input.base64Content);
      return uploadMediaFile(config.client, { data, kind: input.kind, mimeType: input.mimeType });
    },
  };
}
