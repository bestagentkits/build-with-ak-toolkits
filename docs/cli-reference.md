# CLI Reference

`build-with-ak <command> [options]`

## Global options

| Flag | Description |
|---|---|
| `--json` | Emit a single `{ ok, data?, error? }` JSON envelope on stdout |
| `--no-color` | Disable ANSI colors (auto-disabled in non-TTY) |
| `--api-key <key>` | Customer API key (overrides `AGENTKIT_API_KEY`) |
| `--env <staging\|production>` | Target environment (overrides `AGENTKIT_ENV`) |

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success |
| `2` | Validation / usage error |
| `3` | Auth error |
| `4` | Not found |
| `5` | CAS conflict (stale revision) |
| `6` | Network / server error |

All diagnostics and prompts go to stderr; stdout stays parseable.

## Commands

### `init [--template <id>] [--env <env>] [--force]`
Scaffold `build-with-ak.json` + `.build-with-ak/state.json` and add `.build-with-ak/` to `.gitignore`. `--template` seeds blocks from a blueprint.

### `template list`
List the 5 curated templates with descriptions and block sequences.

### `template apply <id>`
Replace the current draft blocks with a template blueprint, seeded from the draft's name/tagline.

### `slug check <slug>`
Validate slug format locally and (when the target contract is available) check live availability with suggestions.

### `media list [--kind <logo|cover|screenshot>]`
Query your finalized asset library (target contract extension).

### `media upload <file> --kind <logo|cover|screenshot> [--ref <key>]`
Run the 3-step upload pipeline and print the `assetId`. Persists `{ assetId, localPath }` into the workspace `media` map under `--ref` (defaults to the filename).

### `pull`
Pull the remote listing and blocks into the workspace and record the revision baseline.

### `analytics [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>] [--listing-id <uuid>]`
Read owner-only analytics with existing credentials; no workspace, `init`, or `pull` is required. Global `--api-key` works on its own and `--json` returns the complete response under `data`: listing ID/slug (both strings), period, source, generatedAt, totals, and ascending zero-filled daily rows.

Dates are inclusive UTC. `to` defaults to today, `from` defaults to 29 days before `to`; maximum 366 days, no future end date. Without `--listing-id`, the API selects the active non-rejected/non-archived listing. An explicit UUID can select a historical owned listing. No owned listing and cross-owner IDs both return 404 (exit 4).

`views` deduplicate per listing/IP + user agent/day, not across days; `outboundClicks` count redirect requests, not unique visitors; `referralConversions` is always `null` in totals and every daily row because conversion tracking is not instrumented. Human output shows unavailable. Do not infer conversions, conversion rates, or external product sales. Invalid dates/ranges return exit 2, auth 401/403 exit 3, and rate limits/server failures exit 6. This additive endpoint requires a supporting upstream deployment but no target-extension flag.

### `validate [--ready]`
Default: permissive draft check (`authoringDraftSchema`). `--ready`: compile to wire format and run strict submission-readiness (`submissionReadinessSchema`).

Draft saves may omit website/logo or leave the tagline empty. `--ready` still requires submission completeness; a successful draft save is not proof that the listing is ready for moderation.

### `diff`
Semantic diff between the local compiled draft and the remote draft (metadata + block changes).

### `preview [--watch] [--open] [--export <dir>] [--offline]`
Launch the loopback preview server (`127.0.0.1`, ephemeral port) with EventSource live-reload, or export a standalone static HTML bundle (`--export`, `--offline` enforces a strict CSP).

Activities display owner-authored items newest first. Empty Activities stay empty. Pulse shows an unknown/no-checks state locally and in exports; preview does not probe the website or populate health metrics. A published Pulse block receives checks from the upstream server cron against the published listing's `websiteUrl`.

### `push [--yes]`
Atomic CAS push: fetch remote, verify `baseDraftRevisionId`, then single-call `PUT /listing` with `expectedDraftRevisionId`. Exit `5` on conflict.

### `submit [--yes]`
Frozen submission: `POST /submit` with `{ listingId, expectedDraftRevisionId }`. Requires `--yes` (or `--json`) to confirm.

### `studio`
Launch the interactive keyboard-driven Terminal Studio. Keys: arrows/`j`/`k` navigate, `a` add, `u` add empty Activities, `h` add Pulse, `d` delete, `x`/`z` move down/up, `s` save, `q` quit. Edit block content in `build-with-ak.json`; the Terminal Studio does not provide an Activities item editor.

## Authoring Activities, Pulse, and video

Edit block content in `build-with-ak.json`, using `studio` to add or arrange blocks, then run `validate --ready`, `preview`, `diff`, and `push` through the existing workflow. These block types have no dedicated CLI subcommands. Use the [block schemas](block-schemas.md) for the content shape: Activities accept real dated entries with optional public HTTPS links; Pulse accepts only a title alongside its type; video accepts a YouTube URL. Local video preview is a safe YouTube link. The CLI has no operation to write Pulse check history, override the monitoring target, or invoke server cron. Submission continues to use `submit` and the existing moderation flow.
