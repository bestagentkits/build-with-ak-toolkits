/**
 * Build with AK — canonical constants (single source of truth).
 *
 * DB `check()` constraints, Zod validation, and the public OpenAPI contract all
 * derive from these arrays. A drift test (`constants-drift.test.ts`) fails if any
 * surface diverges. Never inline a status/category literal elsewhere — import it.
 */

// Listing lifecycle. Non-terminal = every status except rejected|archived.
// The per-user quota partial index covers all non-terminal statuses so a user
// cannot park a second listing as draft or unpublished.
export const LISTING_STATUSES = [
  'draft',
  'pending_review',
  'needs_changes',
  'approved',
  'published',
  'unpublished',
  'rejected',
  'archived',
] as const;
export type BuildWithAkListingStatus = (typeof LISTING_STATUSES)[number];

export const TERMINAL_LISTING_STATUSES = ['rejected', 'archived'] as const;
export const NON_TERMINAL_LISTING_STATUSES = LISTING_STATUSES.filter(
  (s): s is BuildWithAkListingStatus =>
    !(TERMINAL_LISTING_STATUSES as readonly string[]).includes(s),
);

export function isNonTerminalListingStatus(status: string): status is BuildWithAkListingStatus {
  return (NON_TERMINAL_LISTING_STATUSES as readonly string[]).includes(status);
}

// Promotion ($49 package) lifecycle. checkout_pending is created at checkout and
// swept to expired if abandoned; payment records pending_review (never approved).
export const PROMOTION_STATUSES = [
  'checkout_pending',
  'pending_review',
  'approved',
  'scheduled',
  'partially_delivered',
  'delivered',
  'declined',
  'partial_refund_pending',
  'partially_refunded',
  'refunded',
  'failed',
  'expired',
] as const;
export type BuildWithAkPromotionStatus = (typeof PROMOTION_STATUSES)[number];

// Statuses that hold the active-promotion-per-listing lock.
export const ACTIVE_PROMOTION_STATUSES = [
  'checkout_pending',
  'pending_review',
  'approved',
  'scheduled',
  'partially_delivered',
  'partial_refund_pending',
] as const;

// Four promotion deliverable channels, one row each in the deliverables table.
export const DELIVERABLE_CHANNELS = [
  'newsletter',
  'substack',
  'founder_facebook',
  'agentkit_facebook',
] as const;
export type BuildWithAkDeliverableChannel = (typeof DELIVERABLE_CHANNELS)[number];

export const CHANNEL_STATUSES = ['pending', 'scheduled', 'published', 'skipped'] as const;
export type BuildWithAkChannelStatus = (typeof CHANNEL_STATUSES)[number];

// Product categories for the directory.
export const CATEGORIES = [
  'developer_tools',
  'ai_agents',
  'saas',
  'productivity',
  'ecommerce',
  'marketing_sales',
  'education',
  'other',
] as const;
export type BuildWithAkCategory = (typeof CATEGORIES)[number];

// Outbound-link rel policy. Default nofollow_ugc; editorial_follow is admin-only
// after SEO review and is never granted by purchasing the $49 package.
export const LINK_REL_POLICIES = ['nofollow_ugc', 'editorial_follow'] as const;
export type BuildWithAkLinkRelPolicy = (typeof LINK_REL_POLICIES)[number];

export const LINK_REL_ATTRIBUTES: Record<BuildWithAkLinkRelPolicy, string> = {
  nofollow_ugc: 'noopener noreferrer nofollow ugc',
  editorial_follow: 'noopener noreferrer',
};

// Consent purposes. sponsored_promotion is DISTINCT from general newsletter
// consent — a subscriber's default newsletter consent does not authorize
// sending them paid third-party promotions.
export const CONSENT_PURPOSES = ['newsletter', 'sponsored_promotion'] as const;
export type BuildWithAkConsentPurpose = (typeof CONSENT_PURPOSES)[number];

// Block layout types. Layout variants (2-col/3-col/bento) are one `columns`
// block with a variant discriminator; domain blocks are distinct behaviors.
export const BLOCK_TYPES = [
  'hero_banner',
  'columns', // variant: 'two' | 'three' | 'bento'
  'agentkit_story',
  'tech_stack',
  'screenshot_gallery',
  'image_full',
  'carousel_gallery',
  'maker_quote',
  'outbound_cta',
] as const;
export type BuildWithAkBlockType = (typeof BLOCK_TYPES)[number];

// Analytics event kinds recorded in the append-only ledger.
export const ANALYTICS_EVENT_KINDS = ['view', 'click', 'conversion'] as const;
export type BuildWithAkAnalyticsEventKind = (typeof ANALYTICS_EVENT_KINDS)[number];

// Slug registry entry kinds. A single global UNIQUE on slug across all kinds
// prevents a new current slug from reusing another listing's historical slug.
export const SLUG_REGISTRY_KINDS = ['current', 'historical', 'reserved'] as const;
export type BuildWithAkSlugRegistryKind = (typeof SLUG_REGISTRY_KINDS)[number];

// Slugs reserved for system routes; seeded into the registry as kind='reserved'.
export const RESERVED_DIRECTORY_SLUGS = [
  'admin', 'api', 'auth', 'login', 'logout', 'register', 'signin', 'signup',
  'account', 'dashboard', 'settings', 'billing', 'checkout',
  'new', 'edit', 'submit', 'create', 'category', 'search', 'filter',
  'featured', 'promoted', 'sponsor', 'promo', 'all', 'top', 'popular', 'latest',
  'sitemap', 'rss', 'feed', 'blog', 'docs', 'pricing', 'changelog', 'leaderboard',
  'terms', 'privacy', 'assets', 'static', 'images', 'media', 'cdn',
] as const;

// Slug format: lowercase alphanumerics separated by single hyphens.
export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const SLUG_MIN_LENGTH = 3;
export const SLUG_MAX_LENGTH = 64;
export const TAGLINE_MAX_LENGTH = 160;

// Media limits (bytes) enforced server-side at finalize.
export const MEDIA_LIMITS = {
  logo: 2 * 1024 * 1024,
  cover: 5 * 1024 * 1024,
  screenshot: 5 * 1024 * 1024,
} as const;
export const ALLOWED_IMAGE_MIME = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME)[number];
export const MAX_SCREENSHOTS = 5;

// Promotion pricing (single source of truth; user-confirmed 2026-08-31).
// USD is stored in cents; VND is stored in whole đồng (integer currency units).
export const PROMOTION_PRICE = {
  usdCents: 4900,
  vndAmount: 1_250_000,
} as const;
export const PROMOTION_PRODUCT_CODE = 'build_with_ak_promotion_49';
