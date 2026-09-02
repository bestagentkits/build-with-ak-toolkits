import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { renderDocument } from '../../src/preview/render-document';
import { exportStaticBundle } from '../../src/preview/export';
import type { PreviewModel } from '../../src/project/compiler';

describe('Phase 3: Preview Renderer & Static Export', () => {
  const previewModel: PreviewModel = {
    listing: {
      name: 'DataWeaver',
      slug: 'data-weaver',
      tagline: 'Streaming ETL for AI pipelines',
      category: 'developer_tools',
      websiteUrl: 'https://dataweaver.io',
    },
    logo: { localPath: './assets/logo.png' },
    blocks: [
      {
        id: 'hero-1',
        order: 0,
        type: 'hero_banner',
        content: { type: 'hero_banner', title: 'DataWeaver', tagline: 'Streaming ETL', badges: ['ETL', 'AI'] },
      },
      {
        id: 'story-1',
        order: 1,
        type: 'agentkit_story',
        content: { type: 'agentkit_story', body: 'Our journey with AgentKit.', usedKits: ['engineer'] },
      },
      {
        id: 'cols-1',
        order: 2,
        type: 'columns',
        content: {
          type: 'columns',
          variant: 'two',
          items: [{ heading: 'Fast', body: 'Very fast processing.' }],
        },
      },
      {
        id: 'tech-1',
        order: 3,
        type: 'tech_stack',
        content: { type: 'tech_stack', tags: ['Rust', 'TypeScript'] },
      },
      {
        id: 'quote-1',
        order: 4,
        type: 'maker_quote',
        content: {
          type: 'maker_quote',
          quote: 'Best tool ever.',
          attribution: 'Jane Doe',
          quoteSource: 'Review',
        },
      },
      {
        id: 'cta-1',
        order: 5,
        type: 'outbound_cta',
        content: { type: 'outbound_cta', label: 'Try Now' },
      },
    ],
  };

  it('renders masthead with product name and tagline', () => {
    const html = renderDocument(previewModel);
    expect(html).toContain('DataWeaver');
    expect(html).toContain('Streaming ETL for AI pipelines');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('renders all provided block types', () => {
    const html = renderDocument(previewModel);
    expect(html).toContain('data-block-type="hero_banner"');
    expect(html).toContain('data-block-type="agentkit_story"');
    expect(html).toContain('data-block-type="columns"');
    expect(html).toContain('data-block-type="tech_stack"');
    expect(html).toContain('data-block-type="maker_quote"');
    expect(html).toContain('data-block-type="outbound_cta"');
  });

  it('escapes HTML in user-supplied text to prevent XSS', () => {
    const maliciousModel: PreviewModel = {
      ...previewModel,
      listing: { ...previewModel.listing, name: '<script>alert(1)</script>' },
      blocks: [previewModel.blocks[0]],
    };
    const html = renderDocument(maliciousModel);
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('exports a standalone static bundle with strict CSP', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bwak-export-'));
    try {
      exportStaticBundle(previewModel, tmpDir, { offline: true });
      const indexPath = path.join(tmpDir, 'index.html');
      expect(fs.existsSync(indexPath)).toBe(true);

      const html = fs.readFileSync(indexPath, 'utf8');
      expect(html).toContain('Content-Security-Policy');
      // Offline bundle must forbid remote network fetches
      expect(html).toMatch(/default-src\s+'self'/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
