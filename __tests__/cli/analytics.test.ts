import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(__dirname, '../..');
const listingId = '123e4567-e89b-12d3-a456-426614174000';
const analytics = {
  listing: { id: listingId, slug: 'test-product' },
  period: { from: '2026-08-01', to: '2026-08-01', timezone: 'UTC' },
  source: 'first_party_postgresql', generatedAt: '2026-08-02T00:00:00.000Z',
  totals: { views: 2, outboundClicks: 3, referralConversions: null },
  daily: [{ date: '2026-08-01', views: 2, outboundClicks: 3, referralConversions: null }],
};

describe('Analytics CLI process', () => {
  let dir: string;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'bwak-analytics-')); });
  afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

  function run(args: string[], status = 200) {
    // Bound the child process to a controlled upstream response; no real credentials/network.
    const loader = join(dir, 'upstream.cjs');
    writeFileSync(loader, `const fs = require('node:fs'); globalThis.fetch = async (url, init) => {
      fs.writeFileSync(${JSON.stringify(join(dir, 'request.json'))}, JSON.stringify({url, method: init.method, headers: init.headers}));
      return Response.json(${JSON.stringify(status === 200 ? analytics : { error: 'Analytics unavailable' })}, {status: ${status}});
    };`);
    return spawnSync(process.execPath, [
      '--require', loader, '--import', pathToFileURL(join(root, 'node_modules/tsx/dist/loader.mjs')).href, join(root, 'src/cli/main.ts'),
      'analytics', '--api-key', 'ck_live_explicit_test_key', '--env', 'staging', ...args,
    ], {
      cwd: dir, encoding: 'utf8', timeout: 15000,
      env: { ...process.env, AGENTKIT_API_KEY: '', AGENTKIT_ENV: '', NODE_OPTIONS: '' },
    });
  }

  it('runs stateless with --api-key and maps all CLI flags to the HTTP query', () => {
    const result = run(['--from', '2026-08-01', '--to', '2026-08-01', '--listing-id', listingId, '--json']);
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ ok: true, data: analytics });
    const request = JSON.parse(readFileSync(join(dir, 'request.json'), 'utf8'));
    const url = new URL(request.url);
    expect(url.origin).toBe('https://staging.agentkit.best');
    expect(Object.fromEntries(url.searchParams)).toEqual({ listingId, from: '2026-08-01', to: '2026-08-01' });
    expect(request.headers['x-api-key']).toBe('ck_live_explicit_test_key');
    expect(readdirSync(dir).sort()).toEqual(['request.json', 'upstream.cjs']);
  });

  it('shows metric limitations in human output and sends no default query', () => {
    const result = run([]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('not external product sales');
    expect(result.stdout).toContain('Analytics for test-product');
    expect(result.stdout).toContain('Referral conversions: unavailable');
    expect(result.stdout).toContain('Conversion tracking is not instrumented');
    expect(result.stdout).toContain('do not infer conversions or conversion rates');
    expect(result.stdout).not.toMatch(/Referral conversions: (?:null|0)/);
    expect(result.stdout).not.toContain('"referralConversions": null');
    expect(JSON.parse(readFileSync(join(dir, 'request.json'), 'utf8')).url).toBe('https://staging.agentkit.best/api/build-with-ak/listing/analytics');
  });

  it.each([[400, 2], [401, 3], [403, 3], [404, 4], [429, 6], [500, 6]])('maps upstream HTTP %i to exit %i', (status, exit) => {
    const result = run(['--json'], status);
    expect(result.status).toBe(exit);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { message: 'Analytics unavailable' } });
  });

  it('returns structured local validation errors before network access', () => {
    const result = run(['--from', '2026-02-30', '--json']);
    expect(result.status).toBe(2);
    expect(JSON.parse(result.stdout)).toMatchObject({ ok: false, error: { code: 'VALIDATION_ERROR' } });
    expect(readdirSync(dir)).toEqual(['upstream.cjs']);
  });
});
