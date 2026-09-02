import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProjectStore } from '../../src/project/project-store';
import { startPreviewServer, type PreviewServerHandle } from '../../src/preview/server';

describe('Phase 3: Preview server security', () => {
  let tmpDir: string;
  let handle: PreviewServerHandle;

  beforeEach(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bwak-srv-'));
    const store = new ProjectStore(tmpDir);
    store.init({ environment: 'staging' });
    const doc = store.readDocument();
    doc.listing.name = 'Srv';
    doc.listing.tagline = 'Preview server test';
    doc.listing.logoMediaRef = 'logo';
    doc.media.logo = { localPath: './assets/logo.png' };
    store.writeDocument(doc);

    fs.mkdirSync(path.join(tmpDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'assets', 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    fs.writeFileSync(path.join(tmpDir, '.env'), 'AGENTKIT_API_KEY=ck_live_secret');

    handle = await startPreviewServer({ root: tmpDir });
  });

  afterEach(async () => {
    await handle.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('serves the rendered index on loopback', async () => {
    const res = await fetch(`${handle.url}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
  });

  it('serves a referenced local asset', async () => {
    const res = await fetch(`${handle.url}/assets/logo.png`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('image/png');
  });

  it('refuses to serve .env even though it is under the workspace root', async () => {
    const res = await fetch(`${handle.url}/.env`);
    expect(res.status).toBe(404);
  });

  it('refuses to serve gitignored workspace state', async () => {
    const res = await fetch(`${handle.url}/.build-with-ak/state.json`);
    expect(res.status).toBe(404);
  });

  it('rejects non-loopback Host headers (DNS-rebinding protection)', async () => {
    const { promise, resolve, reject } = Promise.withResolvers<number>();
    const req = http.request(
      { host: '127.0.0.1', port: handle.port, path: '/', method: 'GET', headers: { Host: 'evil.example.com' } },
      (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }
    );
    req.on('error', reject);
    req.end();
    expect(await promise).toBe(403);
  });
});
