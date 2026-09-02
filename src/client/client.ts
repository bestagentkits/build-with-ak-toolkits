import { Transport, type FetchLike, type RequestOptions } from './transport';
import { BuildWithAkCapabilityError } from './errors';
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

export interface BuildWithAkClientConfig {
  apiKey: string;
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

export class BuildWithAkClient {
  private readonly transport: Transport;
  private readonly capabilities: ClientCapabilities;
  private readonly fetchImpl: FetchLike;

  constructor(config: BuildWithAkClientConfig) {
    const baseUrl = config.baseUrl ?? BASE_URLS[config.environment ?? 'production'];
    this.transport = new Transport({
      apiKey: config.apiKey,
      baseUrl,
      fetch: config.fetch,
      timeoutMs: config.timeoutMs,
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

  // ─── Base Endpoints (11) ────────────────────────────────────────────────

  getListing(options?: RequestOptions): Promise<ListingResponse> {
    return this.transport.request<ListingResponse>({ method: 'GET', path: '/listing', options });
  }

  updateListing(input: UpsertListingDraftInput, options?: RequestOptions): Promise<ListingResponse> {
    return this.transport.request<ListingResponse>({ method: 'PUT', path: '/listing', body: input, options });
  }

  submitListing(input: SubmitListingInput, options?: RequestOptions): Promise<SubmitListingResponse> {
    const body: SubmitListingInput = { listingId: input.listingId };
    if (input.expectedDraftRevisionId !== undefined) {
      body.expectedDraftRevisionId = input.expectedDraftRevisionId;
    }
    return this.transport.request<SubmitListingResponse>({ method: 'POST', path: '/listing/submit', body, options });
  }

  getBlocks(options?: RequestOptions): Promise<BlocksResponse> {
    return this.transport.request<BlocksResponse>({ method: 'GET', path: '/listing/blocks', options });
  }

  replaceBlocks(blocks: BuildWithAkBlock[], options?: RequestOptions): Promise<BlocksResponse> {
    return this.transport.request<BlocksResponse>({ method: 'PUT', path: '/listing/blocks', body: { blocks }, options });
  }

  addBlock(block: BuildWithAkInsertBlockInput, options?: RequestOptions): Promise<{ block: BuildWithAkBlock }> {
    return this.transport.request<{ block: BuildWithAkBlock }>({ method: 'POST', path: '/listing/blocks', body: block, options });
  }

  patchBlock(blockId: string, patch: BuildWithAkPatchBlockInput, options?: RequestOptions): Promise<{ block: BuildWithAkBlock }> {
    return this.transport.request<{ block: BuildWithAkBlock }>({
      method: 'PATCH',
      path: `/listing/blocks/${encodeURIComponent(blockId)}`,
      body: patch,
      options,
    });
  }

  deleteBlock(blockId: string, options?: RequestOptions): Promise<{ success: boolean }> {
    return this.transport.request<{ success: boolean }>({ method: 'DELETE', path: `/listing/blocks/${encodeURIComponent(blockId)}`, options });
  }

  reorderBlocks(blockIds: string[], options?: RequestOptions): Promise<{ success: boolean }> {
    return this.transport.request<{ success: boolean }>({
      method: 'POST',
      path: '/listing/blocks/reorder',
      body: { blockIds },
      options,
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
