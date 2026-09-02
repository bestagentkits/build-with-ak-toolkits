# OAuth 2.1 Configuration (RFC 9728)

The Cloudflare Worker acts as an MCP **Resource Server (RS)**. It advertises Protected Resource Metadata per RFC 9728 and validates inbound OAuth 2.1 Bearer tokens issued by the AgentKit authorization server.

## Protected Resource Metadata

`GET /.well-known/oauth-protected-resource` returns:

```json
{
  "resource": "https://<worker-domain>",
  "authorization_servers": ["https://agentkit.best"],
  "scopes_supported": ["build-with-ak:read", "build-with-ak:write"],
  "bearer_methods_supported": ["header"]
}
```

Configure via worker vars: `WORKER_RESOURCE_URL` (the `resource`), `OAUTH_AUTH_SERVERS` or `OAUTH_ISSUER` (the authorization servers).

## Unauthenticated challenge

Requests without credentials receive:

```
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://<worker-domain>/.well-known/oauth-protected-resource"
```

Clients discover the authorization server from the metadata, then perform the Authorization Code + PKCE (S256) flow with AgentKit.

## Bearer validation

For each request with `Authorization: Bearer <jwt>`, the worker verifies:
- **Signature** — against the JWKS at `OAUTH_JWKS_URL`.
- **Issuer** (`iss`) — equals `OAUTH_ISSUER`.
- **Audience** (`aud`) — equals the worker resource URI (`WORKER_RESOURCE_URL` / origin).
- **Expiry** (`exp`).
- **Scope** — if the token carries a `scope` claim, it must include at least one advertised scope (`build-with-ak:read` or `build-with-ak:write`); a token scoped only to unrelated values is rejected with `403 insufficient_scope`. A token with no `scope` claim is accepted (some authorization servers omit it).

Invalid tokens get the 401 challenge.

## Upstream delegation model

The base `ak-web` contract accepts customer `x-api-key` (or browser sessions), not arbitrary Bearer tokens. Therefore inbound Bearer tokens are **never** forwarded upstream as `Authorization`.

- **Multi-tenant:** callers send their own `x-api-key`; the worker passes it upstream. Bearer is not required.
- **Single-tenant self-deploy:** deploy the worker with a service key (`wrangler secret put AGENTKIT_API_KEY`). A valid Bearer then authorizes use of that one key. Without a configured key, an OAuth-only request fails closed with `403 upstream_delegation_unavailable`.

Full OAuth-backed per-user upstream delegation (e.g. RFC 8693 token exchange) is a capability-gated upstream dependency, pending `ak-web` support.
