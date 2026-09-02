import { describe, it, expect } from 'vitest';
import { compileToWire, compileToPreview, MediaResolutionError } from '../../src/project/compiler';
import type { AuthoringDocument } from '../../src/project/authoring-schema';

describe('Phase 3: Authoring Compiler', () => {
  const dummyUUID = '123e4567-e89b-12d3-a456-426614174000';

  const baseDoc: AuthoringDocument = {
    $schema: 'https://agentkit.best/schemas/build-with-ak.json',
    schemaVersion: 1,
    environment: 'staging',
    listing: {
      name: 'PixelForge',
      slug: 'pixel-forge',
      tagline: 'AI-powered image generation studio',
      category: 'ai_agents',
      websiteUrl: 'https://pixelforge.ai',
      demoUrl: '',
      githubUrl: '',
      twitterUrl: '',
      logoMediaRef: 'logo',
    },
    media: {
      logo: { assetId: dummyUUID, localPath: './assets/logo.png' },
      hero: { localPath: './assets/hero.png' },
    },
    blocks: [
      {
        id: 'hero-1',
        order: 0,
        content: {
          type: 'hero_banner',
          title: 'PixelForge',
          tagline: 'AI-powered image generation',
          badges: ['AI'],
        },
      },
    ],
  };

  it('compiles to wire format with finalized asset UUID for logo', () => {
    const wire = compileToWire(baseDoc);
    expect(wire.logoAssetId).toBe(dummyUUID);
    expect(wire.name).toBe('PixelForge');
    expect(wire.slug).toBe('pixel-forge');
  });

  it('throws MediaResolutionError when a referenced media has no finalized assetId', () => {
    const docWithUnfinalized: AuthoringDocument = {
      ...baseDoc,
      listing: { ...baseDoc.listing, logoMediaRef: 'hero' }, // hero has no assetId
    };
    expect(() => compileToWire(docWithUnfinalized)).toThrow(MediaResolutionError);
  });

  it('compiles to preview format preserving local file paths', () => {
    const preview = compileToPreview(baseDoc);
    expect(preview.logo?.localPath).toBe('./assets/logo.png');
    expect(preview.listing.name).toBe('PixelForge');
  });

  it('resolves media refs inside blocks to finalized assetIds for wire mode', () => {
    const docWithMediaBlock: AuthoringDocument = {
      ...baseDoc,
      media: {
        ...baseDoc.media,
        shot1: { assetId: dummyUUID, localPath: './assets/shot1.png' },
      },
      blocks: [
        ...baseDoc.blocks,
        {
          id: 'gallery-1',
          order: 1,
          content: {
            type: 'screenshot_gallery',
            images: [{ mediaRef: 'shot1', alt: 'Screenshot' }],
          },
        },
      ],
    };

    const wire = compileToWire(docWithMediaBlock);
    const gallery = wire.blocks.find((b) => b.id === 'gallery-1');
    expect(gallery).toBeDefined();
    if (gallery && gallery.content.type === 'screenshot_gallery') {
      expect(gallery.content.images[0].assetId).toBe(dummyUUID);
    }
  });

  it('throws on an invalid block instead of silently dropping it', () => {
    const docWithBadBlock: AuthoringDocument = {
      ...baseDoc,
      media: { logo: { assetId: dummyUUID, localPath: './assets/logo.png' } },
      blocks: [
        ...baseDoc.blocks,
        {
          id: 'quote-bad',
          order: 1,
          // maker_quote missing required attribution + quoteSource
          content: { type: 'maker_quote', quote: 'Great tool' },
        },
      ],
    };
    expect(() => compileToWire(docWithBadBlock)).toThrow();
  });
});
