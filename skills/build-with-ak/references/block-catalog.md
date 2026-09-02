# Block Catalog

All 9 block layouts. Every block is `{ id, order, content }`; `content.type` is the discriminator. Text fields reject markup/script vectors; media fields require a finalized `assetId` UUID (never a raw URL).

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
Attach to any block field carrying a quantitative or superlative claim:
- `kind` — `url` | `note`
- `value` — text, ≤ 500

## Authoring vs wire

In the local authoring document (`build-with-ak.json`), image fields may use a `mediaRef` (a key into the document `media` map) instead of `assetId`. The wire compiler resolves each `mediaRef` to its finalized `assetId` before pushing; if a referenced media has not been uploaded/finalized, compilation fails with `MEDIA_UNRESOLVED`.
