---
name: build-with-ak
description: Create, validate, preview, submit, and retrieve analytics for a product showcase on Build with AK (agentkit.best) using the @bestagentkits/build-with-ak CLI or MCP server. Use when a developer wants to publish or refresh a showcase, upload media, submit for moderation, or analyze their product page views and outbound clicks, or check conversion tracking availability.
---

# Build with AK — Product Showcase Authoring

Publish a rich, block-based product showcase to the **Build with AK** directory. Work through the CLI (`build-with-ak`) or the MCP tools (`build_with_ak_*`). Never fabricate content: every claim, testimonial, and asset must come from real evidence in the repository or from the developer.

## Golden rules

1. **Evidence only.** Seed metadata and blocks from the actual repo — `README`, `package.json`/manifests, git tags, `docs/`, screenshots in the repo. Never invent metrics, testimonials, or superlatives.
2. **Media = finalized UUID.** Every image field stores a finalized `assetId` UUID, never a raw URL or local path. Upload first, then reference the returned UUID.
3. **Validate before push; approval before submit.** Run readiness validation before pushing. `submit` is frozen and moderated — STOP and get explicit developer approval before calling it.
4. **CAS is authoritative.** `push` uses `expectedDraftRevisionId`. On a `5` / `STALE_REVISION` conflict, `pull` and reconcile — never blind-overwrite.

## Setup

For hosted MCP, configure only `https://bwak.agentkit.best/mcp` in an OAuth-capable client and complete its normal browser sign-in and consent flow. Analytics needs `build-with-ak:read`; request `build-with-ak:write` only when performing writes. Never ask the user to paste browser cookies, access tokens, or the Worker client secret.

CLI and local stdio still use a customer API key (`ck_live_...`) from the agentkit.best Customer Dashboard. Legacy hosted clients may send that key as `x-api-key`.

```bash
export AGENTKIT_API_KEY=ck_live_...
export AGENTKIT_ENV=staging      # validate on staging before production
```

## Standard workflow (new showcase)

1. **Inspect the repo** for evidence: product name, one-line value proposition (tagline ≥ 5 chars), category, website (https), GitHub/demo URLs, tech stack, screenshots, and any real maker quotes with attribution + source.
2. **Choose a template** — `build-with-ak template list` (or `build_with_ak_list_templates`). Pick by product type:
   - `minimalist_showcase` — early tools/utilities
   - `saas_product_launch` — commercial SaaS / AI platforms
   - `devtool_open_source` — CLIs, libraries, SDKs
   - `visual_media_app` — creative/media tools
   - `comprehensive_case_study` — flagship/enterprise
3. **Scaffold** — `build-with-ak init --template <id> --env staging`, then edit `build-with-ak.json` metadata (or `build_with_ak_apply_template`).
4. **Upload media** — `build-with-ak media upload ./assets/logo.png --kind logo --ref logo` (kinds: `logo`, `cover`, `screenshot`). Reference the returned `assetId` in blocks. Remote agents use `build_with_ak_upload_media_payload` (base64, < 5 MB).
5. **Validate** — `build-with-ak validate` (draft) then `--ready` (submission readiness). Fix every reported issue.
6. **Preview** — `build-with-ak preview --watch` (loopback `127.0.0.1`) or `--export ./out --offline` for a static bundle.
7. **Push** — `build-with-ak push --yes` (atomic CAS `PUT /listing`).
8. **Request approval, then submit** — after the developer explicitly approves, `build-with-ak submit --yes` (`POST /submit`, frozen at the current revision).

## Layout refresh (existing showcase)

1. `build-with-ak pull` — sync remote listing + blocks and the revision baseline.
2. `build-with-ak diff` — review local-vs-remote changes.
3. Edit blocks (CLI, `studio`, or `build_with_ak_patch_block` / `build_with_ak_reorder_blocks`).
4. `validate --ready` → `push` → (approval) → `submit`.

## Product page analytics (read-only)

1. Use existing credentials to run `build-with-ak analytics --json` or call `build_with_ak_get_analytics` with `{}`. No `init`, `pull`, workspace, or target-extension flag is needed. CLI global `--api-key` works without an environment key.
2. For a requested period, pass `--from YYYY-MM-DD --to YYYY-MM-DD` (MCP: `from`, `to`). Dates are inclusive UTC; default `to` is today and `from` is 29 days earlier. Maximum 366 days; no future `to`.
3. Omit listing ID to select the active non-rejected/non-archived listing, or pass `--listing-id <owned-uuid>` (MCP: `listingId`) for an owned historical listing.
4. Report returned listing, period, source, generatedAt, totals, and daily trends from real data. Views deduplicate per listing/IP + user agent/day, not unique people across days. Outbound clicks count redirect requests. Referral conversions are always `null` in totals and every daily row because conversion tracking is not instrumented. Report unavailable, never zero. Do not infer conversions, conversion rates, or external product sales.
5. A 404 means no matching owned listing, including cross-owner IDs; never infer that another owner's listing exists. Report validation, authentication, and rate-limit failures clearly. Do not fabricate analytics or external revenue.

MCP resource `build-with-ak://remote/analytics` returns the default period. Prompt `review_product_analytics` accepts optional `listingId`, `from`, and `to`.

## Block types (9)

`hero_banner`, `columns` (`two`|`three`|`bento`), `agentkit_story`, `tech_stack`, `screenshot_gallery`, `image_full`, `carousel_gallery`, `maker_quote`, `outbound_cta`. Full field reference: `references/block-catalog.md`.

- `maker_quote` REQUIRES real `attribution` and `quoteSource`.
- Any quantitative/superlative claim in text needs `claimEvidence` (`{ kind: 'url'|'note', value }`).
- Text fields reject markup/script; media fields require UUID `assetId`.

## References

- `references/block-catalog.md` — every block's fields and limits.
- `references/workflows.md` — new-showcase vs refresh, step by step.
- `references/troubleshooting.md` — CAS 409 recovery, media, validation, auth.

## Machine-readable mode

Pass `--json` to any CLI command for `{ ok, data?, error? }`. Exit codes: `0` success, `2` validation, `3` auth, `4` not found, `5` CAS conflict, `6` network. Branch on these instead of parsing prose.
