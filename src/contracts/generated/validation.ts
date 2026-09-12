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

export const slugSchema = z
  .string()
  .min(SLUG_MIN_LENGTH, `Slug must be at least ${SLUG_MIN_LENGTH} characters`)
  .max(SLUG_MAX_LENGTH, `Slug cannot exceed ${SLUG_MAX_LENGTH} characters`)
  .regex(SLUG_REGEX, 'Slug must contain only lowercase letters, numbers, and hyphens (e.g. my-saas-tool)')
  .refine((s) => !isReservedSlug(s), { message: 'This slug is reserved for system routes' });

const safeHttpsUrl = z
  .string()
  .url('Invalid URL format')
  .refine((u) => u.startsWith('https://'), 'Only https:// URLs are permitted');

const optionalHttpsUrl = safeHttpsUrl.optional().or(z.literal(''));

export const draftDocumentSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(64, 'Product name cannot exceed 64 characters'),
  slug: slugSchema,
  tagline: z.string().trim().max(TAGLINE_MAX_LENGTH, `Tagline cannot exceed ${TAGLINE_MAX_LENGTH} characters`).default(''),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]).default('developer_tools'),
  description: z.string().trim().max(5000, 'Description cannot exceed 5000 characters').optional().or(z.literal('')),
  websiteUrl: optionalHttpsUrl,
  demoUrl: optionalHttpsUrl,
  githubUrl: optionalHttpsUrl,
  twitterUrl: optionalHttpsUrl,
  logoAssetId: z.string().uuid().optional().or(z.literal('')),
  coverAssetId: z.string().uuid().optional().or(z.literal('')),
  blocks: blocksSchema.default([]),
  expectedDraftRevisionId: z.string().uuid().optional(),
});

export type DraftDocumentInput = z.infer<typeof draftDocumentSchema>;

export const submissionReadinessSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(64, 'Product name cannot exceed 64 characters'),
  slug: slugSchema,
  tagline: z.string().trim().min(5, 'Tagline is required (min 5 characters)').max(TAGLINE_MAX_LENGTH, `Tagline cannot exceed ${TAGLINE_MAX_LENGTH} characters`),
  category: z.enum(CATEGORIES as unknown as [string, ...string[]]),
  description: z.string().trim().max(5000, 'Description cannot exceed 5000 characters').optional().or(z.literal('')),
  websiteUrl: safeHttpsUrl,
  demoUrl: optionalHttpsUrl,
  githubUrl: optionalHttpsUrl,
  twitterUrl: optionalHttpsUrl,
  logoAssetId: z.string().uuid('Product thumbnail/logo is required'),
  coverAssetId: z.string().uuid().optional().or(z.literal('')),
  blocks: blocksSchema.default([]),
  expectedDraftRevisionId: z.string().uuid().optional(),
});

export type SubmissionReadinessInput = z.infer<typeof submissionReadinessSchema>;

export const upsertListingDraftSchema = draftDocumentSchema;
export type UpsertListingDraftInput = DraftDocumentInput;

export const adminModerateListingSchema = z.object({
  action: z.enum(['approve', 'needs_changes', 'reject', 'publish', 'unpublish', 'archive']),
  moderatorFeedback: z.string().max(2000).optional(),
  adminEditedSlug: slugSchema.optional(),
  isFeatured: z.boolean().optional(),
  featuredRank: z.number().int().min(0).max(1000).optional(),
  linkRelPolicy: z.enum(LINK_REL_POLICIES as unknown as [string, ...string[]]).optional(),
  expectedSubmittedRevisionId: z.string().uuid().optional(),
});

export type AdminModerateListingInput = z.infer<typeof adminModerateListingSchema>;
