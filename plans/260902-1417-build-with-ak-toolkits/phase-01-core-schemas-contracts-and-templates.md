---
phase: 1
title: "Core Schemas, Contracts & 5 Template Blueprints"
status: completed
priority: P1
effort: "4h"
dependencies: [0]
---

# Phase 1: Core Schemas, Contracts & 5 Template Blueprints

## Overview

Establish the single source of truth for runtime validation, backend contracts, and layout templates, strictly gated by Phase 0 contract provenance. Export the exact wire Zod schemas (`upsertListingDraftSchema`), constants, and sanitize functions from the pinned `src/contracts/generated/` snapshot (commit `500fe6ef`), define the toolkit-local authoring schema (`authoringDraftSchema`) for in-progress drafting, implement local structural/content readiness validation (`submissionReadinessSchema`), and build the 5 pure template factory functions in `src/contracts/templates.ts`.

## Requirements

- **Functional:**
  - **Constants (`src/constants.ts`):** 8 categories (`developer_tools`, `ai_agents`, `saas`, `productivity`, `ecommerce`, `marketing_sales`, `education`, `other`), 9 block types, media limits (logo 2MB, cover 5MB, screenshot 5MB), MIME types (`image/png`, `image/jpeg`, `image/webp`), slug regex (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3-64 chars), and reserved slugs list.
  - **9 Block Schemas (`src/contracts/blocks.ts`):** `hero_banner`, `columns` (`two`|`three`|`bento`), `agentkit_story`, `tech_stack`, `screenshot_gallery`, `image_full`, `carousel_gallery`, `maker_quote`, `outbound_cta`. All media fields strictly require UUID `assetId`. All text fields enforce `safeText` (`UNSAFE` markup filter). `claimEvidence` required on quantitative claims.
  - **Sanitizer (`sanitizeBlocks`):** Drop malformed or unknown block types defensively.
  - **Schema Boundary Differentiation (`src/contracts/listing.ts`):**
    - `upsertListingDraftSchema` (Backend Wire Contract from commit `500fe6ef`): Strict wire validation enforced on all `PUT /listing` API payloads (requires name, valid slug, tagline $\ge 5$ chars, valid category, HTTPS websiteUrl, finalized logo UUID, and sanitized blocks array).
    - `authoringDraftSchema` (Toolkit-Local Permissive Schema): Permissive validation for local workspace editing (`build-with-ak.json` and TUI Studio) allowing empty/partial text fields and optional local `mediaRef` during early drafting. Note: Local drafts cannot be pushed to the base API until compiled into valid `upsertListingDraftSchema` wire format.
    - `submissionReadinessSchema` (Local Structural/Content Readiness): Pre-submission validation verifying local completeness (all required metadata present, tagline length, non-empty block content). Note: Local readiness does NOT prove server-authoritative state (asset ownership/finalization, global slug reservation, license eligibility, or revision freshness) — those remain server-authoritative checks during `submit`.
  - **5 Curated Layout Templates (`src/contracts/templates.ts`):**
    1. `minimalist_showcase`: (Hero Banner $\rightarrow$ AgentKit Story $\rightarrow$ Screenshot Gallery $\rightarrow$ Outbound CTA)
    2. `saas_product_launch`: (Hero Banner $\rightarrow$ Bento Columns $\rightarrow$ Screenshot Gallery $\rightarrow$ Maker Quote $\rightarrow$ Tech Stack $\rightarrow$ Outbound CTA)
    3. `devtool_open_source`: (Hero Banner $\rightarrow$ AgentKit Story $\rightarrow$ Tech Stack $\rightarrow$ 2 Columns $\rightarrow$ Screenshot Gallery $\rightarrow$ Outbound CTA)
    4. `visual_media_app`: (Hero Banner $\rightarrow$ Screenshot Gallery $\rightarrow$ Bento Columns $\rightarrow$ Maker Quote $\rightarrow$ Outbound CTA)
    5. `comprehensive_case_study`: (Hero Banner $\rightarrow$ AgentKit Story $\rightarrow$ 2 Columns $\rightarrow$ Tech Stack $\rightarrow$ Screenshot Gallery $\rightarrow$ Maker Quote $\rightarrow$ Outbound CTA)
  - **Template Factory (`instantiateTemplate`):** Pure function generating schema-valid blocks with unique IDs (`crypto.randomUUID()`), contiguous sequential `order` values (`0..N`), seeded from real metadata (zero fabricated testimonials or fake metrics).
- **Non-functional:**
  - Zero runtime dependencies outside Zod.
  - 100% type inference compatibility across Node.js and Cloudflare Workers runtime.
  - Strictly blocked until Phase 0 generates the verified `src/contracts/generated/` snapshot.

## Architecture

```text
[Phase 0: Verified Snapshot (src/contracts/generated/)] (commit 500fe6ef)
       │
       ▼
[src/contracts/]
       ├─► constants.ts (Categories, Media Limits, Slugs, Statuses)
       ├─► blocks.ts (9 Block Schemas, safeText, sanitizeBlocks)
       ├─► listing.ts (upsertListingDraftSchema, authoringDraftSchema, submissionReadinessSchema)
       ├─► media.ts (uploadIntentSchema, finalizeSchema)
       └─► templates.ts (BUILD_WITH_AK_TEMPLATES & instantiateTemplate)
```

## Related Code Files

- Create: `src/constants.ts`
- Create: `src/contracts/blocks.ts`
- Create: `src/contracts/listing.ts`
- Create: `src/contracts/media.ts`
- Create: `src/contracts/templates.ts`
- Create: `src/contracts/index.ts`
- Create: `__tests__/contracts/blocks-schema.test.ts`
- Create: `__tests__/contracts/listing-validation.test.ts`
- Create: `__tests__/contracts/templates.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Failing Tests for Block Schemas & Sanitizer:**
   - Test all 9 block schemas against valid fixtures from Phase 0 snapshot.
   - Test `safeText` rejection of `<script>`, `<iframe>`, `javascript:`, `data:text/html`, and inline event handlers.
   - Test `sanitizeBlocks` drops malformed blocks while preserving valid ones.
   - Test duplicate block ID rejection.
2. **Step 2 — Implement Block Schemas & Constants:**
   - Create `src/constants.ts` with categories, slug rules, media limits.
   - Create `src/contracts/blocks.ts` with discriminated union `blockContentSchema`, `blockSchema`, `blocksSchema`.
3. **Step 3 — Failing Tests for Authoring vs Wire Schemas:**
   - Test `authoringDraftSchema` allows in-progress drafts with empty optional fields and local media references.
   - Test `upsertListingDraftSchema` strictly enforces wire format requirements before network transmission.
   - Test `submissionReadinessSchema` asserts local structural/content readiness.
4. **Step 4 — Implement Listing & Media Schemas:**
   - Create `src/contracts/listing.ts` exporting `upsertListingDraftSchema`, `authoringDraftSchema`, and `submissionReadinessSchema`.
   - Create `src/contracts/media.ts` exporting `uploadIntentBodySchema` and `finalizeBodySchema`.
5. **Step 5 — Failing Tests for Template Blueprints & Factory:**
   - Test all 5 templates exist in `BUILD_WITH_AK_TEMPLATES`.
   - Test `instantiateTemplate` produces 100% valid `blocksSchema` output.
   - Test block IDs are unique and orders are contiguous `0..N`.
   - Test seeding inherits real name and tagline.
6. **Step 6 — Implement Template Blueprints & Factory:**
   - Create `src/contracts/templates.ts` with `instantiateTemplate(templateId, metadata)`.
7. **Step 7 — Run & Verify Test Suite:**
   - Run `pnpm test:base __tests__/contracts/` to verify 100% pass.

## Success Criteria

- [ ] All 9 block types validate and round-trip successfully.
- [ ] Wire schema strictly matches `ak-web` commit `500fe6ef`, while authoring schema facilitates local editing.
- [ ] `submissionReadinessSchema` verifies local structural/content readiness without overclaiming server state.
- [ ] All 5 template blueprints instantiate valid blocks without fake data.
- [ ] 100% of Phase 1 TDD unit tests pass.

## Risk Assessment

- **Risk:** Divergence between toolkit schemas and live `ak-web` backend.
- *Mitigation:* Gated by Phase 0 provenance verification; zero manual schema drift.
