# Cloudflare Deployment

Deploy the Streamable HTTP MCP server (`src/worker.ts`) to Cloudflare Workers with Wrangler. The worker is filesystem-free and edge-safe: it exposes a single `/mcp` endpoint plus RFC 9728 metadata at `/.well-known/oauth-protected-resource`.

## Prerequisites

- A Cloudflare account and `wrangler` (`npm i -g wrangler`).
- `CLOUDFLARE_ACCOUNT_ID` and a `CLOUDFLARE_API_TOKEN` with Workers deploy scope.

## Configure `wrangler.jsonc`

The repo ships a `wrangler.jsonc`:

```jsonc
{
  "name": "build-with-ak-mcp",
  "main": "src/worker.ts",
  "compatibility_date": "2025-03-01",
  "compatibility_flags": ["nodejs_compat"],
  "routes": [
    {
      "pattern": "bwak.agentkit.best",
      "custom_domain": true
    }
  ],
  "vars": {
    "AGENTKIT_ENV": "production",
    "OAUTH_ISSUER": "https://agentkit.best",
    "OAUTH_JWKS_URL": "https://agentkit.best/.well-known/jwks.json",
    "OAUTH_AUTH_SERVERS": "https://agentkit.best",
    "WORKER_RESOURCE_URL": "https://bwak.agentkit.best/mcp"
  }
}
```

Set `WORKER_RESOURCE_URL` to the canonical MCP URL including `/mcp`. Metadata and JWT audience use this resource; discovery URLs remain on the origin.

## Response mode

By default the worker streams responses as `text/event-stream`. Set the var `MCP_JSON_RESPONSE` to `"true"` to return `application/json` instead.

## Secrets

Never put secrets in `vars`. Provision the confidential client `build-with-ak-mcp` in the AgentKit authorization server and install the matching secret:

```bash
wrangler secret put OAUTH_CLIENT_SECRET
```

The Worker exchanges the caller's MCP access token for a per-user API token on every request. It never uses `AGENTKIT_API_KEY` or `AGENTKIT_ADMIN_API_KEY` for OAuth. Existing customer `x-api-key` callers remain supported without an exchange secret.

Deploy the website's authorization server, JWKS and delegated API validation first, then provision the matching confidential-client secret and deploy this Worker. A missing secret or unavailable exchange fails closed. See [OAuth configuration](oauth-configuration.md) for token and scope contracts.

## Deploy

```bash
wrangler deploy
```

## Automated Deployment (GitHub Actions CI/CD)

The repository includes automated deployment via `.github/workflows/ci.yml`. On every push to `main`, the CI workflow executes all tests, typechecks, verifies contract snapshot drift, and deploys the worker using `cloudflare/wrangler-action`.

To enable automated deployment, configure the following GitHub Actions secrets in your repository (**Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**):

- `CLOUDFLARE_API_TOKEN`: A Cloudflare API token with **Account.Workers Scripts: Edit** and **Account.Workers KV Storage: Edit** permissions.
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID (available on the Cloudflare dashboard).

## Verify

```bash
# Metadata (RFC 9728)
curl https://<worker>/.well-known/oauth-protected-resource

# Unauthenticated → 401 with WWW-Authenticate challenge
curl -i -X POST https://<worker>/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'

# Authenticated with x-api-key
curl -X POST https://<worker>/mcp \
  -H 'x-api-key: ck_live_...' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"c","version":"1"}}}'
```

The worker is stateless (no session storage) and does not expose a deprecated `/sse` endpoint.
