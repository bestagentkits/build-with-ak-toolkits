---
phase: 3
title: "Local Workspace Manager & Preview Engine"
status: completed
priority: P1
effort: "5h"
dependencies: [0, 1, 2]
---

# Phase 3: Local Workspace Manager & Preview Engine

## Overview

Build the local workspace manager responsible for atomic reads/writes of `build-with-ak.json`, CAS synchronization state in `.build-with-ak/state.json`, and the local HTML preview engine providing both an in-process loopback browser preview server (`127.0.0.1:<ephemeral>` with EventSource hot-reload) and an offline static HTML bundle exporter (`preview --export`).

## Requirements

- **Functional:**
  - **Local Workspace Store (`src/project/project-store.ts`):**
    - Manages `build-with-ak.json` (authoring document) with `$schema`, `schemaVersion: 1`, `environment: 'staging' | 'production'`, `listing`, `blocks`, and local `media` references.
    - Manages `.build-with-ak/state.json` containing last pulled `listingId`, `baseDraftRevisionId`, content digests, and ensures `.build-with-ak/` is added to `.gitignore`.
    - Implements atomic writes via temporary sibling file + rename to eliminate corrupted or half-written JSON files.
  - **Authoring Model & Compiler (`src/project/compiler.ts`):**
    - Authoring model permits local image references (e.g. `{ mediaRef: 'hero' }` pointing to `./assets/hero.png`).
    - Preview compiler resolves `mediaRef` to local file paths/blobs for instant offline visual review.
    - Wire compiler resolves `mediaRef` to finalized `assetId` UUIDs and compiles the payload into the exact `upsertListingDraftSchema` wire shape.
  - **Diff & Sync Service (`src/project/sync.ts`):**
    - Computes semantic diff between local workspace and remote draft.
    - Executes atomic CAS push: fetches current remote draft, checks `draftRevisionId === baseDraftRevisionId` (throws `CASConflictError` on mismatch), and PUTs the complete draft in a single atomic request.
  - **Local HTML Preview Engine (`src/preview/`):**
    - `render-document.ts`: Server-side HTML builder for product masthead and all 9 block layouts, respecting design guidelines (`docs/design-guidelines.md` tokens, Geist font, dark-first styling).
    - `server.ts`: Ephemeral port loopback HTTP server bound exclusively to `127.0.0.1`. Serves rendered HTML and local assets. Emits EventSource `draft-changed` events on local file saves.
    - `export.ts`: Exports standalone `index.html` plus content-addressed local assets into a specified directory (`--export <dir> --offline`), with strict CSP preventing external network calls.
- **Non-functional:**
  - Zero arbitrary code execution (pure JSON authoring model).
  - Preview server must never bind to public interfaces (`0.0.0.0` or LAN).
  - HTML escaping on all user-supplied text strings to prevent XSS.

## Architecture

```text
[Authoring Workspace]
       │
       ├─► build-with-ak.json (Authoring Model with mediaRef)
       └─► .build-with-ak/state.json (baseDraftRevisionId, digests - gitignored)
              │
              ▼
       [Authoring Compiler (src/project/compiler.ts)]
              │
              ├─► Preview Mode ──► Resolves local file paths ──► [Preview Renderer / 127.0.0.1 Server]
              │
              └─► Wire Mode ────► Resolves finalized asset UUIDs ──► [CAS Sync Service (PUT /listing)]
```

## Related Code Files

- Create: `src/project/authoring-schema.ts`
- Create: `src/project/project-store.ts`
- Create: `src/project/compiler.ts`
- Create: `src/project/diff.ts`
- Create: `src/project/sync.ts`
- Create: `src/preview/render-document.ts`
- Create: `src/preview/render-blocks.ts`
- Create: `src/preview/server.ts`
- Create: `src/preview/export.ts`
- Create: `__tests__/project/project-store.test.ts`
- Create: `__tests__/project/compiler.test.ts`
- Create: `__tests__/project/preview-renderer.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Failing Tests for Workspace Store & Atomic Write:**
   - Test `init` creates `build-with-ak.json` and `.build-with-ak/state.json`.
   - Test `.gitignore` auto-updates to ignore `.build-with-ak/`.
   - Test atomic write survives process interruption without file corruption.
2. **Step 2 — Implement Project Store:**
   - Create `src/project/authoring-schema.ts` and `src/project/project-store.ts`.
3. **Step 3 — Failing Tests for Authoring Compiler:**
   - Test compilation to preview model (local image paths preserved).
   - Test compilation to wire model (fails if mediaRef has no finalized assetId; emits exact `upsertListingDraftSchema`).
4. **Step 4 — Implement Compiler & Diff Service:**
   - Create `src/project/compiler.ts`, `src/project/diff.ts`, and `src/project/sync.ts`.
5. **Step 5 — Failing Tests for Preview Renderer & Security:**
   - Test rendering all 9 block types into semantic, responsive HTML.
   - Test text escaping (rejects script injection, malicious iframes).
   - Test static export produces standalone directory bundle with strict CSP.
6. **Step 6 — Implement Preview Server & Export:**
   - Create `src/preview/render-document.ts`, `src/preview/render-blocks.ts`, `src/preview/server.ts`, and `src/preview/export.ts`.
7. **Step 7 — Run & Verify Test Suite:**
   - Run `pnpm test:base __tests__/project/` to verify 100% pass.

## Success Criteria

- [ ] Project store reads and writes `build-with-ak.json` atomically.
- [ ] Compiler translates authoring format into wire format with 100% schema compliance.
- [ ] Preview server renders all 9 block types accurately on `127.0.0.1` with EventSource reload.
- [ ] Offline export bundle opens directly from disk with zero external network dependencies.
- [ ] 100% of Phase 3 TDD unit tests pass.

## Risk Assessment

- **Risk:** Local preview port collisions on developer machines.
- *Mitigation:* Bind to port `0` (OS-assigned ephemeral port) and print the resolved localhost URL.
