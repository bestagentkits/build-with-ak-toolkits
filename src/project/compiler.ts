import { upsertListingDraftSchema, type UpsertListingDraftInput } from '../contracts/listing';
import type { AuthoringDocument, MediaEntry } from './authoring-schema';

export class MediaResolutionError extends Error {
  public readonly mediaRef: string;
  constructor(mediaRef: string, reason: string) {
    super(`Cannot resolve media reference "${mediaRef}": ${reason}`);
    this.name = 'MediaResolutionError';
    this.mediaRef = mediaRef;
  }
}

export interface PreviewBlock {
  id: string;
  order: number;
  type: string;
  content: Record<string, unknown>;
}

export interface PreviewListing {
  name: string;
  slug: string;
  tagline: string;
  category: string;
  websiteUrl: string;
  demoUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
}

export interface PreviewModel {
  listing: PreviewListing;
  logo?: MediaEntry;
  cover?: MediaEntry;
  blocks: PreviewBlock[];
}

function requireFinalizedAsset(doc: AuthoringDocument, mediaRef: string): string {
  const entry = doc.media[mediaRef];
  if (!entry) {
    throw new MediaResolutionError(mediaRef, 'no media entry with this key exists in the workspace.');
  }
  if (!entry.assetId) {
    throw new MediaResolutionError(mediaRef, 'media has not been uploaded and finalized yet (run "build-with-ak media upload").');
  }
  return entry.assetId;
}

/** Resolve any `mediaRef` fields inside a block's content into finalized `assetId` UUIDs. */
function resolveBlockMediaToWire(doc: AuthoringDocument, content: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...content };

  if (typeof resolved.mediaRef === 'string') {
    resolved.assetId = requireFinalizedAsset(doc, resolved.mediaRef);
    delete resolved.mediaRef;
  }

  if (Array.isArray(resolved.images)) {
    resolved.images = resolved.images.map((img: Record<string, unknown>) => {
      const next = { ...img };
      if (typeof next.mediaRef === 'string') {
        next.assetId = requireFinalizedAsset(doc, next.mediaRef);
        delete next.mediaRef;
      }
      return next;
    });
  }

  return resolved;
}

export interface WireCandidate {
  name: string;
  slug: string;
  tagline: string;
  category: string;
  websiteUrl: string;
  demoUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  logoAssetId?: string;
  coverAssetId?: string;
  blocks: { id: string; order: number; content: Record<string, unknown> }[];
}

/**
 * Resolve the authoring document into an unvalidated wire candidate: media refs
 * become finalized asset UUIDs (throws MediaResolutionError if any is not yet
 * finalized) and blocks are ordered 0..N. Blocks are NOT dropped or sanitized —
 * invalid blocks surface as validation errors downstream instead of silently
 * vanishing from the pushed draft.
 */
export function buildWireCandidate(doc: AuthoringDocument): WireCandidate {
  const { listing } = doc;

  const logoAssetId = listing.logoMediaRef ? requireFinalizedAsset(doc, listing.logoMediaRef) : undefined;
  const coverAssetId = listing.coverMediaRef ? requireFinalizedAsset(doc, listing.coverMediaRef) : undefined;

  const blocks = doc.blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((b, index) => ({
      id: b.id,
      order: index,
      content: resolveBlockMediaToWire(doc, b.content),
    }));

  return {
    name: listing.name,
    slug: listing.slug,
    tagline: listing.tagline,
    category: listing.category,
    websiteUrl: listing.websiteUrl,
    demoUrl: listing.demoUrl || undefined,
    githubUrl: listing.githubUrl || undefined,
    twitterUrl: listing.twitterUrl || undefined,
    logoAssetId,
    coverAssetId,
    blocks,
  };
}

/**
 * Compile the authoring document into the exact `upsertListingDraftSchema` wire
 * shape. Throws ZodError (with per-field paths) on any invalid block or field,
 * and MediaResolutionError if a referenced media has not been finalized.
 */
export function compileToWire(doc: AuthoringDocument): UpsertListingDraftInput {
  return upsertListingDraftSchema.parse(buildWireCandidate(doc));
}

/**
 * Compile the authoring document into a preview model that preserves local file
 * paths, so the loopback preview server can render un-finalized drafts.
 */
export function compileToPreview(doc: AuthoringDocument): PreviewModel {
  const { listing } = doc;
  const logo = listing.logoMediaRef ? doc.media[listing.logoMediaRef] : undefined;
  const cover = listing.coverMediaRef ? doc.media[listing.coverMediaRef] : undefined;

  const blocks: PreviewBlock[] = doc.blocks
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((b, index) => ({
      id: b.id,
      order: index,
      type: String(b.content.type ?? 'unknown'),
      content: resolveBlockMediaToPreview(doc, b.content),
    }));

  return {
    listing: {
      name: listing.name,
      slug: listing.slug,
      tagline: listing.tagline,
      category: listing.category,
      websiteUrl: listing.websiteUrl,
      demoUrl: listing.demoUrl || undefined,
      githubUrl: listing.githubUrl || undefined,
      twitterUrl: listing.twitterUrl || undefined,
    },
    logo,
    cover,
    blocks,
  };
}

/** Resolve `mediaRef` fields into local file paths for preview rendering. */
function resolveBlockMediaToPreview(doc: AuthoringDocument, content: Record<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = { ...content };

  if (typeof resolved.mediaRef === 'string') {
    resolved.localPath = doc.media[resolved.mediaRef]?.localPath;
  }

  if (Array.isArray(resolved.images)) {
    resolved.images = resolved.images.map((img: Record<string, unknown>) => {
      const next = { ...img };
      if (typeof next.mediaRef === 'string') {
        next.localPath = doc.media[next.mediaRef]?.localPath;
      }
      return next;
    });
  }

  return resolved;
}
