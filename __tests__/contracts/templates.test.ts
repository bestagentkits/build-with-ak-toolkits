import { describe, it, expect } from 'vitest';
import {
  BUILD_WITH_AK_TEMPLATES,
  instantiateTemplate,
  type TemplateId,
} from '../../src/contracts/templates';
import { blocksSchema } from '../../src/contracts/blocks';

describe('Phase 1: Layout Template Blueprints & Factory', () => {
  const templateIds: TemplateId[] = [
    'minimalist_showcase',
    'saas_product_launch',
    'devtool_open_source',
    'visual_media_app',
    'comprehensive_case_study',
  ];

  it('defines all 5 curated templates in registry', () => {
    expect(BUILD_WITH_AK_TEMPLATES).toHaveLength(5);
    const registeredIds = BUILD_WITH_AK_TEMPLATES.map((t) => t.id);
    expect(registeredIds).toEqual(templateIds);
  });

  it.each(templateIds)('instantiates valid blocks for template "%s"', (templateId) => {
    const metadata = {
      name: 'OmniCoder',
      tagline: 'Next-generation AI code completion engine',
      category: 'developer_tools',
      websiteUrl: 'https://omnicoder.ai',
    };

    const blocks = instantiateTemplate(templateId, metadata);

    // Must be non-empty array of blocks
    expect(blocks.length).toBeGreaterThanOrEqual(3);

    // Must pass schema validation
    const parsed = blocksSchema.safeParse(blocks);
    if (!parsed.success) {
      console.error(parsed.error.format());
    }
    expect(parsed.success).toBe(true);

    // Contiguous orders 0..N
    for (let i = 0; i < blocks.length; i++) {
      expect(blocks[i].order).toBe(i);
    }

    // Unique block IDs
    const ids = new Set(blocks.map((b) => b.id));
    expect(ids.size).toBe(blocks.length);

    // Hero banner should inherit product name & tagline
    const hero = blocks.find((b) => b.content.type === 'hero_banner');
    if (hero && hero.content.type === 'hero_banner') {
      expect(hero.content.title).toBe(metadata.name);
      expect(hero.content.tagline).toBe(metadata.tagline);
    }
  });

  it('throws when requested template ID is unknown', () => {
    expect(() =>
      instantiateTemplate('unknown_template' as TemplateId, {
        name: 'Test',
        tagline: 'Test Tagline',
      })
    ).toThrow(/Unknown template/);
  });
});
