---
title: "Agent Skill Marketplace Compatibility — skills.sh, Claude Plugins & ChatGPT Custom Actions"
description: "Ensure @bestagentkits/build-with-ak agent skill and MCP server are 100% compliant with skills.sh, Claude Plugins Marketplace, and ChatGPT Plugins / GPTs Custom Actions."
status: completed
priority: P1
created: 2026-09-02
---

# Agent Skill Marketplace Compatibility Plan

## 1. Objectives & Deliverables

1. **skills.sh Compatibility**:
   - Refine `skills/build-with-ak/SKILL.md` frontmatter, trigger keywords, and references for the `skills.sh` registry.
   - Add `.skills/manifest.json` for registry metadata discovery.

2. **Claude Plugins Marketplace Compatibility**:
   - Add `.claude-plugins/build-with-ak/manifest.json` and `.claude-plugins/manifest.json` adhering to Claude Code and Claude Desktop plugin specs.
   - Configure dual MCP transport discovery (stdio `npx @bestagentkits/build-with-ak-mcp` + remote `https://bwak.agentkit.best/mcp`).

3. **ChatGPT Plugins & Custom GPTs / OpenAI Actions Compatibility**:
   - Create `.well-known/ai-plugin.json` AI Plugin Manifest.
   - Create OpenAPI 3.1.0 specification `docs/openapi.json`.
   - Update Cloudflare Worker (`src/worker.ts`) to serve:
     - `GET /.well-known/ai-plugin.json`
     - `GET /openapi.json`
     - `GET /` (Service discovery & health check)

4. **Testing & Verification**:
   - Unit and integration tests in `__tests__/mcp/marketplace-compatibility.test.ts`.
   - Quality gates: `pnpm typecheck`, `pnpm check:drift`, `pnpm test`, `pnpm build`.
