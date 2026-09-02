---
phase: 4
title: "CLI Commands Suite & Interactive Terminal Studio"
status: pending
priority: P1
effort: "6h"
dependencies: [0, 1, 2, 3]
---

# Phase 4: CLI Commands Suite & Interactive Terminal Studio

## Overview

Build the full developer CLI commands suite using Commander.js and the keyboard-driven Interactive Terminal Studio (TUI), providing intuitive commands for project initialization, template selection, real-time slug checking, media management, offline validation, diffing, local previewing, CAS-safe pushing, and frozen submission.

## Requirements

- **Functional:**
  - **CLI Commands Suite (`src/cli/commands/`):**
    - `build-with-ak init [--template <id>] [--env staging|production]`: Scaffold local workspace.
    - `build-with-ak template list`: List the 5 curated templates with descriptions and block sequences.
    - `build-with-ak template apply <id>`: Apply a template blueprint into the current draft.
    - `build-with-ak slug check <slug>`: Check real-time slug availability with alternative suggestions.
    - `build-with-ak media list [--kind <kind>]`: Query customer's own finalized asset library.
    - `build-with-ak media upload <file> --kind logo|cover|screenshot`: Execute 2-step R2 upload pipeline and output `assetId` UUID.
    - `build-with-ak pull [--out <file>]`: Pull remote listing and blocks into local workspace and sync revision baseline.
    - `build-with-ak validate [--ready] [--json]`: Validate local draft (default: permissive draft check; `--ready`: strict submission readiness check).
    - `build-with-ak diff [--json]`: Semantic local-vs-remote diff.
    - `build-with-ak preview [--watch] [--open] [--export <dir>] [--offline]`: Launch live preview server or export static HTML bundle.
    - `build-with-ak push [--yes] [--json]`: Atomic full-draft CAS push (`PUT /listing` with `expectedDraftRevisionId`).
    - `build-with-ak submit [--yes] [--json]`: Frozen submission (`POST /submit` with `{ listingId, expectedDraftRevisionId }`).
    - `build-with-ak studio`: Launch the full-screen interactive TUI studio.
  - **Interactive Terminal Studio (`src/studio/`):**
    - Four primary navigation views: Metadata Editor, Blocks Canvas (9 types, reorder, duplicate, delete), Media Library, and Review & Submit.
    - Status header: Environment, masked key (`ck_live_••••9f2a`), base revision, dirty indicator, validation errors count.
    - Keyboard navigation: Arrow keys/Tab, `a` (add block), `e` (edit), `d` (delete), `Alt+Up/Down` (reorder), `v` (validate), `p` (open preview), `u` (push), `s` (submit).
    - CAS conflict resolution modal: On 409 conflict, presents side-by-side diff with options: "Load Remote", "Keep Mine", or "Manual Reconcile".
  - **Machine-Readable Output (`--json`):**
    - Emits structured JSON envelope `{ ok: boolean, data?, error? }` on stdout.
    - Standardized exit codes: `0` (Success), `2` (Validation/Usage Error), `3` (Auth Error), `4` (Not Found), `5` (CAS Conflict), `6` (Network/Server Error).
    - All diagnostic logs and prompts go to stderr.
- **Non-functional:**
  - Fast cold-start ($< 150\text{ms}$ for non-studio commands).
  - Terminal-safe color formatting with automatic `--no-color` detection in non-TTY environments.

## Architecture

```text
[Terminal User / CI Pipeline]
       │
       ▼
[src/cli/main.ts] (Commander.js Dispatcher)
       │
       ├─► [Command Handlers (src/cli/commands/)]
       │     ├─► init, template, slug, media, pull
       │     ├─► validate (Draft vs Readiness Modes)
       │     ├─► preview (Live Watch / Static Export)
       │     ├─► push (Atomic CAS Single PUT)
       │     └─► submit (CAS Frozen Submit)
       │
       └─► [Interactive Terminal Studio (src/studio/)]
             ├─► TUI State Manager (Dirty tracking, in-memory undo)
             ├─► 4-Tab Screen Views (Listing, Blocks, Media, Review)
             └─► 409 CAS Conflict Resolution Dialog
```

## Related Code Files

- Create: `src/cli/main.ts`
- Create: `src/cli/output.ts`
- Create: `src/cli/exit-codes.ts`
- Create: `src/cli/commands/init.ts`
- Create: `src/cli/commands/template.ts`
- Create: `src/cli/commands/slug.ts`
- Create: `src/cli/commands/media.ts`
- Create: `src/cli/commands/pull.ts`
- Create: `src/cli/commands/validate.ts`
- Create: `src/cli/commands/diff.ts`
- Create: `src/cli/commands/preview.ts`
- Create: `src/cli/commands/push.ts`
- Create: `src/cli/commands/submit.ts`
- Create: `src/studio/app.tsx`
- Create: `src/studio/state.ts`
- Create: `src/studio/views/`
- Create: `__tests__/cli/commands.test.ts`
- Create: `__tests__/cli/studio.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Failing Tests for CLI Commands:**
   - Test `init --template` generates valid starter file.
   - Test `template list` and `template apply` functionality.
   - Test `slug check` calls mock endpoint and displays suggestions.
   - Test `media upload` runs 3-step pipeline and returns UUID.
   - Test `validate` in draft mode vs `--ready` mode.
   - Test `push` calls `PUT /listing` with `expectedDraftRevisionId`.
   - Test `submit` requires confirmation and sends `{ listingId, expectedDraftRevisionId }`.
2. **Step 2 — Implement CLI Command Handlers:**
   - Build all command modules under `src/cli/commands/` using Core Application Services.
   - Wire commands into `src/cli/main.ts`.
3. **Step 3 — Failing Tests for TUI Studio State:**
   - Test block insertion, reorder, property patching, and deletion.
   - Test 409 conflict handling displays conflict modal and pauses autosave.
4. **Step 4 — Implement Terminal Studio:**
   - Build `src/studio/state.ts` and view components in `src/studio/views/`.
5. **Step 5 — Run & Verify Test Suite:**
   - Run `pnpm test:base __tests__/cli/` to verify 100% pass.

## Success Criteria

- [ ] Every CLI command executes deterministically with structured `--json` output.
- [ ] Terminal studio allows keyboard-only drafting and visual layout composition.
- [ ] CAS 409 conflicts are gracefully handled without silent overwrites.
- [ ] 100% of Phase 4 TDD unit and CLI integration tests pass.

## Risk Assessment

- **Risk:** Terminal UI dependencies inflate binary size or slow down basic CLI commands like `validate`.
- *Mitigation:* Lazy-load the Studio component (`src/studio/`) dynamically only when `build-with-ak studio` is invoked.
