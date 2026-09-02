# MCP Setup

The toolkit ships a dual-transport MCP server:

- **Local `stdio`** — `build-with-ak-mcp` binary, for IDE agents. Exposes local workspace tools (local-path media upload, workspace draft resource).
- **Remote Streamable HTTP** — a Cloudflare Worker at `https://<worker>/mcp`, for hosted/remote clients. Payload-based media upload only.

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

Point a Streamable-HTTP-capable client at the deployed worker URL and authenticate with `x-api-key` or an OAuth 2.1 Bearer token.

```json
{
  "mcpServers": {
    "build-with-ak-remote": {
      "type": "http",
      "url": "https://build-with-ak-mcp.<subdomain>.workers.dev/mcp",
      "headers": { "x-api-key": "ck_live_..." }
    }
  }
}
```

See [Cloudflare Deployment](cloudflare-deployment.md) and [OAuth Configuration](oauth-configuration.md).

## Tools

Core (both transports): `build_with_ak_get_listing`, `_update_listing`, `_submit_listing`, `_validate_listing`, `_list_templates`, `_apply_template`, `_check_slug_availability`, `_list_media_assets`, `_get_blocks`, `_patch_block`, `_reorder_blocks`, `_upload_media_payload`.

stdio-only: `build_with_ak_upload_media_file` (reads a local workspace path).

## Resources

`build-with-ak://schemas/listing`, `://schemas/blocks`, `://templates/catalog`, `://remote/listing`, and (stdio) `://workspace/draft`.

## Prompts

`draft_product_showcase`, `curate_layout_blocks`, `prepare_submission`.
