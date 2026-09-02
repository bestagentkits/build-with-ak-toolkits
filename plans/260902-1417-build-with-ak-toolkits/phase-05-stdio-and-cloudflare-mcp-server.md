---
phase: 5
title: "Stdio & Cloudflare Streamable HTTP MCP Server"
status: completed
priority: P1
effort: "6h"
dependencies: [0, 1, 2, 3]
---

# Phase 5: Stdio & Cloudflare Streamable HTTP MCP Server

## Overview

Build the Model Context Protocol (MCP) server architecture providing a transport-agnostic MCP Server Factory with standardized tools, schema resources, and prompt templates. Deliver two explicit runtime adapters:
1. **Local Node.js `stdio` Adapter (`src/mcp/stdio.ts`):** Embedded in the npm binary for local IDE agents (Cursor, Claude Desktop, Claude Code, OpenCode) with local workspace tools and local file paths.
2. **Cloudflare Workers `Streamable HTTP` Adapter (`src/worker.ts` & `wrangler.jsonc`):** Edge-deployed over the official MCP Streamable HTTP transport (supporting both `application/json` and `text/event-stream` single-endpoint streamed responses) with dual authentication (**OAuth 2.1 Protected Resource Metadata (RFC 9728) & PKCE** and **`x-api-key` headers**), payload-based tools, and zero filesystem dependency.

## Requirements

- **Functional:**
  - **Transport-Agnostic MCP Server Factory (`src/mcp/factory.ts`):**
    - Creates standard MCP Server instance using `@modelcontextprotocol/sdk`.
    - Dependency-injected application services (zero transport coupling).
  - **Standardized MCP Tools Suite (`src/mcp/tools.ts`):**
    - Universal Core Tools (Both stdio and Cloudflare Worker):
      1. `build_with_ak_get_listing`: Read remote listing & draft revision metadata.
      2. `build_with_ak_update_listing`: Atomic full-draft CAS save (`PUT /listing` with `expectedDraftRevisionId`).
      3. `build_with_ak_submit_listing`: Frozen submission (`POST /submit` with `{ listingId, expectedDraftRevisionId? }`).
      4. `build_with_ak_validate_listing`: Validates draft and returns `{ isDraftValid, isSubmissionReady, errors }`.
      5. `build_with_ak_list_templates`: Return all 5 layout template blueprints.
      6. `build_with_ak_apply_template`: Apply a template to draft with fresh unique block IDs.
      7. `build_with_ak_check_slug_availability`: Real-time slug validation and alternative suggestions (gated by target capability).
      8. `build_with_ak_list_media_assets`: Query customer's finalized asset library by `kind` (gated by target capability).
      9. `build_with_ak_get_blocks`: Read current draft blocks.
      10. `build_with_ak_patch_block`: Quick-edit individual block content or order.
      11. `build_with_ak_reorder_blocks`: Reorder block IDs sequence.
    - Media Upload Tools (Transport-Gated):
      * `build_with_ak_upload_media_file` (stdio only): Accepts local workspace path (`./assets/logo.png`), reads from disk, and runs 2-step upload.
      * `build_with_ak_upload_media_payload` (Cloudflare Worker & stdio): Accepts bounded base64 binary payload `{ filename, kind, mimeType, base64Content }` for remote clients.
  - **MCP Resources (`src/mcp/resources.ts`):**
    - Universal Resources (Both transports):
      * `build-with-ak://schemas/listing`: JSON Schema for listing metadata.
      * `build-with-ak://schemas/blocks`: JSON Schema for 9 block types.
      * `build-with-ak://templates/catalog`: 5 template blueprints.
      * `build-with-ak://remote/listing`: Authenticated remote listing snapshot.
    - Local-Only Resources (stdio only):
      * `build-with-ak://workspace/draft`: Current local `build-with-ak.json` file content.
  - **MCP Prompts (`src/mcp/prompts.ts`):**
    - `draft_product_showcase`: Guide AI in interviewing developer and seeding template.
    - `curate_layout_blocks`: Optimize block sequence and verify quantitative claim evidence.
    - `prepare_submission`: Validate readiness, resolve media UUIDs, and request explicit submission approval.
  - **Cloudflare Worker Dual-Auth & Streamable HTTP Engine (`src/auth/` & `src/worker.ts`):**
    - **Streamable HTTP Conformance:**
      * Implements single-endpoint Streamable HTTP handler on `/mcp` (or `/`).
      * Supports both standard `application/json` responses and streamed `text/event-stream` responses for incremental progress/notifications.
      * Forbids deprecated legacy separate `/sse` endpoint and stateful session storage.
    - **OAuth 2.1 Protected Resource Metadata (RFC 9728 / MCP OAuth Spec):**
      * The Worker acts as the **MCP Resource Server (RS)** and exposes Protected Resource Metadata at `GET /.well-known/oauth-protected-resource`.
      * Metadata declares:
        ```json
        {
          "resource": "https://<worker-domain>",
          "authorization_servers": ["https://agentkit.best"],
          "scopes_supported": ["build-with-ak:read", "build-with-ak:write"]
        }
        ```
      * On unauthenticated requests, responds with `401 Unauthorized` and header:
        `WWW-Authenticate: Bearer resource_metadata="https://<worker-domain>/.well-known/oauth-protected-resource"`
      * Validates incoming Bearer token: verifies `iss` (AgentKit AS), `aud` (Worker resource URI), `exp`, and cryptographic signature via AgentKit JWKS.
    - **X-API-Key Compatibility Lane:**
      * Validates incoming `x-api-key: ck_live_...` (or `X-API-Key`) header against AgentKit key authority.
      * Upstream delegation: forwards authenticated requests upstream to `ak-web`.
- **Non-functional:**
  - Zero deprecated legacy separate `/sse` endpoint architecture.
  - Zero Node-only `fs` / `child_process` imports in `src/worker.ts`.
  - Zero secret leakage: `AGENTKIT_ADMIN_API_KEY` is strictly excluded from Worker bindings.

## Architecture

```text
               ┌──────────────────────────────────────────────┐
               │    src/mcp/factory.ts (createMcpServer)      │
               │  Standard Tools, Resources, Prompts Registry │
               └──────────────────────┬───────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 │                                         │
       ┌─────────▼─────────┐                     ┌─────────▼─────────┐
       │  src/mcp/stdio.ts │                     │   src/worker.ts   │
       │  (Node.js stdio)  │                     │ (Cloudflare Edge) │
       └─────────┬─────────┘                     └─────────┬─────────┘
                 │                                         │
        Local IDE Agents                       Streamable HTTP Transport
   (Cursor, Claude Desktop)                  ┌───────────────────────────┐
   - Local Path Upload                       │ Inbound Auth:             │
   - Workspace draft resource                │ - OAuth 2.1 (RFC 9728)    │
                                             │   (Bearer + JWKS binding) │
                                             │ - X-API-Key Header        │
                                             │ Responses:                │
                                             │ - application/json        │
                                             │ - text/event-stream (MCP) │
                                             │ Payload-based tools only  │
                                             └───────────────────────────┘
```

## Related Code Files

- Create: `src/mcp/factory.ts`
- Create: `src/mcp/tools.ts`
- Create: `src/mcp/resources.ts`
- Create: `src/mcp/prompts.ts`
- Create: `src/mcp/stdio.ts`
- Create: `src/auth/oauth-worker.ts`
- Create: `src/auth/api-key-worker.ts`
- Create: `src/worker.ts`
- Create: `wrangler.jsonc`
- Create: `__tests__/mcp/tools.test.ts`
- Create: `__tests__/mcp/stdio-conformance.test.ts`
- Create: `__tests__/mcp/worker-streamable-http.test.ts`

## Implementation Steps (TDD)

1. **Step 1 — Failing Tests for MCP Tool Implementations:**
   - Test all tools against mock client services.
   - Test `upload_media_file` vs `upload_media_payload`.
   - Test `validate_listing` returns split draft/readiness flags.
   - Test `submit_listing` requires `listingId` and optional `expectedDraftRevisionId`.
2. **Step 2 — Implement MCP Tools, Resources & Prompts:**
   - Build `src/mcp/tools.ts`, `src/mcp/resources.ts`, `src/mcp/prompts.ts`, and `src/mcp/factory.ts`.
3. **Step 3 — Failing Tests for stdio Transport:**
   - Test stdio server handshake, tool listing, and tool invocation.
   - Verify zero non-protocol characters on stdout.
4. **Step 4 — Implement stdio Entrypoint:**
   - Build `src/mcp/stdio.ts`.
5. **Step 5 — Failing Tests for Cloudflare Worker Streamable HTTP & Dual Auth:**
   - Test Streamable HTTP `application/json` request/response flow.
   - Test Streamable HTTP `text/event-stream` streaming responses.
   - Test Protected Resource Metadata endpoint `GET /.well-known/oauth-protected-resource` per RFC 9728.
   - Test 401 challenge with `WWW-Authenticate: Bearer resource_metadata="..."`.
   - Test OAuth 2.1 Bearer token validation with issuer, audience, and JWKS verification.
   - Test `x-api-key` header validation and execution.
   - Test that filesystem-dependent tools fail cleanly with capability advice on remote Worker.
6. **Step 6 — Implement Cloudflare Worker Entrypoint & Wrangler Config:**
   - Build `src/auth/oauth-worker.ts`, `src/auth/api-key-worker.ts`, `src/worker.ts`, and `wrangler.jsonc`.
7. **Step 7 — Run & Verify Test Suite:**
   - Run `pnpm test:base __tests__/mcp/` to verify 100% pass.

## Success Criteria

- [ ] All universal and transport-gated MCP tools execute accurately.
- [ ] Stdio server integrates seamlessly with Cursor and Claude Desktop.
- [ ] Cloudflare Worker handles Streamable HTTP requests supporting both `application/json` and `text/event-stream` responses with OAuth 2.1 Protected Resource Metadata (RFC 9728) and X-API-Key auth.
- [ ] Zero deprecated legacy separate `/sse` endpoint architecture.
- [ ] 100% of Phase 5 TDD unit and MCP conformance tests pass.

## Risk Assessment

- **Risk:** Large base64 image payloads exhaust Cloudflare Worker memory limits.
- *Mitigation:* Enforce strict size check ($< 5\text{MB}$) on `upload_media_payload` before decoding binary buffers.
