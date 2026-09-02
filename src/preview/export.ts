import * as fs from 'node:fs';
import * as path from 'node:path';
import { createHash } from 'node:crypto';
import type { PreviewModel } from '../project/compiler';
import { renderDocument } from './render-document';

export interface ExportOptions {
  offline?: boolean;
}

const OFFLINE_CSP = "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'none'";

/**
 * Export a standalone static HTML bundle: `index.html` plus content-addressed
 * copies of any local assets referenced by the preview model. With `offline`,
 * a strict CSP forbids all external network access.
 */
export function exportStaticBundle(model: PreviewModel, outDir: string, options: ExportOptions = {}): string {
  fs.mkdirSync(outDir, { recursive: true });
  const assetsDir = path.join(outDir, 'assets');

  const exported: PreviewModel = {
    ...model,
    logo: model.logo ? { ...model.logo } : undefined,
    blocks: model.blocks.map((b) => ({ ...b, content: { ...b.content } })),
  };

  const copyLocalAsset = (localPath: string | undefined): string | undefined => {
    if (!localPath) return undefined;
    if (/^https?:\/\//.test(localPath)) return localPath;
    if (!fs.existsSync(localPath)) return undefined;
    fs.mkdirSync(assetsDir, { recursive: true });
    const bytes = fs.readFileSync(localPath);
    const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16);
    const ext = path.extname(localPath) || '.png';
    const filename = `${digest}${ext}`;
    fs.writeFileSync(path.join(assetsDir, filename), bytes);
    return `assets/${filename}`;
  };

  if (exported.logo?.localPath) {
    exported.logo.localPath = copyLocalAsset(exported.logo.localPath);
  }

  for (const block of exported.blocks) {
    if (typeof block.content.localPath === 'string') {
      block.content.localPath = copyLocalAsset(block.content.localPath);
    }
    if (Array.isArray(block.content.images)) {
      block.content.images = block.content.images.map((img: Record<string, unknown>) => ({
        ...img,
        localPath: typeof img.localPath === 'string' ? copyLocalAsset(img.localPath) : img.localPath,
      }));
    }
  }

  const html = renderDocument(exported, {
    csp: options.offline ? OFFLINE_CSP : undefined,
  });

  const indexPath = path.join(outDir, 'index.html');
  fs.writeFileSync(indexPath, html, 'utf8');
  return indexPath;
}
