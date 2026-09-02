# Block Schemas

Nine block types compose a showcase. Each block is `{ id, order, content }` with `content.type` as the discriminator. Blocks validate against the wire schema pinned from `ak-web` (`blocks-schema.ts`). Media fields require a finalized `assetId` UUID; text fields reject markup/script vectors.

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

## Constraints summary

- Block IDs must be unique; `order` must be a contiguous `0..N`.
- Max 30 blocks.
- Media `assetId` values must be finalized UUIDs (never raw URLs).
- Quantitative/superlative claims should carry `claimEvidence` (`{ kind: 'url'|'note', value }`).
