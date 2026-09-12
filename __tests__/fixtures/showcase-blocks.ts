import type { BuildWithAkBlock } from '../../src/contracts/blocks';

export const showcaseBlocks: BuildWithAkBlock[] = [
  { id: 'activities', order: 0, content: { type: 'activities', title: 'Release history', items: [
    { title: 'First release', description: 'Public launch.', date: '2026-08-01' },
    { title: 'Export added', description: 'Export project data.', date: '2026-09-12', url: 'https://example.com/releases/export' },
  ] } },
  { id: 'pulse', order: 1, content: { type: 'pulse', title: 'Product pulse' } },
  { id: 'video', order: 2, content: { type: 'video', url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Product demo', caption: 'A tour of the editor.' } },
];

export const showcaseDraft = {
  name: 'Showcase', slug: 'showcase-app', tagline: 'A showcase for our project',
  category: 'developer_tools' as const, websiteUrl: 'https://example.com',
  logoAssetId: '123e4567-e89b-12d3-a456-426614174000',
  expectedDraftRevisionId: '123e4567-e89b-12d3-a456-426614174001',
  blocks: showcaseBlocks,
};
