import { z } from 'zod';

/** Additive analytics contract; independent of the pinned authoring schemas. */
export const analyticsDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Expected a real calendar date in YYYY-MM-DD format.');

export const analyticsQuerySchema = z.object({
  listingId: z.string().uuid().optional().describe('Owned listing UUID; omitted selects your active listing.'),
  from: analyticsDateSchema.optional().describe('Inclusive UTC date. Defaults to 29 days before to.'),
  to: analyticsDateSchema.optional().describe('Inclusive UTC date. Defaults to today; cannot be in the future.'),
}).strict();

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export interface AnalyticsMetrics {
  /** Deduplicated per listing, IP + user agent, and UTC day; not unique people across days. */
  views: number;
  /** Redirect requests, not unique visitors. */
  outboundClicks: number;
  /** Unavailable: conversion tracking is not instrumented. Not external product sales. */
  referralConversions: null;
}

export interface ListingAnalyticsResponse {
  listing: { id: string; slug: string };
  period: { from: string; to: string; timezone: 'UTC' };
  source: 'first_party_postgresql';
  generatedAt: string;
  totals: AnalyticsMetrics;
  daily: Array<AnalyticsMetrics & { date: string }>;
}
