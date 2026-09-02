# Build with AK Toolkits 🚀

Official developer **CLI** and **Model Context Protocol (MCP) server** for creating, validating, previewing, and submitting product showcases on **Build with AK** ([agentkit.best/build-with-ak](https://agentkit.best/build-with-ak)).

Package: `@bestagentkits/build-with-ak` · Binaries: `build-with-ak`, `build-with-ak-mcp`

---

## Overview

Build with AK Toolkits lets developers and AI coding agents publish rich, block-based product showcases to the AgentKit directory — from the terminal, from an interactive TUI studio, or autonomously via MCP.

- **CLI** — `init`, `template`, `slug`, `media`, `pull`, `validate`, `diff`, `preview`, `push`, `submit`, `studio`.
- **Terminal Studio** — keyboard-driven TUI for metadata, 9 block types, reorder, and review.
- **Local preview** — loopback `127.0.0.1` live-reload server and offline static HTML export.
- **Dual-transport MCP server** — local `stdio` for Cursor/Claude/OpenCode, and a Cloudflare Workers Streamable HTTP server with OAuth 2.1 (RFC 9728) + `x-api-key`.
- **9 layout blocks, 5 curated templates** — schema-parity with the `ak-web` backend; media fields require finalized asset UUIDs.
- **Atomic CAS push & frozen submit** — single-call `PUT /listing` with `expectedDraftRevisionId`, and moderation-frozen `POST /submit`.

---

## Quick Start

```bash
# Install
npm install -g @bestagentkits/build-with-ak      # or: pnpm add -g / bun add -g

# Configure your customer API key (generate at agentkit.best → Customer Dashboard)
export AGENTKIT_API_KEY=ck_live_...
export AGENTKIT_ENV=staging                 # or production (default)

# Scaffold a workspace from a template
build-with-ak init --template saas_product_launch

# Upload media, validate, preview
build-with-ak media upload ./assets/logo.png --kind logo --ref logo
build-with-ak validate --ready
build-with-ak preview --watch

# Push (atomic CAS) then submit for moderation
build-with-ak push --yes
build-with-ak submit --yes
```

Every command accepts `--json` for machine-readable `{ ok, data?, error? }` output and standardized exit codes (`0` ok, `2` validation, `3` auth, `4` not found, `5` CAS conflict, `6` network).

---

## MCP Setup

### 1. Hosted Remote Server (Streamable HTTP)

Connect directly to the production MCP server on Cloudflare Workers:

```json
{
  "mcpServers": {
    "build-with-ak": {
      "type": "http",
      "url": "https://bwak.agentkit.best/mcp",
      "headers": {
        "x-api-key": "ck_live_..."
      }
    }
  }
}
```

### 2. Local stdio

Add to your MCP client config (Claude Desktop, Cursor, Claude Code, OpenCode):

```json
{
  "mcpServers": {
    "build-with-ak": {
      "command": "build-with-ak-mcp",
      "env": { "AGENTKIT_API_KEY": "ck_live_...", "AGENTKIT_ENV": "staging" }
    }
  }
}
```

See [`docs/mcp-setup.md`](docs/mcp-setup.md) for per-client instructions and configuration details.

---

## Documentation

- [Quickstart](docs/quickstart.md)
- [CLI Reference](docs/cli-reference.md)
- [MCP Setup](docs/mcp-setup.md)
- [Cloudflare Deployment](docs/cloudflare-deployment.md)
- [OAuth 2.1 Configuration](docs/oauth-configuration.md)
- [Release & NPM Publishing](docs/release-and-publishing.md)
- [Block Schemas](docs/block-schemas.md)
- [Media Guide](docs/media-guide.md)
- Agent Skill: [`skills/build-with-ak/SKILL.md`](skills/build-with-ak/SKILL.md)

---

## Development

```bash
pnpm install
pnpm test:base      # base 11-endpoint contract suite (100% green)
pnpm test:target    # target extension endpoints (media library, slug availability)
pnpm build          # bundle CLI, MCP stdio, worker, and library
pnpm typecheck
pnpm sync:contracts # re-pin wire schemas from ak-web (intentional contract upgrades only)
pnpm check:drift    # verify committed snapshots match the pinned commit
```

Wire schemas are pinned from [`bestagentkits/ak-web`](https://github.com/bestagentkits/ak-web) at commit `500fe6ef` and committed under `src/contracts/generated/` with provenance digests in `src/contracts/provenance.ts`.

---

## License

MIT © [AgentKit](https://agentkit.best)
