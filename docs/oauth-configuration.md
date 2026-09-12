# Hosted MCP OAuth

Connect an OAuth-capable MCP client to `https://bwak.agentkit.best/mcp` and complete its normal browser login and consent flow. Hosted OAuth runs as the signed-in customer. Analytics asks for `build-with-ak:read` by default; grant `build-with-ak:write` only for authoring actions. CLI, local stdio and legacy hosted `x-api-key` clients continue to work independently.

## Discovery and challenges

Both `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource/mcp` serve:

```json
{
  "resource": "https://bwak.agentkit.best/mcp",
  "authorization_servers": ["https://agentkit.best"],
  "scopes_supported": ["build-with-ak:read", "build-with-ak:write"],
  "bearer_methods_supported": ["header"]
}
```

Unauthenticated requests receive HTTP401 and a Bearer `WWW-Authenticate` challenge with `resource_metadata="https://bwak.agentkit.best/.well-known/oauth-protected-resource/mcp"` and `scope="build-with-ak:read"`. Clients discover AgentKit's authorization server, then use Authorization Code + PKCE (S256) through the browser. The canonical resource includes `/mcp`; origin-only tokens are rejected. Do not copy access tokens or browser session cookies into agent prompts.

## Access-token verification

The Worker verifies the signature using `https://agentkit.best/.well-known/jwks.json`, permits only ES256 with `typ=at+jwt`, and requires `iss`, `aud`, `sub`, `exp`, `iat`, `jti`, `client_id`, `grant_id`, and `scope`.

Issuer is exactly `https://agentkit.best` and audience exactly `https://bwak.agentkit.best/mcp`. Identity claims must be nonempty strings; timestamps must be valid, unexpired and not future-issued. Scope is a nonempty space-delimited string containing only `build-with-ak:read` and/or `build-with-ak:write`. Missing/invalid claims fail with401. JWKS public keys are cached; user tokens and exchanges are never shared or cached.

## Per-user API delegation

After token and operation-scope verification, the Worker calls `POST https://agentkit.best/oauth/token` once per authenticated MCP request with an `application/x-www-form-urlencoded` body:

- `grant_type=urn:ietf:params:oauth:grant-type:token-exchange`
- `client_id=build-with-ak-mcp`
- `client_secret` from Worker secret `OAUTH_CLIENT_SECRET` (`client_secret_post`)
- `subject_token` containing the verified incoming MCP access token
- `subject_token_type=urn:ietf:params:oauth:token-type:access_token`
- `requested_token_type=urn:ietf:params:oauth:token-type:access_token`
- `resource=https://agentkit.best/api/build-with-ak`

The server returns a distinct Bearer `access_token`, positive `expires_in` no greater than60 seconds, and granted `scope`. Scope cannot expand beyond the source token. No refresh token is accepted or used. Only this delegated token is sent to the API as `Authorization: Bearer`; the original MCP token is never passed to API endpoints. Delegated tokens are request-local. The API independently verifies its distinct audience, active grant, user and eligibility on each request.

Missing exchange configuration, network failures or invalid responses fail closed. Revoked/invalid grants return401; insufficient scope returns403 with a scope challenge. Upstream error details and credentials are not exposed. The exchange refuses redirects and times out after10 seconds.

`AGENTKIT_API_KEY` is ignored by OAuth, including old single-tenant deployments. There is no shared-identity fallback. Customer `x-api-key` is a separate legacy lane; supplying both an API key and Authorization header is rejected.

## Scope policy

Read access covers listing/blocks/analytics reads, media listing, slug checks, template/validation helpers, and resource reads. Write access covers listing update/submission, block patch/reorder, and media uploads. Initialization, capability lists and prompts can use either valid scope. A write scope does not imply read access; clients needing both request both explicitly. Policy is maintained in `src/mcp/tool-scopes.ts` and coverage tests require an entry for every tool. Denied actions receive403 `insufficient_scope` before token exchange or side effects.

## Rollout

1. Deploy the AgentKit authorization server, ES256 JWKS and delegated API authentication.
2. Register the confidential `build-with-ak-mcp` exchange client and provision its matching secret with `wrangler secret put OAUTH_CLIENT_SECRET`; never place it in source or vars.
3. Set issuer/JWKS and canonical `/mcp` resource as in `wrangler.jsonc` and deploy the Worker.
4. Verify URL-only browser OAuth, read-only analytics and separate write consent; check revocation, wrong audiences and cross-user isolation. API-key requests remain available during rollout.

Removing the exchange secret disables OAuth delegation without changing customer API-key behavior. Rolling back to the previous Worker would restore the old OAuth shared-key implementation, so do not roll back with a service `AGENTKIT_API_KEY` bound.
