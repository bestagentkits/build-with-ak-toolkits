---
phase: 6
title: "Companion Agent Skill, Documentation & E2E Tests"
status: completed
priority: P1
effort: "5h"
dependencies: [0, 1, 2, 3, 4, 5]
---

# Phase 6: Companion Agent Skill, Documentation & E2E Tests

## Overview

Deliver the official Companion Agent Skill (`skills/build-with-ak/`), publish comprehensive developer documentation and AI tool integration guides, build the automated end-to-end integration test suite against staging fixtures (separating `test:base` from `test:target`), and package the final npm bundle `@agentkit/build-with-ak`.

## Requirements

- **Functional:**
  - **Companion Agent Skill (`skills/build-with-ak/`):**
    - `SKILL.md`: Main instructions ($< 300$ lines) for AI coding agents. Teaches agents how to inspect local repos, extract product evidence (manifests, README, git tags, screenshot assets), select the best layout template out of 5 templates, draft `build-with-ak.json`, validate offline, upload media, preview, and request explicit developer approval before frozen submission.
    - `references/block-catalog.md`: Comprehensive field reference for all 9 block layouts.
    - `references/workflows.md`: Step-by-step guidance for new showcase creation vs layout refresh.
    - `references/troubleshooting.md`: Conflict recovery and CAS 409 error resolution.
  - **Developer Documentation (`docs/` & `README.md`):**
    - `README.md`: Modern quickstart replacing stale `ak-showcase` and `auth login` text with API key config and fast commands.
    - `docs/quickstart.md`: 5-minute guide from generating API key to publishing.
    - `docs/cli-reference.md`: Detailed flags, options, exit codes for all CLI commands.
    - `docs/mcp-setup.md`: Setup guides for Claude Desktop, Cursor, OpenCode, Windsurf, Claude Code (stdio + Cloudflare Streamable HTTP remote URL).
    - `docs/cloudflare-deployment.md`: Guide to deploying the Streamable HTTP MCP server on Cloudflare Workers with Wrangler.
    - `docs/oauth-configuration.md`: OAuth 2.1 Protected Resource Metadata (RFC 9728) & PKCE configuration with AgentKit.
    - `docs/block-schemas.md`: Specification of all 9 block layouts with copyable examples.
  - **10-Layer Test Suite & Staging E2E:**
    - Full contract and schema validation tests.
    - Universal client mock tests covering all 11 base endpoints + 2 target extension endpoints.
    - 2-step media upload integration tests.
    - Atomic CAS push and frozen submission concurrency tests.
    - CLI commands execution tests with `--json` snapshots.
    - MCP stdio conformance test using official SDK client inspector.
    - Cloudflare Streamable HTTP transport integration tests supporting `application/json` and `text/event-stream` responses with Protected Resource Metadata (RFC 9728) verification.
    - Preview renderer HTML fidelity and CSP security tests.
    - Agent Skill prompt evaluation scenarios.
    - Staging live integration test suite: `pnpm test:base` (strictly 100% green against base 11 endpoints) and `pnpm test:target` (runs target endpoints when upstream commit exists).
  - **npm Package Distribution:**
    - Executable `build-with-ak` registered in `package.json` `"bin"`.
    - Clean TypeScript ESM/CJS build artifacts with tree-shaking.
    - Zero secret leakage in npm tarball.
- **Non-functional:**
  - 100% test coverage across core contracts and services.
  - All documentation formatted with clean GitHub-flavored Markdown.

## Architecture

```text
[Developer Documentation (docs/ & README.md)]
       │
[Companion Agent Skill (skills/build-with-ak/)]
       │
       ▼
[Autonomous AI Agent (Claude Code / OpenCode / Cursor)]
       │
       ├──► 1. Inspect Repo (README, package.json, assets)
       ├──► 2. Select Template (instantiateTemplate)
       ├──► 3. Validate Draft (validate_listing)
       ├──► 4. Upload Assets (upload_media -> asset UUID)
       ├──► 5. Push Draft (update_listing with CAS)
       └──► 6. Request Approval -> Submit (submit_listing with freeze)
```

## Related Code Files

- Create: `skills/build-with-ak/SKILL.md`
- Create: `skills/build-with-ak/references/block-catalog.md`
- Create: `skills/build-with-ak/references/workflows.md`
- Create: `skills/build-with-ak/references/troubleshooting.md`
- Modify: `README.md`
- Create: `docs/quickstart.md`
- Create: `docs/cli-reference.md`
- Create: `docs/mcp-setup.md`
- Create: `docs/cloudflare-deployment.md`
- Create: `docs/oauth-configuration.md`
- Create: `docs/block-schemas.md`
- Create: `docs/media-guide.md`
- Create: `__tests__/e2e/staging-integration.test.ts`
- Create: `__tests__/e2e/npm-package-smoke.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Write Skill Scenario Evals:**
   - Create test scenarios validating Agent Skill instructions against sample repo fixtures.
   - Verify agent never outputs fake testimonials or unfinalized asset URLs.
2. **Step 2 — Implement Agent Skill:**
   - Build `skills/build-with-ak/SKILL.md` and reference documents.
3. **Step 3 — Write Complete Documentation:**
   - Update root `README.md`.
   - Build all guides in `docs/` (Quickstart, CLI, MCP Setup, Cloudflare Deployment, OAuth 2.1, Block Schemas).
4. **Step 4 — Build Staging E2E & Concurrency Test Suite:**
   - Build `__tests__/e2e/staging-integration.test.ts` covering the complete base lifecycle: `init` $\rightarrow$ `validate` $\rightarrow$ `media upload` $\rightarrow$ `push CAS` $\rightarrow$ `submit`.
5. **Step 5 — npm Package Build & Smoke Test:**
   - Configure `package.json` build scripts (`pnpm build`, `pnpm pack`).
   - Run `npm-package-smoke.test.ts` testing the packed `.tgz` binary execution.
6. **Step 6 — Run Full Test Suite:**
   - Run `pnpm test:base` ensuring 100% green status across all base test layers.

## Success Criteria

- [ ] Agent Skill enables autonomous showcase creation with zero manual JSON typing.
- [ ] Documentation covers CLI, MCP, Cloudflare deployment, and OAuth 2.1 thoroughly.
- [ ] Full E2E lifecycle test passes seamlessly against staging contracts via `pnpm test:base`.
- [ ] Packed npm tarball executes cleanly on Node.js without missing dependencies.
- [ ] 100% of Phase 6 TDD tests pass.

## Risk Assessment

- **Risk:** Sensitive environment variables included in published npm tarball.
- *Mitigation:* Explicit `files` whitelist in `package.json` (`dist/`, `bin/`, `skills/`, `README.md`, `LICENSE`), ignoring `.env*` and test files.
