# Block Catalog

All 12 block layouts. Every block is `{ id, order, content }`; `content.type` is the discriminator. Text fields reject markup/script vectors; image fields require a finalized `assetId` UUID (never a raw URL).

## hero_banner
- `title` — text, ≤ 120
- `tagline` — text, ≤ 200
- `badges` — string[] (≤ 5), each ≤ 40

## columns
- `variant` — `two` | `three` | `bento`
- `items` — 1..6 of `{ heading (≤120), body (≤600), claimEvidence? }`

## agentkit_story
- `body` — text, ≤ 5000
- `usedKits` — subset of `engineer` | `marketing` | `combo` | `app` (≤ 4)
- `claimEvidence?`

## tech_stack
- `tags` — string[] (≤ 20), each ≤ 40

## screenshot_gallery
- `images` — up to 5 of `{ assetId (UUID), alt (≤200) }`

## image_full
- `assetId` — UUID
- `alt` — text, ≤ 200
- `caption?` — text, ≤ 400

## carousel_gallery
- `images` — 1..5 of `{ assetId (UUID), alt (≤200), caption? (≤400) }`

## maker_quote
- `quote` — text, ≤ 600
- `attribution` — text, ≤ 120 (REQUIRED — who said it)
- `quoteSource` — text, ≤ 300 (REQUIRED — where it came from)

## outbound_cta
- `label` — text, ≤ 60
- `note?` — text, ≤ 200 (the destination is the listing's validated `websiteUrl`)

## claimEvidence
Supported on `columns.items` and `agentkit_story` for quantitative or superlative claims:
- `kind` — `url` | `note`
- `value` — text, ≤ 500

## video
- `url` — required YouTube URL, ≤ 500; watch, embed, Shorts, and `youtu.be` links with an 11-character video ID are supported.
- `title?` — text, ≤ 120
- `caption?` — text, ≤ 400
- Use the actual product video. No arbitrary embed HTML or video file upload.

## activities
- `title` — text, ≤ 120; defaults to `Activities`
- `items` — 0..50 entries; defaults to `[]`
- Each entry requires `title` (≤ 120), `description` (≤ 2000), and `date` (valid calendar date in `YYYY-MM-DD` format).
- `items[].url?` — ≤ 2000, public HTTPS without credentials. Local/internal/reserved hostnames and non-public IPs are disallowed. Links are never server fetch targets.
- Owner-authored product updates only, grounded in repository evidence or developer input. Render newest dates first. Empty timelines stay empty; never generate sample releases or dates.
- Activity content has no `claimEvidence` field. Do not add unsupported fields or unsupported claims.

## pulse
- `title` — text, ≤ 120; defaults to `Pulse`
- Content has only `type: "pulse"` and `title`. No target URL, status, latency, uptime, timestamps, or history fields.
- Upstream server cron records checks against the published revision's `websiteUrl` when its layout includes Pulse. Preview and draft edits do not run checks.
- Local preview/export shows unknown/no-checks state with no fabricated history. Published monitoring reflects sampled availability, not a continuous uptime guarantee; stale/missing data is not healthy status.
- There is no toolkit cron/probe operation.

## Authoring vs wire

In the local authoring document (`build-with-ak.json`), image fields may use a `mediaRef` (a key into the document `media` map) instead of `assetId`. The wire compiler resolves each `mediaRef` to its finalized `assetId` before pushing; if a referenced media has not been uploaded/finalized, compilation fails with `MEDIA_UNRESOLVED`.
