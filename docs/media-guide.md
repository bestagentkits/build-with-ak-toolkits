# Media Guide

Images are uploaded through a 3-step pipeline and referenced by finalized `assetId` UUID. Raw URLs are never accepted in block content.

## The 3-step pipeline

1. **Intent** — `POST /media/upload-intent` `{ kind, mimeType }` → `{ intentId, presignedUrl, stagingKey, maxByteSize, expiresIn }` (authenticated with `x-api-key`).
2. **Direct R2 PUT** — `PUT presignedUrl` streams the bytes with `Content-Type: <mimeType>` and **no** `x-api-key`/`Authorization` header (the presigned URL is the sole credential).
3. **Finalize** — `POST /media/finalize` `{ stagingKey, kind }` → `{ assetId, assetUrl, mime, width, height }` (authenticated).

The CLI (`build-with-ak media upload`) and the MCP tools run all three steps for you and return the `assetId`.

## Kinds and limits

| Kind | Max size |
|---|---|
| `logo` | 2 MB |
| `cover` | 5 MB |
| `screenshot` | 5 MB |

Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`.

## CLI

```bash
build-with-ak media upload ./assets/logo.png --kind logo --ref logo
build-with-ak media upload ./assets/hero.png --kind cover --ref cover
build-with-ak media upload ./assets/s1.png   --kind screenshot --ref shot1
```

`--ref <key>` stores `{ assetId, localPath }` in the workspace `media` map under `key`. Reference the key from `logoMediaRef`/`coverMediaRef` or from a block image's `mediaRef`; the wire compiler resolves it to the `assetId` on push.

## MCP

- **stdio** — `build_with_ak_upload_media_file` `{ path, kind }` reads a local workspace file.
- **any transport** — `build_with_ak_upload_media_payload` `{ filename, kind, mimeType, base64Content }` accepts a bounded base64 payload (< 5 MB decoded).

## Security

- Presigned URLs and their query signatures are redacted from all logs and error messages.
- Oversized buffers are rejected before the R2 PUT (no wasted bandwidth).
- Block content contains only asset UUIDs — never raw or presigned URLs.
