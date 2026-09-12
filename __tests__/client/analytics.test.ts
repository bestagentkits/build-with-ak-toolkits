import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import { BuildWithAkClient } from '../../src/client/client';
import { analyticsQuerySchema, type ListingAnalyticsResponse } from '../../src/contracts/analytics';
import { BuildWithAkValidationError } from '../../src/client/errors';

describe('Owner analytics client', () => {
  it('types listing slugs as strings and unavailable conversions as literal null', () => {
    expectTypeOf<ListingAnalyticsResponse['listing']['slug']>().toEqualTypeOf<string>();
    expectTypeOf<ListingAnalyticsResponse['totals']['referralConversions']>().toEqualTypeOf<null>();
    expectTypeOf<ListingAnalyticsResponse['daily'][number]['referralConversions']>().toEqualTypeOf<null>();
  });

  it('sends credentials and requested filters without requiring target extensions', async () => {
    const response = { listing: { id: '123e4567-e89b-12d3-a456-426614174000', slug: 'test-product' }, daily: [] };
    const fetch = vi.fn(async () => Response.json(response));
    const client = new BuildWithAkClient({ apiKey: 'test-key', fetch });
    const query = { listingId: response.listing.id, from: '2026-08-01', to: '2026-08-31' };
    expect(await client.getAnalytics(query)).toEqual(response);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(new URL(url).pathname).toBe('/api/build-with-ak/listing/analytics');
    expect(Object.fromEntries(new URL(url).searchParams)).toEqual(query);
    expect(init.method).toBe('GET');
    expect(new Headers(init.headers).get('x-api-key')).toBe('test-key');
    expect(init.body).toBeUndefined();
  });

  it('leaves omitted defaults for the server to resolve in UTC', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({}));
    await new BuildWithAkClient({ apiKey: 'test-key', fetch }).getAnalytics();
    expect(fetch.mock.calls[0][0]).toBe('https://agentkit.best/api/build-with-ak/listing/analytics');
  });

  it.each([{ from: '2026-02-30' }, { to: '' }, { from: '2026-1-01' }, { listingId: 'other' }, { unknown: 'value' }])('rejects invalid query %j before requesting', async (query) => {
    const fetch = vi.fn();
    const client = new BuildWithAkClient({ apiKey: 'test-key', fetch });
    await expect(client.getAnalytics(query as never)).rejects.toBeInstanceOf(BuildWithAkValidationError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('accepts leap days and delegates dynamic date-range rules to the server', () => {
    expect(analyticsQuerySchema.safeParse({ from: '2024-02-29', to: '2024-03-01' }).success).toBe(true);
    expect(analyticsQuerySchema.safeParse({ from: '2025-02-29' }).success).toBe(false);
  });

  it.each([400, 401, 403, 404, 429, 500])('preserves upstream HTTP %i failures', async (status) => {
    const fetch = vi.fn(async () => Response.json({ error: 'Analytics unavailable' }, { status }));
    const client = new BuildWithAkClient({ apiKey: 'test-key', fetch });
    await expect(client.getAnalytics()).rejects.toMatchObject({ status, message: 'Analytics unavailable' });
  });
});
