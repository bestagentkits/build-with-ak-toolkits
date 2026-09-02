import { z } from 'zod';
import {
  CATEGORIES,
  SLUG_REGEX,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  TAGLINE_MAX_LENGTH,
} from './generated/constants';
import { blocksSchema, blockSchema } from './generated/blocks-schema';
import { isReservedSlug } from './generated/slug';
export { upsertListingDraftSchema, type UpsertListingDraftInput } from './generated/validation';

export const slugSchema = z
  .string()
  .min(SLUG_MIN_LENGTH, `Slug must be at least ${SLUG_MIN_LENGTH} characters`)
  .max(SLUG_MAX_LENGTH, `Slug cannot exceed ${SLUG_MAX_LENGTH} characters`)
  .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. my-saas-tool)')
  .refine((s) => !isReservedSlug(s), { message: 'This slug is reserved for system routes' });

/**
 * Permissive schema for local drafting in workspace JSON and TUI studio.
 * Permits empty/partial values and local media references during early drafting.
 */
export const authoringDraftSchema = z.object({
  name: z.string().trim().default(''),
  slug: z.string().trim().default(''),
  tagline: z.string().trim().default(''),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]).optional().or(z.literal('')),
  websiteUrl: z.string().trim().default(''),
  demoUrl: z.string().trim().default(''),
  githubUrl: z.string().trim().default(''),
  twitterUrl: z.string().trim().default(''),
  logoAssetId: z.string().uuid().optional(),
  logoMediaRef: z.string().optional(),
  coverAssetId: z.string().uuid().optional(),
  coverMediaRef: z.string().optional(),
  blocks: z.array(z.any()).default([]),
});

export type AuthoringDraftInput = z.infer<typeof authoringDraftSchema>;

/**
 * Local structural/content readiness validation before submission.
 * Verifies local completeness: required fields, non-empty content, valid blocks.
 * Note: Server-authoritative checks (asset ownership, global slug availability, license)
 * are validated by the remote backend on submit.
 */
export const submissionReadinessSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(64, 'Product name cannot exceed 64 characters'),
  slug: slugSchema,
  tagline: z.string().trim().min(5, 'Tagline is required (min 5 characters)').max(TAGLINE_MAX_LENGTH, `Tagline cannot exceed ${TAGLINE_MAX_LENGTH} characters`),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]], {
    errorMap: () => ({ message: 'Valid category is required' }),
  }),
  websiteUrl: z.string().url('Invalid website URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted'),
  demoUrl: z.string().url('Invalid demo URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted').optional().or(z.literal('')),
  githubUrl: z.string().url('Invalid GitHub URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted').optional().or(z.literal('')),
  twitterUrl: z.string().url('Invalid Twitter/X URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted').optional().or(z.literal('')),
  logoAssetId: z.string().uuid('Product logo asset is required (must be a finalized asset UUID)'),
  coverAssetId: z.string().uuid().optional(),
  blocks: blocksSchema.refine((b) => Array.isArray(b) && b.length >= 1, {
    message: 'Showcase must contain at least 1 layout block',
  }),
});

export type SubmissionReadinessInput = z.infer<typeof submissionReadinessSchema>;
