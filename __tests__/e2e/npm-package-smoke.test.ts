import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..', '..');

interface PackageManifest {
  bin: Record<string, string>;
  files: string[];
  main: string;
  types: string;
}

function readManifest(): PackageManifest {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as PackageManifest;
}

describe('Phase 6: npm package smoke', () => {
  it('declares the CLI and MCP binaries', () => {
    const pkg = readManifest();
    expect(pkg.bin['build-with-ak']).toBe('dist/cli/main.js');
    expect(pkg.bin['build-with-ak-mcp']).toBe('dist/mcp/stdio.js');
  });

  it('whitelists only distributable files and never ships secrets or tests', () => {
    const pkg = readManifest();
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('skills');
    expect(pkg.files).not.toContain('.env');
    expect(pkg.files).not.toContain('__tests__');
    // Only explicit whitelist; no wildcard that could sweep in .env* or sources.
    expect(pkg.files.every((f) => !f.startsWith('.env'))).toBe(true);
  });

  it('runs the real CLI end-to-end via tsx (template list --json)', () => {
    const stdout = execFileSync(
      process.execPath,
      [path.join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), path.join(ROOT, 'src', 'cli', 'main.ts'), 'template', 'list', '--json'],
      { cwd: ROOT, encoding: 'utf8', timeout: 30000 }
    );
    const envelope = JSON.parse(stdout.trim()) as { ok: boolean; data: unknown[] };
    expect(envelope.ok).toBe(true);
    expect(envelope.data).toHaveLength(5);
  });
});
