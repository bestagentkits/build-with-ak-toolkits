import { z } from 'zod';
import { CATEGORIES } from '../contracts/generated/constants';

/**
 * A local media reference in the authoring workspace. During drafting a media
 * entry may exist with only a `localPath` (not yet uploaded); once uploaded and
 * finalized it also carries the durable `assetId` UUID.
 */
export const mediaEntrySchema = z.object({
  assetId: z.string().uuid().optional(),
  localPath: z.string().optional(),
  mime: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
});

export type MediaEntry = z.infer<typeof mediaEntrySchema>;

export const authoringListingSchema = z.object({
  name: z.string().default(''),
  slug: z.string().default(''),
  tagline: z.string().default(''),
  category: z.string().default(''),
  websiteUrl: z.string().default(''),
  demoUrl: z.string().default(''),
  githubUrl: z.string().default(''),
  twitterUrl: z.string().default(''),
  logoMediaRef: z.string().optional(),
  coverMediaRef: z.string().optional(),
});

export type AuthoringListing = z.infer<typeof authoringListingSchema>;

/**
 * Authoring blocks are permissive during drafting: media-bearing fields carry a
 * local `mediaRef` (a key into the document `media` map) instead of a finalized
 * `assetId`. The wire compiler resolves these into `assetId` UUIDs.
 */
export const authoringBlockSchema = z.object({
  id: z.string(),
  order: z.number().int().min(0),
  content: z.record(z.any()),
});

export type AuthoringBlock = z.infer<typeof authoringBlockSchema>;

export const authoringDocumentSchema = z.object({
  $schema: z.string().default('https://agentkit.best/schemas/build-with-ak.json'),
  schemaVersion: z.literal(1).default(1),
  environment: z.enum(['staging', 'production']).default('production'),
  listing: authoringListingSchema.default({}),
  media: z.record(mediaEntrySchema).default({}),
  blocks: z.array(authoringBlockSchema).default([]),
});

export type AuthoringDocument = z.infer<typeof authoringDocumentSchema>;

export interface WorkspaceState {
  listingId?: string;
  baseDraftRevisionId?: string;
  contentDigest?: string;
  lastPulledAt?: string;
}

export const CATEGORY_VALUES: readonly string[] = CATEGORIES;

export function createEmptyDocument(environment: 'staging' | 'production'): AuthoringDocument {
  return authoringDocumentSchema.parse({
    environment,
    listing: {},
    media: {},
    blocks: [],
  });
}
