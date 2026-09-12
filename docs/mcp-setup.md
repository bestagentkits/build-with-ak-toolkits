# MCP Setup

The toolkit ships a dual-transport MCP server:

- **Local `stdio`** — `build-with-ak-mcp` binary, for IDE agents. Exposes local workspace tools (local-path media upload, workspace draft resource).
- **Remote Streamable HTTP** — a Cloudflare Worker at `https://bwak.agentkit.best/mcp`, for hosted/remote clients. Payload-based media upload only.

Both expose the same core tools, resources, and prompts.

## Local stdio

Requires `AGENTKIT_API_KEY` in the server environment.

### Claude Desktop / Claude Code — `claude_desktop_config.json`
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

### Cursor — `.cursor/mcp.json`
```json
{
  "mcpServers": {
    "build-with-ak": {
      "command": "build-with-ak-mcp",
      "env": { "AGENTKIT_API_KEY": "ck_live_..." }
    }
  }
}
```

### OpenCode — `opencode.json`
```json
{
  "mcp": {
    "build-with-ak": {
      "type": "local",
      "command": ["build-with-ak-mcp"],
      "environment": { "AGENTKIT_API_KEY": "ck_live_..." }
    }
  }
}
```

### Windsurf — `mcp_config.json`
```json
{
  "mcpServers": {
    "build-with-ak": {
      "command": "build-with-ak-mcp",
      "env": { "AGENTKIT_API_KEY": "ck_live_..." }
    }
  }
}
```

Set `AGENTKIT_TARGET_EXTENSIONS=1` to enable the target-contract tools (`check_slug_availability`, `list_media_assets`) once the backend supports them.

## Remote (Cloudflare Streamable HTTP)

Add the URL to an OAuth-capable Streamable HTTP client. Follow the normal browser sign-in and consent flow; no API key is needed for hosted OAuth. Analytics requests read access by default. Writes require separate `build-with-ak:write` consent.

```json
{
  "mcpServers": {
    "build-with-ak-remote": {
      "type": "http",
      "url": "https://bwak.agentkit.best/mcp"
    }
  }
}
```

For legacy clients, add `"headers": { "x-api-key": "ck_live_..." }`. Do not combine API-key and Bearer headers. Local stdio keeps API-key configuration.

See [Cloudflare Deployment](cloudflare-deployment.md) and [OAuth Configuration](oauth-configuration.md).

## Browser Studio WebMCP

The optional [webmcp.dev](https://webmcp.dev/) connection in the website's active Studio editor is a separate browser integration. It connects the open editor to a local WebMCP bridge using a fresh connection token. Its tools read and edit that editor's draft through the existing Studio autosave, with no submit or publish operation. Keep the editor open and inspect its save state before considering an edit persisted.

Use `https://bwak.agentkit.best/mcp` with browser OAuth or a legacy `x-api-key` for the toolkit's hosted Streamable HTTP transport. Do not put a browser WebMCP token in `x-api-key`, use the browser bridge as the HTTP endpoint, or assume its tool names/arguments match `build_with_ak_*` tools. The browser integration requires an active Studio session; hosted HTTP and local toolkit stdio use API credentials independently of that editor.

## Tools

Core (both transports): `build_with_ak_get_listing`, `_get_analytics`, `_update_listing`, `_submit_listing`, `_validate_listing`, `_list_templates`, `_apply_template`, `_check_slug_availability`, `_list_media_assets`, `_get_blocks`, `_patch_block`, `_reorder_blocks`, `_upload_media_payload`.

`build_with_ak_get_analytics` is read-only. Optional arguments: `listingId` (owned UUID), `from`, `to` (inclusive UTC `YYYY-MM-DD`). Defaults to the active listing and last 30 days; maximum 366 days, no future end date. Returns listing/period/source/generatedAt, totals, and zero-filled daily rows. Views deduplicate per IP + user agent/day; clicks are redirect requests; `referralConversions` is always `null` in totals and every daily row because tracking is not instrumented. Report unavailable; do not infer conversions, conversion rates, or external product sales. Uses existing credentials on both transports; no workspace or target-extension flag is needed.

stdio-only: `build_with_ak_upload_media_file` (reads a local workspace path).

### Activities, Pulse, and video authoring

The existing listing/block tools handle all 12 block types. Read `build-with-ak://schemas/blocks` and [Block Schemas](block-schemas.md) before authoring. Use `build_with_ak_update_listing` for the full draft with `expectedDraftRevisionId`; use `build_with_ak_patch_block` for existing block edits. These are ordinary draft changes with the same validation, CAS, and moderation boundaries.

Activities contain only real owner-authored updates with valid calendar dates and optional safe public HTTPS links. Pulse content holds only its type and title: never send a URL override, synthetic history, uptime, latency, or status. Monitoring is owned by the upstream server cron and targets the published revision's `websiteUrl`; neither MCP transport exposes a cron/probe operation. Local previews do not contain real Pulse samples. Video uses a real YouTube URL, not an uploaded image UUID.

## Resources

`build-with-ak://schemas/listing`, `://schemas/blocks`, `://templates/catalog`, `://remote/listing`, `://remote/analytics` (active listing, last 30 UTC days), and (stdio) `://workspace/draft`.

## Prompts

`draft_product_showcase`, `curate_layout_blocks`, `prepare_submission`, `review_product_analytics` (optional `listingId`, `from`, `to`).

---

## Claude Plugins Integration

The repository includes `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` for Claude Code and Claude Desktop plugin discovery.

To install as a Claude Code plugin:

```bash
claude plugin add bestagentkits/build-with-ak-toolkits
```

---

## skills.sh (Agent Ecosystem Installation)

Install the skill directly to your AI agent (Claude Code, Cursor, Codex, OpenCode, Amp) using the [skills.sh](https://skills.sh) CLI:

```bash
# Install to current project
npx skills add bestagentkits/build-with-ak-toolkits

# Or install globally across all agents
npx skills add bestagentkits/build-with-ak-toolkits -g -y

# Or use directly without installing
npx skills use bestagentkits/build-with-ak-toolkits --skill build-with-ak
```

---

## OpenAI & ChatGPT Service Discovery

The production Cloudflare Worker serves standard discovery manifests:

- **AI Plugin Manifest**: `https://bwak.agentkit.best/.well-known/ai-plugin.json`
- **OpenAPI 3.1.0 Specification**: `https://bwak.agentkit.best/openapi.json`
- **OAuth 2.1 Protected Resource Metadata**: `https://bwak.agentkit.best/.well-known/oauth-protected-resource`
- **Service Index**: `https://bwak.agentkit.best/`

The OpenAPI analytics operation explicitly targets `https://agentkit.best` (or staging) at `/api/build-with-ak/listing/analytics`. It is an upstream API operation; the Worker serves analytics through `/mcp`, not a REST proxy. The toolkit's authoring contract is pinned at `6e548457dba509a39f875cb3fceffb2a5f722a1a`; analytics is an additive extension outside generated schemas.
