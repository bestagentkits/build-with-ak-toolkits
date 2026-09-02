---
phase: 0
title: "Contract Provenance, Version Pinning & Upstream Dependency Gate"
status: completed
priority: P1
effort: "3h"
dependencies: []
---

# Phase 0: Contract Provenance, Version Pinning & Upstream Dependency Gate

## Overview

Establish the formal contract provenance baselines between `ak-web` and `build-with-ak-toolkits` in a machine-independent, reproducible way. Define the exact two-tier contract lifecycle:
1. **Base Contract (Live / Verified):** Anchored on Git commit `500fe6ef7a7974acf235c84ad0ebb2f28fb5747c` from `bestagentkits/ak-web`, covering 11 customer endpoints, 9 block types, and atomic CAS draft `PUT /listing`.
2. **Target Contract (Upstream Pending):** Anchored on the pending Submission Studio plan (`plans/260902-1354-build-with-ak-submission-studio`), adding `GET /media`, `GET /slug-availability`, and frozen `POST /submit` with `expectedDraftRevisionId`.

This phase provides a reproducible contract synchronization script (fetching from Git remote or optional local override), generates immutable contract snapshots, and establishes distinct CI test profiles (`test:base` vs `test:target`).

## Requirements

- **Functional:**
  - **Machine-Independent Contract Sync (`scripts/sync-contracts.ts`):**
    - Fetches/archives the pinned commit `500fe6ef7a7974acf235c84ad0ebb2f28fb5747c` via `git archive` / GitHub raw fetch without hardcoded local absolute paths.
    - Supports optional `--local-checkout <path>` flag for local development overrides.
    - Verifies Git commit SHA and SHA-256 content digest before writing generated snapshot files into `src/contracts/generated/`.
    - Generates `src/contracts/provenance.ts` declaring committed SHA, snapshot timestamp, and schema digests.
  - **Two-Tier Test Profiles (`package.json`):**
    - `pnpm test:base`: Runs full unit, client, CLI, MCP, and staging integration suites strictly against the verified 11-endpoint Base Contract. Must achieve 100% green without skipping tests.
    - `pnpm test:target`: Dedicated test profile requiring an explicit target `ak-web` commit SHA or staging target deployment; fails fast if target endpoints are absent rather than silently passing via skipped tests.
  - **CI Drift Verification Script (`scripts/check-contract-drift.ts`):**
    - Runs in CI to verify committed `src/contracts/generated/` matches the pinned commit snapshot byte-for-byte.
- **Non-functional:**
  - Zero hardcoded local machine paths.
  - Strict provenance verification before any downstream phase execution.

## Architecture

```text
[Remote Repository: bestagentkits/ak-web]
   │ (Pinned Commit: 500fe6ef7a7974acf235c84ad0ebb2f28fb5747c)
   ▼
[scripts/sync-contracts.ts] (Fetch + Digest Verification)
   │
   ├─► src/contracts/generated/ (Committed TypeScript Zod Snapshot)
   └─► src/contracts/provenance.ts (SHA, Timestamp, Digest)
         │
         ├──► pnpm test:base   ──► Validates 100% of Base Contract (11 Endpoints)
         └──► pnpm test:target ──► Validates Target Contract Extensions (13 Endpoints)
```

## Related Code Files

- Create: `scripts/sync-contracts.ts`
- Create: `scripts/check-contract-drift.ts`
- Create: `src/contracts/provenance.ts`
- Create: `__tests__/contracts/provenance-drift.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Write Failing Provenance Drift Test:**
   - Create `__tests__/contracts/provenance-drift.test.ts` asserting committed contract hash matches snapshot generator output.
2. **Step 2 — Implement Machine-Independent Sync Script:**
   - Create `scripts/sync-contracts.ts` with Git remote archive fetch and optional `--local-checkout` argument.
   - Extract `blocks-schema.ts`, `constants.ts`, and `validation.ts` from commit `500fe6ef7a7974acf235c84ad0ebb2f28fb5747c`.
   - Write immutable snapshot files into `src/contracts/generated/`.
3. **Step 3 — Configure Base vs Target Test Profiles:**
   - Configure `test:base` and `test:target` scripts in `package.json`.
4. **Step 4 — Run & Verify Tests:**
   - Run `pnpm test:base` and verify provenance validation passes 100%.

## Success Criteria

- [ ] `sync-contracts.ts` runs on any machine without hardcoded paths.
- [ ] Pinned commit SHA `500fe6ef7a7974acf235c84ad0ebb2f28fb5747c` snapshot is committed with valid checksum.
- [ ] `pnpm test:base` profile executes and passes 100% on the base contract without skipped tests.
- [ ] CI drift check passes deterministically.

## Risk Assessment

- **Risk:** Network unavailability during contract sync.
- *Mitigation:* Snapshot is committed directly to source control; `sync-contracts.ts` is run only during intentional contract upgrades.
