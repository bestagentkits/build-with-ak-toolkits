# Workflows

## New showcase (from an unlisted product)

1. **Gather evidence** from the repo: name, tagline (≥5 chars), category (one of `developer_tools`, `ai_agents`, `saas`, `productivity`, `ecommerce`, `marketing_sales`, `education`, `other`), `websiteUrl` (https), optional `demoUrl`/`githubUrl`/`twitterUrl`, tech stack, screenshots, real maker quotes.
2. `build-with-ak init --template <id> --env staging`
3. Edit `build-with-ak.json` metadata to the real values.
4. Upload each image: `build-with-ak media upload <file> --kind logo|cover|screenshot --ref <key>`. Wire the returned `assetId`/`ref` into blocks and `logoMediaRef`.
5. `build-with-ak validate` → `build-with-ak validate --ready`. Resolve all issues.
6. `build-with-ak preview --watch` (visual check) or `--export ./out --offline`.
7. `build-with-ak push --yes`
8. Request explicit developer approval, then `build-with-ak submit --yes`.

## Layout refresh (existing listing)

1. `build-with-ak pull` — pulls remote listing + blocks and records `baseDraftRevisionId`.
2. `build-with-ak diff` — inspect metadata and block changes.
3. Edit via CLI, `build-with-ak studio`, or MCP `build_with_ak_patch_block` / `build_with_ak_reorder_blocks`.
4. `build-with-ak validate --ready`
5. `build-with-ak push --yes`
6. Approval → `build-with-ak submit --yes`.

## MCP tool mapping

| Step | CLI | MCP tool |
|---|---|---|
| Read listing | `pull` | `build_with_ak_get_listing`, `build_with_ak_get_blocks` |
| List templates | `template list` | `build_with_ak_list_templates` |
| Apply template | `template apply` | `build_with_ak_apply_template` |
| Slug check | `slug check` | `build_with_ak_check_slug_availability` (target) |
| Media library | `media list` | `build_with_ak_list_media_assets` (target) |
| Upload (local) | `media upload` | `build_with_ak_upload_media_file` (stdio only) |
| Upload (remote) | — | `build_with_ak_upload_media_payload` |
| Validate | `validate [--ready]` | `build_with_ak_validate_listing` |
| Push (CAS) | `push` | `build_with_ak_update_listing` |
| Submit (frozen) | `submit` | `build_with_ak_submit_listing` |

## MCP prompts

- `draft_product_showcase` — interview + seed a template from repo evidence.
- `curate_layout_blocks` — optimize order and verify claim evidence.
- `prepare_submission` — validate readiness, resolve media UUIDs, request approval.
