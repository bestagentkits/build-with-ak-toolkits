/** Discovery for the upstream API, not a new REST route on the MCP Worker. */
export const analyticsOpenApiOperation = {
  get: {
    summary: 'Get owned product page analytics',
    operationId: 'getListingAnalytics',
    servers: [{ url: 'https://agentkit.best' }, { url: 'https://staging.agentkit.best' }],
    security: [{ ApiKeyAuth: [] }],
    description: 'Owner-only analytics from first-party PostgreSQL. Optional listingId selects any owned historical listing; omitted selects the active non-rejected/non-archived listing. Inclusive UTC dates default to today and 29 days earlier. Maximum 366 days; to cannot be in the future. Unknown or duplicate parameters, invalid dates, and invalid ranges return 400. Authenticated browser sessions are also accepted by the upstream API. The MCP Worker exposes this through build_with_ak_get_analytics, not a REST proxy.',
    parameters: [
      { name: 'listingId', in: 'query', required: false, schema: { type: 'string', format: 'uuid' }, description: 'Owned listing UUID; omitted selects the active listing.' },
      { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date' }, description: 'Inclusive UTC start, YYYY-MM-DD. Defaults to to minus 29 days.' },
      { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date' }, description: 'Inclusive UTC end, YYYY-MM-DD. Defaults to today; no future dates.' },
    ],
    responses: {
      '200': { description: 'Owned listing analytics with ascending, zero-filled daily counts.', content: { 'application/json': { schema: { $ref: '#/components/schemas/ListingAnalytics' } } } },
      '400': { description: 'Invalid, unknown, or duplicate query parameter or invalid date range.' },
      '401': { description: 'Authentication required or invalid API key.' },
      '403': { description: 'Credential is not permitted to access this API.' },
      '404': { description: 'No owned listing found; includes unknown or cross-owner listing IDs.' },
      '429': { description: 'Rate limit exceeded.' },
      '500': { description: 'Analytics retrieval failed.' },
    },
  },
};

export const analyticsOpenApiSchemas = {
  AnalyticsMetrics: {
    type: 'object', required: ['views', 'outboundClicks', 'referralConversions'],
    properties: {
      views: { type: 'integer', minimum: 0, description: 'Views deduplicated per listing, IP + user agent, and UTC day; not unique people across days.' },
      outboundClicks: { type: 'integer', minimum: 0, description: 'Outbound redirect requests, not unique visitors.' },
      referralConversions: { type: 'null', description: 'Unavailable: conversion tracking is not instrumented. Not external product sales.' },
    },
  },
  ListingAnalytics: {
    type: 'object', required: ['listing', 'period', 'source', 'generatedAt', 'totals', 'daily'],
    properties: {
      listing: { type: 'object', required: ['id', 'slug'], properties: { id: { type: 'string', format: 'uuid' }, slug: { type: 'string' } } },
      period: { type: 'object', required: ['from', 'to', 'timezone'], properties: { from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' }, timezone: { type: 'string', const: 'UTC' } } },
      source: { type: 'string', const: 'first_party_postgresql' },
      generatedAt: { type: 'string', format: 'date-time' },
      totals: { $ref: '#/components/schemas/AnalyticsMetrics' },
      daily: { type: 'array', minItems: 1, maxItems: 366, description: 'Ascending UTC dates, including zero-count view/click days. Referral conversions are null on every day because tracking is unavailable.', items: { allOf: [{ $ref: '#/components/schemas/AnalyticsMetrics' }, { type: 'object', required: ['date'], properties: { date: { type: 'string', format: 'date' } } }] } },
    },
  },
};
