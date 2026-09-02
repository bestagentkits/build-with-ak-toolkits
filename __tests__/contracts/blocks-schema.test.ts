import { describe, it, expect } from 'vitest';
import {
  blockSchema,
  blocksSchema,
  sanitizeBlocks,
  type BuildWithAkBlock,
} from '../../src/contracts/blocks';
import { BLOCK_TYPES } from '../../src/constants';

describe('Phase 1: Block Schemas & Sanitization', () => {
  const dummyUUID = '123e4567-e89b-12d3-a456-426614174000';

  it('recognizes all 9 block types', () => {
    expect(BLOCK_TYPES).toHaveLength(9);
    expect(BLOCK_TYPES).toEqual([
      'hero_banner',
      'columns',
      'agentkit_story',
      'tech_stack',
      'screenshot_gallery',
      'image_full',
      'carousel_gallery',
      'maker_quote',
      'outbound_cta',
    ]);
  });

  it('validates a valid hero_banner block', () => {
    const block: BuildWithAkBlock = {
      id: 'block-hero-1',
      order: 0,
      content: {
        type: 'hero_banner',
        title: 'SuperAgent Studio',
        tagline: 'The ultimate AI developer workspace',
        badges: ['Next.js', 'AI Agents', 'Open Source'],
      },
    };
    const parsed = blockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
  });

  it('validates columns block with two, three, and bento variants', () => {
    for (const variant of ['two', 'three', 'bento'] as const) {
      const block = {
        id: `col-${variant}`,
        order: 1,
        content: {
          type: 'columns',
          variant,
          items: [
            {
              heading: 'Fast execution',
              body: 'Built for speed and reliability.',
            },
          ],
        },
      };
      const parsed = blockSchema.safeParse(block);
      expect(parsed.success).toBe(true);
    }
  });

  it('validates agentkit_story with usedKits', () => {
    const block = {
      id: 'story-1',
      order: 2,
      content: {
        type: 'agentkit_story',
        body: 'We used AgentKit to automate our entire workflow.',
        usedKits: ['engineer', 'marketing'],
      },
    };
    const parsed = blockSchema.safeParse(block);
    expect(parsed.success).toBe(true);
  });

  it('validates maker_quote with mandatory attribution and quoteSource', () => {
    const validQuote = {
      id: 'quote-1',
      order: 3,
      content: {
        type: 'maker_quote',
        quote: 'AgentKit changed how our engineering team ships.',
        attribution: 'Sarah Chen, CTO at TechFlow',
        quoteSource: 'Product Hunt Launch Review',
      },
    };
    expect(blockSchema.safeParse(validQuote).success).toBe(true);

    const missingSource = {
      id: 'quote-2',
      order: 3,
      content: {
        type: 'maker_quote',
        quote: 'Great product.',
        attribution: 'Anonymous',
      },
    };
    expect(blockSchema.safeParse(missingSource).success).toBe(false);
  });

  it('rejects unsafe XSS/script strings in safeText fields', () => {
    const badPayloads = [
      '<script>alert(1)</script>',
      '<iframe src="https://evil.com"></iframe>',
      'javascript:void(0)',
      '<img onerror="alert(1)" />',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    ];

    for (const bad of badPayloads) {
      const block = {
        id: 'hero-bad',
        order: 0,
        content: {
          type: 'hero_banner',
          title: bad,
          tagline: 'Normal tagline',
          badges: [],
        },
      };
      const parsed = blockSchema.safeParse(block);
      expect(parsed.success).toBe(false);
    }
  });

  it('enforces UUID assetId on media-bearing blocks', () => {
    const rawUrlBlock = {
      id: 'img-1',
      order: 0,
      content: {
        type: 'image_full',
        assetId: 'https://example.com/logo.png', // Invalid: must be UUID
        alt: 'Hero banner',
      },
    };
    expect(blockSchema.safeParse(rawUrlBlock).success).toBe(false);

    const validUuidBlock = {
      id: 'img-1',
      order: 0,
      content: {
        type: 'image_full',
        assetId: dummyUUID,
        alt: 'Hero banner',
      },
    };
    expect(blockSchema.safeParse(validUuidBlock).success).toBe(true);
  });

  it('rejects duplicate block IDs in blocksSchema', () => {
    const duplicateBlocks = [
      {
        id: 'duplicate-id',
        order: 0,
        content: {
          type: 'hero_banner',
          title: 'Hero',
          tagline: 'Tagline',
          badges: [],
        },
      },
      {
        id: 'duplicate-id',
        order: 1,
        content: {
          type: 'tech_stack',
          tags: ['React'],
        },
      },
    ];
    const parsed = blocksSchema.safeParse(duplicateBlocks);
    expect(parsed.success).toBe(false);
  });

  it('sanitizeBlocks drops malformed or unknown block types while preserving valid blocks', () => {
    const mixedInput = [
      {
        id: 'valid-1',
        order: 0,
        content: {
          type: 'hero_banner',
          title: 'Valid Hero',
          tagline: 'Valid Tagline',
          badges: [],
        },
      },
      {
        id: 'invalid-unknown-type',
        order: 1,
        content: {
          type: 'unknown_widget',
          data: 123,
        },
      },
      {
        id: 'invalid-script',
        order: 2,
        content: {
          type: 'hero_banner',
          title: '<script>alert(1)</script>',
          tagline: 'Tagline',
          badges: [],
        },
      },
    ];

    const sanitized = sanitizeBlocks(mixedInput);
    expect(sanitized).toHaveLength(1);
    expect(sanitized[0].id).toBe('valid-1');
  });
});
