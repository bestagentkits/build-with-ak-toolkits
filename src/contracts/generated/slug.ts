import { createHash } from 'crypto';
import {
  SLUG_REGEX,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  RESERVED_DIRECTORY_SLUGS,
} from './constants';
import type { BuildWithAkBlock } from './blocks-schema';

const RESERVED: Record<string, true> = Object.fromEntries(
  RESERVED_DIRECTORY_SLUGS.map((s) => [s, true as const]),
);

/**
 * Normalize an arbitrary product name into a candidate slug: strip diacritics
 * (incl. Vietnamese), lowercase, collapse non-alphanumerics to single hyphens,
 * and trim to the max length. May return an empty string for pathological input.
 */
export function slugifyName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/-+$/g, '');
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED[slug] === true;
}

/** A slug is valid when it matches the kebab format, is within length bounds, and is not reserved. */
export function isValidSlug(slug: string): boolean {
  return (
    slug.length >= SLUG_MIN_LENGTH &&
    slug.length <= SLUG_MAX_LENGTH &&
    SLUG_REGEX.test(slug) &&
    !isReservedSlug(slug)
  );
}

/**
 * Given a base slug and a membership predicate for slugs already taken across the
 * registry (current + historical + reserved), return the first available slug,
 * appending `-2`, `-3`, … when needed. Reserved bases are prefixed to avoid a
 * blocked base.
 */
export function resolveAvailableSlug(base: string, isTaken: (slug: string) => boolean): string {
  let initial = isReservedSlug(base) ? `${base}-product` : base;
  if (!initial) initial = 'product';
  const sanitized = initial.slice(0, SLUG_MAX_LENGTH).replace(/-+$/g, '');
  if (!isTaken(sanitized)) return sanitized;

  for (let n = 2; n < 1000; n++) {
    const suffix = `-${n}`;
    const maxBaseLen = SLUG_MAX_LENGTH - suffix.length;
    const truncatedBase = sanitized.slice(0, maxBaseLen).replace(/-+$/g, '');
    const candidate = `${truncatedBase}${suffix}`;
    if (!isTaken(candidate)) return candidate;
  }

  const hashSuffix = `-${createHash('sha256').update(String(Date.now())).digest('hex').slice(0, 6)}`;
  const truncatedBase = sanitized.slice(0, SLUG_MAX_LENGTH - hashSuffix.length).replace(/-+$/g, '');
  return `${truncatedBase}${hashSuffix}`;
}

/**
 * Stable content hash for a revision's blocks + metadata. Binds claim
 * verifications to exact content so an edit invalidates stale verifications and
 * publish can only promote verified content.
 */
export function computeContentHash(blocks: BuildWithAkBlock[], metadata: unknown): string {
  const canonical = JSON.stringify({ blocks, metadata });
  return createHash('sha256').update(canonical).digest('hex');
}
