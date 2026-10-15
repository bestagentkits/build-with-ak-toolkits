import { Transport, type ClientCredential, type FetchLike, type RequestOptions } from './transport';
import { BuildWithAkCapabilityError, BuildWithAkValidationError } from './errors';
import { analyticsQuerySchema, type AnalyticsQuery, type ListingAnalyticsResponse } from '../contracts/analytics';
export type { AnalyticsQuery, AnalyticsMetrics, ListingAnalyticsResponse } from '../contracts/analytics';
import type {
  BuildWithAkBlock,
  BuildWithAkInsertBlockInput,
  BuildWithAkPatchBlockInput,
} from '../contracts/blocks';
import type { UpsertListingDraftInput } from '../contracts/listing';

export type BuildWithAkEnvironment = 'staging' | 'production';

export const BASE_URLS: Record<BuildWithAkEnvironment, string> = {
  staging: 'https://staging.agentkit.best/api/build-with-ak',
  production: 'https://agentkit.best/api/build-with-ak',
};

export interface ClientCapabilities {
  targetExtensions: boolean;
}

export type BuildWithAkClientConfig = ClientCredential & {
  environment?: BuildWithAkEnvironment;
  baseUrl?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  capabilities?: Partial<ClientCapabilities>;
}

export interface ListingResponse {
  listing: {
    id: string;
    name: string;
    slug: string;
    status: string;
    draftRevisionId?: string;
    submittedRevisionId?: string;
    [key: string]: unknown;
  };
}

/** Request options for listing-scoped endpoints; `listingId` selects one of the caller's listings. */
export interface ListingRequestOptions extends RequestOptions {
  /** Owned listing UUID. Omitted targets the caller's oldest active listing (pre-multi-listing behaviour). */
  listingId?: string;
}

export interface ListingQuota {
  /** Maximum active listings, or null when unlimited (admin). */
  limit: number | null;
  used: number;
  remaining: number | null;
  freeSlots: number;
  purchasedSlots: number;
  unlimited: boolean;
}

export interface OwnedListingSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  category: string;
  status: string;
  upvotesCount: number;
  publishedAt: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListListingsResponse {
  listings: OwnedListingSummary[];
  total: number;
  limit: number;
  offset: number;
  quota: ListingQuota;
  /** Where to buy an extra submission slot when the quota is used up. */
  purchaseUrl: string;
}

export interface SubmitListingInput {
  listingId: string;
  expectedDraftRevisionId?: string;
}

export interface SubmitListingResponse {
  success: boolean;
  listingId: string;
  status: string;
  submittedRevisionId?: string;
}

export interface BlocksResponse {
  blocks: BuildWithAkBlock[];
}

export interface MediaAssetSummary {
  id: string;
  kind: string;
  publicUrl: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface ListMediaAssetsResponse {
  assets: MediaAssetSummary[];
}

export interface SlugAvailabilityResponse {
  available: boolean;
  slug: string;
  suggestions?: string[];
}

export interface UploadIntentResponse {
  intentId: string;
  presignedUrl: string;
  stagingKey: string;
  maxByteSize: number;
  expiresIn: number;
}

export interface FinalizeMediaResponse {
  success: boolean;
  assetId: string;
  assetUrl: string;
  mime: string;
  width: number;
  height: number;
}

export type MediaKind = 'logo' | 'cover' | 'screenshot';
export type MediaMimeType = 'image/png' | 'image/jpeg' | 'image/webp';

function splitListingOptions(options?: ListingRequestOptions): {
  query: Record<string, string | undefined> | undefined;
  options: RequestOptions | undefined;
} {
  if (!options) return { query: undefined, options: undefined };
  const { listingId, ...rest } = options;
  return { query: listingId ? { listingId } : undefined, options: rest };
}

export class BuildWithAkClient {
  private readonly transport: Transport;
  private readonly capabilities: ClientCapabilities;
  private readonly fetchImpl: FetchLike;

  constructor(config: BuildWithAkClientConfig) {
    const baseUrl = config.baseUrl ?? BASE_URLS[config.environment ?? 'production'];
    this.transport = new Transport({
      ...config,
      baseUrl,
    });
    this.capabilities = {
      targetExtensions: config.capabilities?.targetExtensions ?? false,
    };
    this.fetchImpl =
      config.fetch ??
      (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : (undefined as unknown as FetchLike));
  }

  /**
   * The configured fetch implementation, used for un-authenticated presigned
   * R2 uploads that must bypass the transport's x-api-key header injection.
   */
  get rawFetch(): FetchLike {
    return this.fetchImpl;
  }

  // ─── Base Endpoints ────────────────────────────────────────────────

  /** List the caller's active listings with the listing quota (multi-listing). */
  listListings(params: { limit?: number; offset?: number } = {}, options?: RequestOptions): Promise<ListListingsResponse> {
    return this.transport.request<ListListingsResponse>({
      method: 'GET',
      path: '/listings',
      query: {
        limit: params.limit === undefined ? undefined : String(params.limit),
        offset: params.offset === undefined ? undefined : String(params.offset),
      },
      options,
    });
  }

  getListing(options?: ListingRequestOptions): Promise<ListingResponse> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<ListingResponse>({ method: 'GET', path: '/listing', query, options: rest });
  }

  updateListing(input: UpsertListingDraftInput, options?: ListingRequestOptions): Promise<ListingResponse> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<ListingResponse>({ method: 'PUT', path: '/listing', query, body: input, options: rest });
  }

  /**
   * Create another listing (POST /listing). Fails with 409 LISTING_QUOTA_EXCEEDED
   * when the owner has no free slot; the error details carry the quota and purchaseUrl.
   */
  createListing(input: UpsertListingDraftInput, options?: RequestOptions): Promise<ListingResponse> {
    return this.transport.request<ListingResponse>({ method: 'POST', path: '/listing', body: input, options });
  }

  submitListing(input: SubmitListingInput, options?: RequestOptions): Promise<SubmitListingResponse> {
    const body: SubmitListingInput = { listingId: input.listingId };
    if (input.expectedDraftRevisionId !== undefined) {
      body.expectedDraftRevisionId = input.expectedDraftRevisionId;
    }
    return this.transport.request<SubmitListingResponse>({ method: 'POST', path: '/listing/submit', body, options });
  }

  getBlocks(options?: ListingRequestOptions): Promise<BlocksResponse> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<BlocksResponse>({ method: 'GET', path: '/listing/blocks', query, options: rest });
  }

  replaceBlocks(blocks: BuildWithAkBlock[], options?: ListingRequestOptions): Promise<BlocksResponse> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<BlocksResponse>({ method: 'PUT', path: '/listing/blocks', query, body: { blocks }, options: rest });
  }

  addBlock(block: BuildWithAkInsertBlockInput, options?: ListingRequestOptions): Promise<{ block: BuildWithAkBlock }> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<{ block: BuildWithAkBlock }>({ method: 'POST', path: '/listing/blocks', query, body: block, options: rest });
  }

  patchBlock(blockId: string, patch: BuildWithAkPatchBlockInput, options?: ListingRequestOptions): Promise<{ block: BuildWithAkBlock }> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<{ block: BuildWithAkBlock }>({
      method: 'PATCH',
      path: `/listing/blocks/${encodeURIComponent(blockId)}`,
      query,
      body: patch,
      options: rest,
    });
  }

  deleteBlock(blockId: string, options?: ListingRequestOptions): Promise<{ success: boolean }> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<{ success: boolean }>({
      method: 'DELETE',
      path: `/listing/blocks/${encodeURIComponent(blockId)}`,
      query,
      options: rest,
    });
  }

  reorderBlocks(blockIds: string[], options?: ListingRequestOptions): Promise<{ success: boolean }> {
    const { query, options: rest } = splitListingOptions(options);
    return this.transport.request<{ success: boolean }>({
      method: 'POST',
      path: '/listing/blocks/reorder',
      query,
      body: { blockIds },
      options: rest,
    });
  }

  createUploadIntent(kind: MediaKind, mimeType: MediaMimeType, options?: RequestOptions): Promise<UploadIntentResponse> {
    return this.transport.request<UploadIntentResponse>({
      method: 'POST',
      path: '/media/upload-intent',
      body: { kind, mimeType },
      options,
    });
  }

  finalizeMedia(stagingKey: string, kind: MediaKind, options?: RequestOptions): Promise<FinalizeMediaResponse> {
    return this.transport.request<FinalizeMediaResponse>({
      method: 'POST',
      path: '/media/finalize',
      body: { stagingKey, kind },
      options,
    });
  }

  /** Owner analytics extension; dates and range defaults are resolved by the server in UTC. */
  async getAnalytics(params: AnalyticsQuery = {}, options?: RequestOptions): Promise<ListingAnalyticsResponse> {
    const parsed = analyticsQuerySchema.safeParse(params);
    if (!parsed.success) {
      throw new BuildWithAkValidationError('Invalid analytics query.', parsed.error.issues);
    }
    return this.transport.request<ListingAnalyticsResponse>({
      method: 'GET', path: '/listing/analytics', query: parsed.data, options,
    });
  }

  // ─── Target Extension Endpoints (capability-gated) ──────────────────────

  async listMediaAssets(params?: { kind?: MediaKind }, options?: RequestOptions): Promise<ListMediaAssetsResponse> {
    if (!this.capabilities.targetExtensions) {
      throw new BuildWithAkCapabilityError('list_media_assets');
    }
    return this.transport.request<ListMediaAssetsResponse>({
      method: 'GET',
      path: '/media',
      query: { kind: params?.kind },
      options,
    });
  }

  async checkSlugAvailability(slug: string, options?: RequestOptions): Promise<SlugAvailabilityResponse> {
    if (!this.capabilities.targetExtensions) {
      throw new BuildWithAkCapabilityError('check_slug_availability');
    }
    return this.transport.request<SlugAvailabilityResponse>({
      method: 'GET',
      path: '/slug-availability',
      query: { slug },
      options,
    });
  }

  get supportsTargetExtensions(): boolean {
    return this.capabilities.targetExtensions;
  }
}
