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

### `validate [--ready]`
Default: permissive draft check (`authoringDraftSchema`). `--ready`: compile to wire format and run strict submission-readiness (`submissionReadinessSchema`).

### `diff`
Semantic diff between the local compiled draft and the remote draft (metadata + block changes).

### `preview [--watch] [--open] [--export <dir>] [--offline]`
Launch the loopback preview server (`127.0.0.1`, ephemeral port) with EventSource live-reload, or export a standalone static HTML bundle (`--export`, `--offline` enforces a strict CSP).

### `push [--yes]`
Atomic CAS push: fetch remote, verify `baseDraftRevisionId`, then single-call `PUT /listing` with `expectedDraftRevisionId`. Exit `5` on conflict.

### `submit [--yes]`
Frozen submission: `POST /submit` with `{ listingId, expectedDraftRevisionId }`. Requires `--yes` (or `--json`) to confirm.

### `studio`
Launch the interactive keyboard-driven Terminal Studio. Keys: arrows/`j`/`k` navigate, `a` add, `d` delete, `x`/`z` move down/up, `s` save, `q` quit.
