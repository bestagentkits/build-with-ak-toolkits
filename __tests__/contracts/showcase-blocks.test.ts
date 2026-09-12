import { describe, expect, it } from 'vitest';
import { blockContentSchema, blocksSchema, sanitizeBlocks, patchBlockSchema } from '../../src/contracts/blocks';
import { showcaseBlocks } from '../fixtures/showcase-blocks';

const activity = { title: 'Release', description: 'Available now.', date: '2024-02-29' };
const activities = (item: Record<string, unknown>) => ({ type: 'activities', items: [item] });

describe('Activities, Pulse, and video contracts', () => {
  it('preserves all new block content through validation and sanitization', () => {
    expect(blocksSchema.parse(showcaseBlocks)).toEqual(showcaseBlocks);
    expect(sanitizeBlocks(showcaseBlocks)).toEqual(showcaseBlocks);
  });

  it('applies empty Activities and Pulse defaults without author-supplied metrics', () => {
    expect(blockContentSchema.parse({ type: 'activities' })).toEqual({ type: 'activities', title: 'Activities', items: [] });
    expect(blockContentSchema.parse({ type: 'pulse', views: 500, sales: 10, title: 'Signals' })).toEqual({ type: 'pulse', title: 'Signals' });
    expect(blockContentSchema.parse({ type: 'pulse' })).toEqual({ type: 'pulse', title: 'Pulse' });
  });

  it.each(['2026-02-29', '2024-02-30', '2026-04-31', '2026-13-01', '2026-09-12T00:00:00Z', '09/12/2026', ''])('rejects invalid activity date %s', (date) => {
    expect(blockContentSchema.safeParse(activities({ ...activity, date })).success).toBe(false);
  });

  it('accepts leap days and omitted optional links', () => {
    expect(blockContentSchema.parse(activities(activity))).toMatchObject({ items: [activity] });
  });

  it.each(['javascript:alert(1)', 'http://example.com', 'https://user:pass@example.com', 'https://localhost', 'https://preview.local', 'https://service.internal', 'https://site.test', 'https://host.invalid', 'https://127.0.0.1', 'https://127.1', 'https://10.0.0.1', 'https://169.254.169.254', 'https://192.168.1.1', 'https://[::1]', 'https://[::ffff:127.0.0.1]', 'https://[fc00::1]', ''])('rejects unsafe activity link %s', (url) => {
    expect(blockContentSchema.safeParse(activities({ ...activity, url })).success).toBe(false);
  });

  it.each(['https://example.com/releases?v=2#notes', 'https://8.8.8.8/releases', 'https://[2606:4700:4700::1111]/'])('accepts public HTTPS link %s', (url) => {
    expect(blockContentSchema.safeParse(activities({ ...activity, url })).success).toBe(true);
  });

  it('enforces Activities item count and field length boundaries', () => {
    const valid = { ...activity, title: 't'.repeat(120), description: 'd'.repeat(2000), url: `https://example.com/${'a'.repeat(1980)}` };
    expect(blockContentSchema.safeParse({ type: 'activities', items: Array.from({ length: 50 }, () => valid) }).success).toBe(true);
    expect(blockContentSchema.safeParse({ type: 'activities', items: Array.from({ length: 51 }, () => activity) }).success).toBe(false);
    for (const change of [{ title: 't'.repeat(121) }, { description: 'd'.repeat(2001) }, { url: `https://example.com/${'a'.repeat(2000)}` }]) {
      expect(blockContentSchema.safeParse(activities({ ...activity, ...change })).success).toBe(false);
    }
    for (const type of ['activities', 'pulse']) {
      expect(blockContentSchema.safeParse({ type, title: 't'.repeat(121) }).success).toBe(false);
      expect(blockContentSchema.safeParse({ type, title: '<script>alert(1)</script>' }).success).toBe(false);
    }
    expect(blockContentSchema.safeParse(activities({ ...activity, description: '<iframe src="evil"></iframe>' })).success).toBe(false);
  });

  it('validates YouTube video content and preserves its optional text', () => {
    expect(blockContentSchema.parse(showcaseBlocks[2].content)).toEqual(showcaseBlocks[2].content);
    for (const url of ['https://example.com/video.mp4', 'javascript:alert(1)', 'https://youtu.be/short']) {
      expect(blockContentSchema.safeParse({ type: 'video', url }).success).toBe(false);
    }
  });

  it('requires complete valid content when patching while accepting order-only patches', () => {
    expect(patchBlockSchema.parse({ order: 2 })).toEqual({ order: 2 });
    expect(patchBlockSchema.safeParse({ content: activities({ ...activity, date: '2026-02-30' }) }).success).toBe(false);
    expect(patchBlockSchema.safeParse({ content: { title: 'Partial content' } }).success).toBe(false);
    expect(patchBlockSchema.parse({ content: { type: 'pulse' } })).toEqual({ content: { type: 'pulse', title: 'Pulse' } });
  });
});
