# Troubleshooting

## CAS conflict (exit code 5 / `STALE_REVISION`)

The remote draft changed since your last `pull`/`push`; the server rejected the write to prevent a silent overwrite.

Recovery:
1. `build-with-ak pull` — fetch the latest remote draft and refresh `baseDraftRevisionId`.
2. `build-with-ak diff` — see what diverged.
3. Reapply your intended local changes on top of the pulled state.
4. `build-with-ak push --yes` again.

In the Terminal Studio, a 409 opens the conflict modal (Load Remote / Keep Mine / Manual Reconcile) and pauses autosave until resolved.

## Media upload issues

- **Unsupported type** — only `.png`, `.jpg`/`.jpeg`, `.webp` are allowed.
- **Too large** — limits: logo 2 MB, cover 5 MB, screenshot 5 MB. Payload uploads (MCP) are capped at 5 MB base64-decoded.
- **`MEDIA_UNRESOLVED` on validate/push** — a block or `logoMediaRef` points at a `mediaRef` that has no finalized `assetId`. Run `media upload` for it first, then reference the returned UUID.
- The presigned R2 `PUT` must NOT carry `x-api-key`; the toolkit handles this — never add auth headers to the storage step.

## Validation failures

- **draft mode** (`validate`) — permissive; only structural sanity for local saving.
- **ready mode** (`validate --ready`) — strict: requires name, valid non-reserved slug, tagline ≥ 5 chars, valid category, https `websiteUrl`, a finalized `logoAssetId`, and ≥ 1 block. Local readiness does NOT prove server state (asset ownership, global slug reservation, license) — those are checked on `submit`.

## Activities, Pulse, and video

- **Activity date rejected** — provide a real calendar date in `YYYY-MM-DD`, not a timestamp or an impossible date.
- **Activity link rejected** — use public HTTPS without credentials. Local/internal/reserved hostnames and non-public IPs are disallowed; omit the optional link when none is appropriate.
- **Too many activities** — at most 50 per block. Ask the owner which real updates to retain if removing content needs a product decision.
- **Pulse says unknown/no checks** — expected in local preview/export. Published samples are supplied by upstream server cron against the published revision's `websiteUrl`. Never fill the gap with invented uptime or history, and do not attempt a toolkit cron command.
- **Pulse field disappeared/rejected** — only type/title are authorable. URLs and check results do not belong in block content.
- **Video URL rejected** — use the actual video's YouTube watch/embed/Shorts or `youtu.be` URL with an 11-character video ID; arbitrary video hosts and iframe markup are not supported.
- **Confused MCP credentials** — the hosted `https://bwak.agentkit.best/mcp` endpoint accepts the customer API key in `x-api-key`. The optional webmcp.dev browser Studio connection uses a separate local bridge token and can edit only the active draft, without submitting or publishing.

## Auth (exit code 3)

- Ensure `AGENTKIT_API_KEY` is set to a `ck_live_...` key from the Customer Dashboard.
- Match `AGENTKIT_ENV` (`staging` vs `production`) to the environment your key belongs to.

## Target-only features

`slug check` and `media list` require the target contract extension. On a base-only backend they report the capability is unavailable — the slug format is still validated locally.

## Cloudflare Worker (remote MCP)

- `401` with `WWW-Authenticate: Bearer resource_metadata=...` — authenticate with a Bearer token or send `x-api-key`.
- `403 oauth_not_configured` — the worker has no `OAUTH_ISSUER`/`OAUTH_JWKS_URL`; use `x-api-key` or configure OAuth.
- `403 upstream_delegation_unavailable` — a valid Bearer arrived but the worker has no service key; deploy with `AGENTKIT_API_KEY` (single-tenant) or send `x-api-key`.
