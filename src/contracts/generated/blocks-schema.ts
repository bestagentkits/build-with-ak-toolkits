/**
 * Build with AK — block layout Zod schemas + sanitizer.
 *
 * The showcase page is a curated set of typed blocks (no arbitrary HTML/JS).
 * Each block validates its own `content` shape; unknown types are dropped by
 * `sanitizeBlocks`. Rendering is a typed switch of server components — no field
 * here is ever passed to `dangerouslySetInnerHTML`.
 *
 * Provenance (Phase 3): a text field carrying a detected quantitative/superlative
 * claim requires `claimEvidence`; `maker_quote` requires `attribution` + `quoteSource`.
 */
import { z } from 'zod';
import { MAX_SCREENSHOTS } from './constants';

// Media in blocks references a FINALIZED R2 asset by id, never a raw URL.
// A caller-supplied `https://…` is rejected here (shape gate); the revision-write
// service additionally verifies the asset exists, is finalized, and is owned by
// the listing's user (Phase 2 finalize) before persisting. This closes the
// "arbitrary external image URL bypasses finalize" hole.
const assetId = z.string().uuid();

// Reject strings carrying markup/script vectors. Structured content only — no
// HTML is ever interpreted, but we defensively reject the obvious payloads so a
// stored value can never resemble executable markup in any downstream context.
const UNSAFE = /<\s*\/?\s*(script|iframe|object|embed|style|form|svg)\b|javascript:|data:text\/html|on\w+\s*=/i;
const safeText = (max: number) =>
  z
    .string()
    .max(max)
    .refine((s) => !UNSAFE.test(s), { message: 'Content contains disallowed markup' });

const claimEvidence = z
  .object({ kind: z.enum(['url', 'note']), value: safeText(500) })
  .optional();

const heroBanner = z.object({
  type: z.literal('hero_banner'),
  title: safeText(120),
  tagline: safeText(200),
  badges: z.array(safeText(40)).max(5).default([]),
});

const columns = z.object({
  type: z.literal('columns'),
  variant: z.enum(['two', 'three', 'bento']),
  items: z
    .array(
      z.object({
        heading: safeText(120),
        body: safeText(600),
        claimEvidence,
      }),
    )
    .min(1)
    .max(6),
});

const agentkitStory = z.object({
  type: z.literal('agentkit_story'),
  body: safeText(5000),
  usedKits: z.array(z.enum(['engineer', 'marketing', 'combo', 'app'])).max(4).default([]),
  claimEvidence,
});

const techStack = z.object({
  type: z.literal('tech_stack'),
  tags: z.array(safeText(40)).max(20).default([]),
});

const screenshotGallery = z.object({
  type: z.literal('screenshot_gallery'),
  images: z.array(z.object({ assetId, alt: safeText(200) })).max(MAX_SCREENSHOTS),
});

const imageFull = z.object({
  type: z.literal('image_full'),
  assetId,
  alt: safeText(200),
  caption: safeText(400).optional(),
});

const carouselGallery = z.object({
  type: z.literal('carousel_gallery'),
  images: z
    .array(
      z.object({
        assetId,
        alt: safeText(200),
        caption: safeText(400).optional(),
      })
    )
    .min(1, 'Carousel must contain at least 1 image')
    .max(MAX_SCREENSHOTS),
});
const makerQuote = z.object({
  type: z.literal('maker_quote'),
  quote: safeText(600),
  // attribution + quoteSource are REQUIRED (provenance): a testimonial must name
  // who said it and where it came from.
  attribution: safeText(120),
  quoteSource: safeText(300),
});

const outboundCta = z.object({
  type: z.literal('outbound_cta'),
  label: safeText(60),
  // The destination is the listing's validated websiteUrl at render time; this
  // optional field lets a block override the label only, never the policy.
  note: safeText(200).optional(),
});

export const blockContentSchema = z.discriminatedUnion('type', [
  heroBanner,
  columns,
  agentkitStory,
  techStack,
  screenshotGallery,
  imageFull,
  carouselGallery,
  makerQuote,
  outboundCta,
]);

export const blockSchema = z.object({
  id: z.string().min(1).max(64),
  order: z.number().int().min(0),
  content: blockContentSchema,
});

export const blocksSchema = z
  .array(blockSchema)
  .max(30)
  .superRefine((blocks, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (seen.has(b.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate block ID: "${b.id}"`,
          path: [i, 'id'],
        });
      }
      seen.add(b.id);
    }
  });

export type BuildWithAkBlockContent = z.infer<typeof blockContentSchema>;
export type BuildWithAkBlock = z.infer<typeof blockSchema>;

export const insertBlockSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  order: z.number().int().min(0).optional(),
  content: blockContentSchema,
});
export type BuildWithAkInsertBlockInput = z.infer<typeof insertBlockSchema>;

export const patchBlockSchema = z.object({
  order: z.number().int().min(0).optional(),
  content: blockContentSchema.optional(),
});
export type BuildWithAkPatchBlockInput = z.infer<typeof patchBlockSchema>;

export const reorderBlocksSchema = z.object({
  blockIds: z.array(z.string().min(1).max(64)).min(1),
});
export type BuildWithAkReorderBlocksInput = z.infer<typeof reorderBlocksSchema>;

/**
 * Drop malformed or unknown-type blocks; return only well-formed, known-type
 * blocks. `blockSchema` is a discriminated union over the canonical block types,
 * so `safeParse` alone rejects unknown types and unsafe/oversized fields — no
 * separate membership check or unchecked cast is needed. Runs on every write
 * before persisting a revision.
 */
export function sanitizeBlocks(input: unknown): BuildWithAkBlock[] {
  if (!Array.isArray(input)) return [];
  const out: BuildWithAkBlock[] = [];
  for (const raw of input) {
    const parsed = blockSchema.safeParse(raw);
    if (parsed.success) out.push(parsed.data);
  }
  return out;
}
