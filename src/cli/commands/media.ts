import * as fs from 'node:fs';
import * as path from 'node:path';
import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { uploadMediaFile } from '../../media/upload';
import type { MediaKind, MediaMimeType } from '../../client/client';

const MIME_BY_EXT: Record<string, MediaMimeType> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export async function runMediaList(ctx: CliContext, options: { kind?: MediaKind } = {}): Promise<ExitCode> {
  try {
    const client = ctx.createClient({ targetExtensions: ctx.resolveTargetExtensions() });
    const result = await client.listMediaAssets({ kind: options.kind });
    ctx.out.success(result.assets, `Found ${result.assets.length} finalized asset(s).`);
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}

export async function runMediaUpload(
  ctx: CliContext,
  file: string,
  options: { kind: MediaKind; ref?: string }
): Promise<ExitCode> {
  try {
    const absolute = path.resolve(ctx.cwd, file);
    if (!fs.existsSync(absolute)) {
      ctx.out.failure(`File not found: ${file}`, 'FILE_NOT_FOUND');
      return EXIT_CODES.NOT_FOUND;
    }
    const ext = path.extname(absolute).toLowerCase();
    const mimeType = MIME_BY_EXT[ext];
    if (!mimeType) {
      ctx.out.failure(`Unsupported file type "${ext}". Allowed: .png, .jpg, .jpeg, .webp`, 'UNSUPPORTED_MIME');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const data = new Uint8Array(fs.readFileSync(absolute));
    const client = ctx.createClient();
    const result = await uploadMediaFile(client, { data, kind: options.kind, mimeType });

    // Persist the finalized assetId into the workspace media map under a ref key.
    if (ctx.store.isInitialized()) {
      const doc = ctx.store.readDocument();
      const ref = options.ref ?? path.basename(absolute, ext);
      doc.media[ref] = { assetId: result.assetId, localPath: file, mime: result.mime, width: result.width, height: result.height };
      ctx.store.writeDocument(doc);
    }

    ctx.out.success(
      { assetId: result.assetId, assetUrl: result.assetUrl, mime: result.mime, width: result.width, height: result.height },
      `Uploaded ${options.kind}: ${result.assetId}`
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
