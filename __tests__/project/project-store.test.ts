import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { ProjectStore } from '../../src/project/project-store';

describe('Phase 3: Local Workspace Store', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bwak-store-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('init creates build-with-ak.json and .build-with-ak/state.json', () => {
    const store = new ProjectStore(tmpDir);
    store.init({ environment: 'staging' });

    expect(fs.existsSync(path.join(tmpDir, 'build-with-ak.json'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.build-with-ak', 'state.json'))).toBe(true);

    const doc = store.readDocument();
    expect(doc.schemaVersion).toBe(1);
    expect(doc.environment).toBe('staging');
  });

  it('adds .build-with-ak/ to .gitignore', () => {
    const store = new ProjectStore(tmpDir);
    store.init({ environment: 'production' });

    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.build-with-ak/');
  });

  it('does not duplicate .build-with-ak/ if gitignore already contains it', () => {
    fs.writeFileSync(path.join(tmpDir, '.gitignore'), 'node_modules/\n.build-with-ak/\n', 'utf8');
    const store = new ProjectStore(tmpDir);
    store.init({ environment: 'production' });

    const gitignore = fs.readFileSync(path.join(tmpDir, '.gitignore'), 'utf8');
    const occurrences = gitignore.split('\n').filter((l) => l.trim() === '.build-with-ak/').length;
    expect(occurrences).toBe(1);
  });

  it('writes document atomically (no leftover temp files)', () => {
    const store = new ProjectStore(tmpDir);
    store.init({ environment: 'staging' });

    const doc = store.readDocument();
    doc.listing.name = 'Atomic Test';
    store.writeDocument(doc);

    const reread = store.readDocument();
    expect(reread.listing.name).toBe('Atomic Test');

    // No leftover .tmp sibling files
    const files = fs.readdirSync(tmpDir);
    expect(files.some((f) => f.endsWith('.tmp'))).toBe(false);
  });

  it('reads and writes CAS state (baseDraftRevisionId, listingId)', () => {
    const store = new ProjectStore(tmpDir);
    store.init({ environment: 'staging' });

    store.writeState({
      listingId: 'listing-123',
      baseDraftRevisionId: 'rev-456',
      contentDigest: 'abc123',
    });

    const state = store.readState();
    expect(state.listingId).toBe('listing-123');
    expect(state.baseDraftRevisionId).toBe('rev-456');
  });

  it('detects an initialized workspace', () => {
    const store = new ProjectStore(tmpDir);
    expect(store.isInitialized()).toBe(false);
    store.init({ environment: 'staging' });
    expect(store.isInitialized()).toBe(true);
  });
});
