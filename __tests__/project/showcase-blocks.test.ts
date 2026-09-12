import { describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectStore } from '../../src/project/project-store';
import { compileToPreview, compileToWire } from '../../src/project/compiler';
import { renderBlock } from '../../src/preview/render-blocks';
import { showcaseBlocks, showcaseDraft } from '../fixtures/showcase-blocks';

describe('Showcase authoring and preview', () => {
  it('preserves Activities, Pulse, and video through disk roundtrip, wire compile, and preview', () => {
    const directory = mkdtempSync(join(tmpdir(), 'bwak-showcase-'));
    try {
      const store = new ProjectStore(directory);
      store.init({ environment: 'staging' });
      const doc = store.readDocument();
      Object.assign(doc.listing, showcaseDraft, { logoMediaRef: 'logo' });
      doc.media.logo = { assetId: showcaseDraft.logoAssetId };
      doc.blocks = showcaseBlocks.slice().reverse();
      store.writeDocument(doc);
      const restored = store.readDocument();
      expect(restored.blocks).toEqual(doc.blocks);
      expect(compileToWire(restored).blocks).toEqual(showcaseBlocks);
      const preview = compileToPreview(restored);
      expect(preview.blocks.map(({ type }) => type)).toEqual(['activities', 'pulse', 'video']);
      expect(preview.blocks.map(({ content }) => content)).toEqual(showcaseBlocks.map(({ content }) => content));
      restored.blocks[2].content.items[0].date = '2026-02-30';
      expect(() => compileToWire(restored)).toThrow();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  const render = (content: Record<string, unknown>) => renderBlock({ id: 'preview', order: 0, type: String(content.type), content });

  it('renders activities newest first without mutating authoring order and links public HTTPS safely', () => {
    const content = structuredClone(showcaseBlocks[0].content);
    const original = structuredClone(content);
    const html = render(content);
    expect(html).toContain('Release history');
    expect(html.indexOf('Export added')).toBeLessThan(html.indexOf('First release'));
    expect(html).toContain('href="https://example.com/releases/export"');
    expect(html).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(content).toEqual(original);
    expect(html).not.toContain('Unsupported block');
  });

  it.each(['javascript:alert(1)', 'https://127.0.0.1', 'https://user:pass@example.com'])('never makes invalid preview URLs clickable: %s', (url) => {
    const html = render({ type: 'activities', title: 'Activities', items: [{ title: '<img src=x>', description: 'Release', date: '2026-09-12', url }] });
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<img src=x>');
  });

  it('shows the actual unmonitored Pulse state and ignores fabricated author metrics', () => {
    const html = render({ type: 'pulse', title: 'Product pulse', uptime: '99.99%', views: 12345, responseTime: '25ms' });
    expect(html).toContain('Product pulse');
    expect(html).toContain('Not monitored in preview');
    expect(html).toContain('No monitoring samples are available in local preview.');
    expect(html).not.toMatch(/99\.99|12345|25ms|Unsupported block/);
  });

  it('renders video as a normalized YouTube link with title and caption', () => {
    const html = render(showcaseBlocks[2].content);
    expect(html).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(html).toContain('Product demo');
    expect(html).toContain('A tour of the editor.');
    expect(html).not.toContain('<iframe');
    expect(render({ type: 'video', url: 'javascript:alert(1)' })).not.toContain('href=');
  });
});
