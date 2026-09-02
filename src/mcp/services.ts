import * as fs from 'node:fs';
import * as path from 'node:path';
import { BuildWithAkClient, type BuildWithAkEnvironment, type MediaKind } from '../client/client';
import { uploadMediaFile, type UploadMediaResult } from '../media/upload';
import { ProjectStore } from '../project/project-store';
import type { McpServices, UploadPayloadInput } from './tools';

const MIME_BY_EXT: Record<string, 'image/png' | 'image/jpeg' | 'image/webp'> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export interface StdioServiceConfig {
  apiKey: string;
  environment: BuildWithAkEnvironment;
  cwd?: string;
  targetExtensions?: boolean;
}

/** Build services for the local stdio adapter: workspace file access + local path uploads. */
export function createStdioServices(config: StdioServiceConfig): McpServices {
  const cwd = config.cwd ?? process.cwd();
  const store = new ProjectStore(cwd);
  const client = new BuildWithAkClient({
    apiKey: config.apiKey,
    environment: config.environment,
    capabilities: { targetExtensions: config.targetExtensions ?? false },
  });

  return {
    transport: 'stdio',
    getClient: () => client,
    readWorkspaceDoc: () => store.readDocument(),
    writeWorkspaceDoc: (doc) => store.writeDocument(doc),
    uploadFromPath: async (filePath: string, kind: MediaKind): Promise<UploadMediaResult> => {
      const absolute = path.resolve(cwd, filePath);
      const ext = path.extname(absolute).toLowerCase();
      const mimeType = MIME_BY_EXT[ext];
      if (!mimeType) throw new Error(`Unsupported file type "${ext}". Allowed: .png, .jpg, .jpeg, .webp`);
      const data = new Uint8Array(fs.readFileSync(absolute));
      return uploadMediaFile(client, { data, kind, mimeType });
    },
    uploadFromPayload: async (input: UploadPayloadInput): Promise<UploadMediaResult> => {
      const data = new Uint8Array(Buffer.from(input.base64Content, 'base64'));
      return uploadMediaFile(client, { data, kind: input.kind, mimeType: input.mimeType });
    },
  };
}
