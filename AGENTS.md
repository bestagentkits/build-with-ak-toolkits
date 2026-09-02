# AGENTS.md

Imperative guidance and invariants for AI agents working in `bestagentkits/build-with-ak-toolkits`.

## Core Invariants & Boundaries

- **Package Namespace**: `@bestagentkits/build-with-ak` (binaries: `build-with-ak`, `build-with-ak-mcp`).
- **Contract Provenance**: Upstream base contract pinned at commit `500fe6ef`. Never edit `src/contracts/generated/` manually; use `pnpm sync:contracts` and verify with `pnpm check:drift`.
- **Worker & MCP Edge Safety**: `src/worker.ts` and Cloudflare HTTP transport (`src/mcp/http-services.ts`, `src/auth/`) must remain 100% filesystem-free (`node:fs` prohibited in Worker bundle).
- **Media Contract**: Image block content must strictly contain finalized `assetId` UUIDs, never raw presigned URLs or local paths.
- **CAS Atomic Sync**: Draft updates (`push`) must use `PUT /listing` with `expectedDraftRevisionId`. Moderate submissions (`submit`) are frozen and lock revision ID.
- **Dual Test Profiles**: Run `pnpm test:base` for base 11-endpoint contract checks; `pnpm test:target` includes pending target extensions.

## Quality Gates & Verification Commands

Run before reporting completion or submitting changes:

```bash
pnpm typecheck      # TypeScript compilation check (tsc --noEmit)
pnpm check:drift    # Contract snapshot verification against pinned commit
pnpm test:base      # Base contract test suite (vitest)
pnpm test:target    # Full test suite including target extensions
pnpm build          # Multi-target bundle generation (tsup)
```

## Tooling & Workflow Conventions

- **Package Manager**: Use `pnpm` exclusively for local development and dependency management.
- **Git Commits**: Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `ci:`).
- **Secrets & Safety**: Never commit `.env`, `AGENTKIT_API_KEY`, `CLOUDFLARE_API_TOKEN`, or private keys.
