# Block Schemas

Twelve block types compose a showcase. Each block is `{ id, order, content }` with `content.type` as the discriminator. The authority is the [pinned wire schema](../src/contracts/generated/blocks-schema.ts), synchronized from `ak-web`. Image fields require a finalized `assetId` UUID; text fields reject markup/script vectors.

## hero_banner
```json
{ "id": "b1", "order": 0, "content": {
  "type": "hero_banner",
  "title": "FlowForge",
  "tagline": "Composable AI workflow builder for teams",
  "badges": ["TypeScript", "AI Agents"]
}}
```

## columns
```json
{ "id": "b2", "order": 1, "content": {
  "type": "columns",
  "variant": "bento",
  "items": [
    { "heading": "Fast", "body": "Sub-second orchestration." },
    { "heading": "Proven", "body": "10k runs/day", "claimEvidence": { "kind": "url", "value": "https://status.flowforge.dev" } }
  ]
}}
```
`variant`: `two` | `three` | `bento`; `items`: 1–6.

## agentkit_story
```json
{ "id": "b3", "order": 2, "content": {
  "type": "agentkit_story",
  "body": "We built FlowForge with the AgentKit engineer kit...",
  "usedKits": ["engineer", "app"]
}}
```

## tech_stack
```json
{ "id": "b4", "order": 3, "content": { "type": "tech_stack", "tags": ["Next.js", "Cloudflare", "Zod"] } }
```

## screenshot_gallery
```json
{ "id": "b5", "order": 4, "content": {
  "type": "screenshot_gallery",
  "images": [{ "assetId": "123e4567-e89b-12d3-a456-426614174000", "alt": "Dashboard" }]
}}
```
Up to 5 images.

## image_full
```json
{ "id": "b6", "order": 5, "content": {
  "type": "image_full",
  "assetId": "123e4567-e89b-12d3-a456-426614174000",
  "alt": "Architecture",
  "caption": "Edge-first pipeline"
}}
```

## carousel_gallery
```json
{ "id": "b7", "order": 6, "content": {
  "type": "carousel_gallery",
  "images": [{ "assetId": "123e4567-e89b-12d3-a456-426614174000", "alt": "Step 1", "caption": "Compose" }]
}}
```
1–5 images.

## maker_quote
```json
{ "id": "b8", "order": 7, "content": {
  "type": "maker_quote",
  "quote": "FlowForge cut our integration time in half.",
  "attribution": "Sarah Chen, CTO at TechFlow",
  "quoteSource": "Product Hunt review"
}}
```
`attribution` and `quoteSource` are required (provenance).

## outbound_cta
```json
{ "id": "b9", "order": 8, "content": { "type": "outbound_cta", "label": "Try FlowForge", "note": "Free tier available" } }
```
The destination is the listing's validated `websiteUrl`.

## video

Use a real product video hosted on YouTube. `url` is required (maximum 500 characters); accepted forms include YouTube watch, embed, Shorts, and `youtu.be` links with an 11-character video ID. Optional `title` is at most 120 characters; optional `caption` is at most 400. This block takes a YouTube URL, not an uploaded image asset or arbitrary video/embed HTML.

## activities

Start with an empty owner-authored timeline:

```json
{ "id": "activities", "order": 9, "content": {
  "type": "activities", "title": "Activities", "items": []
}}
```

`title` defaults to `Activities` and is at most 120 characters. `items` defaults to an empty array and allows at most 50 entries. Each entry requires `title` (maximum 120 characters), `description` (maximum 2000), and a real calendar date in `YYYY-MM-DD` format. The optional `url` is at most 2000 characters and must be a public HTTPS URL without credentials. Local/internal/reserved hostnames and non-public IP addresses are disallowed; links are not server fetch targets.

Add only actual product updates supplied by the owner or supported by repository evidence. The rendered timeline sorts newest dates first. An empty block shows no activities; it does not seed release notes, activity events, or dates. Activities text remains subject to moderation; do not invent claims or append unsupported evidence fields.

## pulse

```json
{ "id": "pulse", "order": 10, "content": { "type": "pulse", "title": "Pulse" } }
```

Only `type` and `title` belong in Pulse content. `title` defaults to `Pulse` and is at most 120 characters. Do not supply a monitoring URL, status, uptime, latency, timestamps, or history.

Pulse reflects server-recorded checks of the **published revision's `websiteUrl`**, collected by upstream cron when that revision contains a Pulse block. Draft edits and page previews do not trigger probes. Local preview and static export show unknown/no-checks state without sample history or fabricated metrics. Published checks measure sampled availability, not guaranteed continuous uptime; missing or stale data must not be represented as healthy. The toolkit exposes no cron operation or manual check command.

## Constraints summary

- Block IDs must be unique; `order` must be a contiguous `0..N`.
- Max 30 blocks.
- Media `assetId` values must be finalized UUIDs (never raw URLs).
- Quantitative/superlative claims should carry `claimEvidence` (`{ kind: 'url'|'note', value }`).
