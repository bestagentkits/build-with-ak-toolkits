---
title: "Build with AK Toolkits — CLI Runtime, Dual-Transport MCP Server (stdio & Cloudflare Workers), Terminal Studio, Preview & Agent Skill"
description: "Comprehensive implementation plan for @agentkit/build-with-ak toolkits: TypeScript CLI, stdio & Streamable HTTP Cloudflare MCP server with OAuth 2.1 & X-API-Key, 5 layout templates, split validation, 2-step media upload, and Agent Skill."
status: completed
priority: P1
effort: "4-5 days"
tags: ["build-with-ak", "cli", "mcp", "cloudflare-workers", "oauth2.1", "templates", "terminal-studio", "preview", "agent-skill"]
created: 2026-09-02
---

# Build with AK Toolkits: CLI Runtime, Cloudflare MCP Server & Agent Skill

## Overview

Deliver the official public developer toolkit **`@agentkit/build-with-ak`** (or `build-with-ak-toolkits`) enabling developers and AI coding agents to create, validate, preview, customize layout blocks, and submit product showcases to the **"Build with AK"** Customer Directory on [agentkit.best/build-with-ak](https://agentkit.best/build-with-ak) (supporting both Staging and Production environments).

This toolkit provides:
1. **Contract Provenance & Upstream Dependency Gate (Phase 0)**: Two-tier contract lifecycle pinning the live/verified 11-endpoint base (commit `500fe6ef`) via machine-independent snapshot sync, while capability-gating target extensions from the pending Submission Studio plan under distinct test profiles (`test:base` vs `test:target`).
2. **Core Schemas & Split Validation (Phase 1)**: Imports verified wire schema `upsertListingDraftSchema`, establishes local permissive authoring schema `authoringDraftSchema` for in-progress drafting, implements local structural/content readiness validation (`submissionReadinessSchema`), and provides 5 pure template factory blueprints.
3. **Universal API Client & Upstream Delegation (Phase 2)**: Isomorphic client for all customer endpoints, establishing X-API-Key passthrough as the base remote lane and capability-gating OAuth-backed upstream delegation as an upstream dependency.
4. **Interactive CLI & Terminal Studio (Phases 3-4)**: Full command suite + TUI keyboard-driven control plane for metadata, 9 block types, and diffing.
5. **Local Loopback Browser Preview (Phase 3)**: Ephemeral port `127.0.0.1` HTML live-reloader via EventSource and offline static HTML export (`preview --export`).
6. **Dual-Transport MCP Server (Phase 5)**:
   - **Local stdio transport**: Embedded in npm binary for Cursor, Claude Desktop, Claude Code, OpenCode with local workspace tools.
   - **Cloudflare Workers Streamable HTTP transport**: Edge-deployed single-endpoint handler supporting both `application/json` and `text/event-stream` streamed responses, with dual authentication (**OAuth 2.1 Protected Resource Metadata (RFC 9728) & PKCE S256** + **`x-api-key: ck_live_...`**) and transport-neutral payload tools.
7. **Atomic CAS Draft Push & Frozen Submission**: Single-call `PUT /listing` CAS sync and frozen `POST /submit` with `expectedDraftRevisionId`.
8. **Companion Agent Skill & Documentation (Phase 6)**: Autonomous repository scanning, developer guides, and comprehensive test suite.

## Goals

| # | Goal | Priority |
|---|------|----------|
| 0 | **Contract Provenance & Upstream Dependency Gate:** Pin live 11-endpoint base (commit `500fe6ef`) via reproducible sync script and establish distinct `test:base` vs `test:target` profiles. | P1 |
| 1 | **Core Schemas, Contracts & 5 Template Factories:** 100% wire schema parity with `ak-web` backend (`upsertListingDraftSchema`, `blocks-schema.ts`, `constants.ts`), local permissive `authoringDraftSchema`, local readiness checks, and 5 pure template factories. | P1 |
| 2 | **Universal API Client, Upstream Delegation & Media Pipeline:** Isomorphic client for all customer endpoints, upstream credential delegation (decoupling inbound OAuth from backend requests), and atomic 2-step R2 media upload pipeline. | P1 |
| 3 | **Local Workspace Manager & Preview Engine:** Atomic `build-with-ak.json` manager, `.build-with-ak/state.json` CAS state, loopback EventSource browser preview server, and offline static HTML bundle exporter. | P1 |
| 4 | **CLI Commands Suite & Interactive Terminal Studio:** Complete Commander.js CLI (`init`, `template`, `slug`, `media`, `validate`, `diff`, `preview`, `push`, `submit`) + full TUI control plane. | P1 |
| 5 | **Stdio & Cloudflare Streamable HTTP MCP Server:** Transport-agnostic MCP Server Factory with standardized tools, resources, prompts, Node stdio adapter, and Cloudflare Worker entrypoint with `wrangler.jsonc` (RFC 9728). | P1 |
| 6 | **Companion Agent Skill, Documentation & 10-Layer Test Suite:** `skills/build-with-ak/SKILL.md`, developer guides (Quickstart, IDE setup, Cloudflare deploy, OAuth 2.1), and 100% green TDD test coverage. | P1 |

## Phases

| # | Phase | Status | Effort |
|---|-------|--------|--------|
| 0 | [Phase 0: Contract Provenance, Version Pinning & Upstream Dependency Gate](./phase-00-contract-provenance-and-upstream-dependency-gate.md) | Completed | 3h |
| 1 | [Phase 1: Core Schemas, Contracts & 5 Template Blueprints](./phase-01-core-schemas-contracts-and-templates.md) | Completed | 4h |
| 2 | [Phase 2: Universal API Client, Upstream Delegation & 2-Step Media Pipeline](./phase-02-universal-api-client-dual-auth-and-media.md) | Completed | 5h |
| 3 | [Phase 3: Local Workspace Manager & Preview Engine](./phase-03-local-workspace-and-preview-engine.md) | Completed | 5h |
| 4 | [Phase 4: CLI Commands Suite & Interactive Terminal Studio](./phase-04-cli-suite-and-terminal-studio.md) | Completed | 6h |
| 5 | [Phase 5: Stdio & Cloudflare Streamable HTTP MCP Server](./phase-05-stdio-and-cloudflare-mcp-server.md) | Completed | 6h |
| 6 | [Phase 6: Companion Agent Skill, Documentation & E2E Tests](./phase-06-companion-agent-skill-docs-and-e2e-tests.md) | Completed | 5h |

## Architecture & Data Flow

```text
[Developer / AI Coding Agent]
   │
   ├─► Local CLI / Studio (`build-with-ak`)
   │     ├─► Template Initialization (Minimalist, SaaS, DevTool, Visual, Case Study)
   │     ├─► Local Authoring Validation (authoringDraftSchema -> upsertListingDraftSchema)
   │     ├─► Local HTML Preview (127.0.0.1 loopback EventSource & offline static export)
   │     └─► Atomic CAS Push (PUT /api/build-with-ak/listing with expectedDraftRevisionId)
   │
   ├─► Local stdio MCP Server (`build-with-ak mcp`)
   │     └─► Cursor, Claude Code, OpenCode, Claude Desktop (Local IPC + Local Path Upload)
   │
   └─► Cloudflare Workers Streamable HTTP MCP Server (`wrangler.jsonc`)
         ├─► Inbound Dual Auth
         │     ├─► OAuth 2.1 Protected Resource Server (RFC 9728 / JWKS binding)
         │     └─► X-API-Key Header (ck_live_... from Customer Dashboard)
         └─► Streamable HTTP Transport (application/json and text/event-stream)
               │
               ▼
   [Core Application Services]
         ├─► Universal API Client (Fetch-based, 11 Base Endpoints + 2 Target Extensions)
         │     ├─► GET/PUT /listing (CAS atomic draft update)
         │     ├─► POST /listing/submit (Frozen submit with expectedDraftRevisionId)
         │     ├─► GET/PUT/POST/PATCH/DELETE/reorder /blocks (Granular block ops)
         │     ├─► GET /media (Target Extension: Customer finalized asset library query)
         │     └─► GET /slug-availability (Target Extension: Real-time slug checker & suggestions)
         │
         └─► Media Upload Pipeline
               ├─► POST /media/upload-intent ──► Direct Presigned PUT to R2 ──► POST /media/finalize
               └─► Returns Asset UUID (Strictly contained in all image-bearing block fields)
```

## Success Criteria

- [x] Exact contract snapshot committed with provenance SHA `500fe6ef` (Base Contract) and capability flags for Target Contract extensions.
- [x] 100% wire schema parity with `ak-web` backend (`upsertListingDraftSchema`, `blocks-schema.ts`, `constants.ts`).
- [x] All 5 layout templates instantiate unique, valid blocks with contiguous orders `0..N` and zero fake claims.
- [x] Offline `validate` clearly separates local in-progress draft saving from local structural/content readiness.
- [x] Local preview renders 9 block types truthfully on `127.0.0.1` and exports standalone offline HTML bundles.
- [x] Media upload completes all 3 steps (intent $\rightarrow$ R2 $\rightarrow$ finalize) and contains only asset UUIDs in block content.
- [x] `push` executes an atomic single-call `PUT /listing` with `expectedDraftRevisionId` CAS protection.
- [x] `submit` locks `submittedRevisionId` to prevent post-submission draft edits from altering the moderation target.
- [x] MCP Server passes modern MCP specification conformance via `stdio` and Cloudflare `Streamable HTTP` (supporting `application/json` and `text/event-stream`).
- [x] Cloudflare Worker deploys smoothly via Wrangler with OAuth 2.1 Protected Resource Metadata (RFC 9728) and X-API-Key authentication without filesystem dependencies.
- [x] Zero secret leaks (`CLOUDFLARE_ACCOUNT_ID`, `AGENTKIT_ENV`, `AGENTKIT_API_KEY`, `AGENTKIT_ADMIN_API_KEY`, `CLOUDFLARE_API_TOKEN`) across all logs, outputs, and artifacts.
- [x] 100% of base release requirements pass cleanly on `pnpm test:base`.
- [ ] Target extension requirements pass cleanly on `pnpm test:target` upon upstream `ak-web` deployment.

<!-- slug: build-with-ak-toolkits -->
