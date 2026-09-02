import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { AddressInfo } from 'node:net';
import { ProjectStore, DOCUMENT_FILENAME } from '../project/project-store';
import { compileToPreview } from '../project/compiler';
import { renderDocument } from './render-document';

export interface PreviewServerOptions {
  root?: string;
  watch?: boolean;
}

export interface PreviewServerHandle {
  url: string;
  port: number;
  close: () => Promise<void>;
}

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.gif': 'image/gif',
};

/**
 * Start an ephemeral loopback preview server bound exclusively to 127.0.0.1.
 * Renders the current workspace draft, serves local assets, and (when watching)
 * emits EventSource `draft-changed` events on file saves.
 */
export function startPreviewServer(options: PreviewServerOptions = {}): Promise<PreviewServerHandle> {
  const root = options.root ?? process.cwd();
  const store = new ProjectStore(root);
  const clients = new Set<http.ServerResponse>();

  const collectAllowedAssets = (): Set<string> => {
    const allowed = new Set<string>();
    const add = (localPath: unknown) => {
      if (typeof localPath !== 'string' || localPath.length === 0) return;
      if (/^https?:\/\//.test(localPath)) return;
      allowed.add(path.resolve(root, localPath));
    };
    const model = compileToPreview(store.readDocument());
    add(model.logo?.localPath);
    add(model.cover?.localPath);
    for (const block of model.blocks) {
      add(block.content.localPath);
      if (Array.isArray(block.content.images)) {
        for (const img of block.content.images as Record<string, unknown>[]) add(img.localPath);
      }
    }
    return allowed;
  };

  const hostAllowed = (host: string | undefined): boolean =>
    !!host && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host);

  const server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    // Reject non-loopback Host headers (DNS-rebinding protection).
    if (!hostAllowed(req.headers.host)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (url === '/' || url.startsWith('/?')) {
      const doc = store.readDocument();
      const model = compileToPreview(doc);
      const html = renderDocument(model, { liveReload: options.watch });
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    if (url === '/__events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }

    // Serve ONLY local asset files referenced by the current draft. This keeps
    // secrets (.env) and workspace state (.build-with-ak/) off the wire even
    // though the server binds to loopback.
    const decoded = decodeURIComponent(url.split('?')[0]);
    const resolved = path.resolve(root, `.${decoded}`);
    const rootResolved = path.resolve(root);
    const contained = resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
    const allowed = collectAllowedAssets();
    if (contained && allowed.has(resolved) && fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      const ext = path.extname(resolved).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_BY_EXT[ext] ?? 'application/octet-stream' });
      fs.createReadStream(resolved).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  let watcher: fs.FSWatcher | undefined;
  if (options.watch) {
    // Watch the directory, not the document inode: atomic writes replace the
    // file via rename, which would silence an inode-bound watcher after one save.
    watcher = fs.watch(root, { persistent: false }, (_event, filename) => {
      if (filename && filename !== DOCUMENT_FILENAME) return;
      for (const client of clients) {
        client.write('event: draft-changed\ndata: {}\n\n');
      }
    });
  }

  const closeServer = (): Promise<void> => {
    const { promise, resolve } = Promise.withResolvers<void>();
    watcher?.close();
    for (const client of clients) client.end();
    clients.clear();
    server.close(() => resolve());
    return promise;
  };

  const { promise, resolve } = Promise.withResolvers<PreviewServerHandle>();
  server.listen(0, '127.0.0.1', () => {
    const address = server.address() as AddressInfo;
    resolve({
      url: `http://127.0.0.1:${address.port}`,
      port: address.port,
      close: closeServer,
    });
  });
  return promise;
}
