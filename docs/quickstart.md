# Quickstart

Publish a product showcase in ~5 minutes.

## 1. Install

```bash
npm install -g @agentkit/build-with-ak
```

## 2. Get an API key

Sign in at [agentkit.best](https://agentkit.best) → Customer Dashboard → generate a customer API key (`ck_live_...`).

```bash
export AGENTKIT_API_KEY=ck_live_...
export AGENTKIT_ENV=staging   # validate on staging first; switch to production to go live
```

## 3. Scaffold

```bash
build-with-ak init --template saas_product_launch --env staging
```

This creates `build-with-ak.json` (your authoring document) and a gitignored `.build-with-ak/` state directory. Edit the `listing` fields (name, slug, tagline, category, websiteUrl) in `build-with-ak.json`.

## 4. Add media

```bash
build-with-ak media upload ./assets/logo.png --kind logo --ref logo
build-with-ak media upload ./assets/screen1.png --kind screenshot --ref shot1
```

Each command runs the 3-step pipeline (intent → R2 → finalize) and stores the returned `assetId` in your workspace `media` map under the `--ref` key. Reference those keys from blocks.

## 5. Validate & preview

```bash
build-with-ak validate            # permissive draft check
build-with-ak validate --ready    # strict submission-readiness check
build-with-ak preview --watch     # loopback live preview at http://127.0.0.1:<port>
```

## 6. Push & submit

```bash
build-with-ak push --yes          # atomic CAS PUT /listing
build-with-ak submit --yes        # frozen POST /submit for moderation
```

Add `--json` to any command for scriptable output. See the [CLI Reference](cli-reference.md) for every flag and exit code.
