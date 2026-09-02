import { z } from 'zod';
import {
  CATEGORIES,
  LINK_REL_POLICIES,
  SLUG_REGEX,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  TAGLINE_MAX_LENGTH,
} from './constants';
import { blocksSchema } from './blocks-schema';
import { isReservedSlug } from './slug';

const slugSchema = z
  .string()
  .min(SLUG_MIN_LENGTH, `Slug must be at least ${SLUG_MIN_LENGTH} characters`)
  .max(SLUG_MAX_LENGTH, `Slug cannot exceed ${SLUG_MAX_LENGTH} characters`)
  .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. my-saas-tool)')
  .refine((s) => !isReservedSlug(s), { message: 'This slug is reserved for system routes' });

export const upsertListingDraftSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(64, 'Product name cannot exceed 64 characters'),
  slug: slugSchema,
  tagline: z.string().trim().min(5, 'Tagline is required').max(TAGLINE_MAX_LENGTH, `Tagline cannot exceed ${TAGLINE_MAX_LENGTH} characters`),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]),
  websiteUrl: z.string().url('Invalid website URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted'),
  demoUrl: z.string().url('Invalid demo URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted').optional().or(z.literal('')),
  githubUrl: z.string().url('Invalid GitHub URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted').optional().or(z.literal('')),
  twitterUrl: z.string().url('Invalid Twitter/X URL').refine((u) => u.startsWith('https://'), 'Only https URLs are permitted').optional().or(z.literal('')),
  logoAssetId: z.string().uuid('Product thumbnail image is required'),
  coverAssetId: z.string().uuid().optional(),
  blocks: blocksSchema.default([]),
  expectedDraftRevisionId: z.string().uuid().optional(), // For copy-on-write CAS
});

export type UpsertListingDraftInput = z.infer<typeof upsertListingDraftSchema>;

export const adminModerateListingSchema = z.object({
  action: z.enum(['approve', 'needs_changes', 'reject', 'publish', 'unpublish', 'archive']),
  moderatorFeedback: z.string().max(2000).optional(),
  adminEditedSlug: slugSchema.optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).max(1000).optional(),
  linkRelPolicy: z.enum(LINK_REL_POLICIES as unknown as [string, ...string[]]).optional(),
});

export type AdminModerateListingInput = z.infer<typeof adminModerateListingSchema>;
