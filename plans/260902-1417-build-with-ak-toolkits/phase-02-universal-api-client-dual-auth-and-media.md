---
phase: 2
title: "Universal API Client, Upstream Delegation & 2-Step Media Pipeline"
status: pending
priority: P1
effort: "5h"
dependencies: [0, 1]
---

# Phase 2: Universal API Client, Upstream Delegation & 2-Step Media Pipeline

## Overview

Build the universal typed API client covering all customer endpoints on `ak-web` with capability gating (11 base endpoints + 2 target extension endpoints), establish the upstream credential delegation model (separating inbound MCP client auth from upstream AgentKit API requests), and implement the 2-step media upload pipeline (intent $\rightarrow$ presigned R2 PUT $\rightarrow$ finalize) ensuring asset UUID containment.

## Requirements

- **Functional:**
  - **Universal API Client (`src/client/client.ts`):**
    - Base Methods (11 endpoints):
      * `getListing(options)`: `GET /api/build-with-ak/listing`.
      * `updateListing(input, options)`: `PUT /api/build-with-ak/listing` (Atomic CAS with `expectedDraftRevisionId`).
      * `submitListing(input, options)`: `POST /api/build-with-ak/listing/submit` (`{ listingId }` on base, plus optional `expectedDraftRevisionId` on target).
      * `getBlocks(options)`: `GET /api/build-with-ak/listing/blocks`.
      * `replaceBlocks(blocks, options)`: `PUT /api/build-with-ak/listing/blocks`.
      * `addBlock(block, options)`: `POST /api/build-with-ak/listing/blocks`.
      * `patchBlock(blockId, patch, options)`: `PATCH /api/build-with-ak/listing/blocks/[blockId]`.
      * `deleteBlock(blockId, options)`: `DELETE /api/build-with-ak/listing/blocks/[blockId]`.
      * `reorderBlocks(blockIds, options)`: `POST /api/build-with-ak/listing/blocks/reorder`.
      * `createUploadIntent(kind, mimeType, options)`: `POST /api/build-with-ak/media/upload-intent`.
      * `finalizeMedia(stagingKey, kind, options)`: `POST /api/build-with-ak/media/finalize`.
    - Target Extension Methods (Gated by capability flags):
      * `listMediaAssets(kind?, options)`: `GET /api/build-with-ak/media?kind=...`.
      * `checkSlugAvailability(slug, options)`: `GET /api/build-with-ak/slug-availability?slug=...`.
  - **Upstream Credential Delegation Model:**
    - **Base Remote Lane:** The universal client and Cloudflare Worker communicate with `ak-web` via `x-api-key: ck_live_...` headers (passthrough of the developer's customer key).
    - **Upstream Dependency (Target Extension):** OAuth-backed user delegation (where an inbound OAuth Bearer token is exchanged for an upstream user session or verified directly by `ak-web`) requires `ak-web` to support upstream Bearer validation or an RFC 8693 Token Exchange endpoint. This lane is capability-gated until `ak-web` deploys that contract.
    - **Security Invariant:** Inbound OAuth 2.1 Bearer tokens received by the Cloudflare Worker are NEVER blindly forwarded as `Authorization` to `/api/build-with-ak/*` (which only accepts customer `x-api-key` or browser session cookies).
  - **2-Step Media Upload Service (`src/media/upload.ts`):**
    - Step 1: POST `/media/upload-intent` with `{ kind, mimeType }` $\rightarrow$ receives `{ intentId, presignedUrl, stagingKey, maxByteSize }`.
    - Step 2: Directly streams bytes via `PUT presignedUrl` with `Content-Type: mimeType` (without attaching `x-api-key` header).
    - Step 3: POST `/media/finalize` with `{ stagingKey, kind }` $\rightarrow$ receives `{ assetId, assetUrl, mime, width, height }`.
    - Error handling: Redacts presigned URLs and temporary query parameters from logs/errors.
  - **Typed Error Hierarchy (`src/client/errors.ts`):**
    - `BuildWithAkError`, `BuildWithAkAuthError` (401/403), `BuildWithAkConflictError` (409 `STALE_REVISION`), `BuildWithAkValidationError` (422), `BuildWithAkNotFoundError` (404), `BuildWithAkRateLimitError` (429), `BuildWithAkCapabilityError` (for unactivated target endpoints).
- **Non-functional:**
  - Zero Node-only module imports in `src/client/` to guarantee 100% isomorphic execution in Cloudflare Workers.
  - Timeout and `AbortSignal` cancellation support on all HTTP operations.

## Architecture

```text
[Local CLI / Studio / Worker Service]
       │
       ▼
[src/client/client.ts] (Isomorphic Fetch Wrapper)
       ├─► Fixed Base URL Target:
       │     ├─► Staging: https://staging.agentkit.best/api/build-with-ak
       │     └─► Production: https://agentkit.best/api/build-with-ak
       │
       ├─► Outbound Auth: Header `x-api-key: ck_live_...`
       │
       └─► 2-Step Media Upload Pipeline (src/media/upload.ts)
             ├── 1. POST /media/upload-intent (Auth: x-api-key)
             ├── 2. Direct PUT presignedUrl (Auth: NONE - R2 Signed URL)
             └── 3. POST /media/finalize (Auth: x-api-key) ──► Returns assetId UUID
```

## Related Code Files

- Create: `src/client/transport.ts`
- Create: `src/client/client.ts`
- Create: `src/client/errors.ts`
- Create: `src/media/upload.ts`
- Create: `__tests__/client/client-base.test.ts`
- Create: `__tests__/client/client-target-extensions.test.ts`
- Create: `__tests__/client/media-pipeline.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Failing Tests for Error Hierarchy & Transport:**
   - Test mapping HTTP 401/403 $\rightarrow$ `BuildWithAkAuthError`.
   - Test mapping HTTP 409 $\rightarrow$ `BuildWithAkConflictError` with `code: 'STALE_REVISION'`.
   - Test mapping HTTP 422 $\rightarrow$ `BuildWithAkValidationError` with field details.
   - Test AbortSignal timeout cancellation.
2. **Step 2 — Implement Transport & Error Classes:**
   - Create `src/client/errors.ts` and `src/client/transport.ts`.
3. **Step 3 — Failing Tests for Base 11 Endpoints (Mock Server):**
   - Test all 11 base methods against mock server matching commit `500fe6ef`.
   - Test `updateListing` sends `expectedDraftRevisionId`.
4. **Step 4 — Implement Base Client Methods:**
   - Create `src/client/client.ts` implementing base methods.
5. **Step 5 — Failing Tests for Target Extension Endpoints:**
   - Test `listMediaAssets` and `checkSlugAvailability` with capability toggle on/off.
6. **Step 6 — Implement Target Extension Methods:**
   - Add target methods with graceful fallback/capability checks.
7. **Step 7 — Failing Tests for 2-Step Media Pipeline:**
   - Test intent generation $\rightarrow$ mock R2 PUT $\rightarrow$ finalize sequence.
   - Test that presigned PUT does NOT carry `x-api-key`.
   - Test oversized file or rejected MIME type fails gracefully.
8. **Step 8 — Implement Media Upload Pipeline:**
   - Create `src/media/upload.ts` with streaming upload and retry guards.
9. **Step 9 — Run & Verify Test Suite:**
   - Run `pnpm test:base __tests__/client/` to verify 100% pass.

## Success Criteria

- [ ] All 11 base endpoint methods and 2 target extension methods pass contract tests.
- [ ] Inbound OAuth tokens are strictly decoupled from upstream backend authentication.
- [ ] Media upload pipeline successfully uploads to R2 without leaking `x-api-key`.
- [ ] 100% of Phase 2 TDD unit tests pass.

## Risk Assessment

- **Risk:** Upstream `ak-web` changes error response JSON shape.
- *Mitigation:* Safe JSON error envelope extraction preserving status, code, and message with fallback.
