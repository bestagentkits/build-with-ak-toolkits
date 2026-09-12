# Activities, Pulse, and Video Test Report

Date: 2026-09-12
Status: DONE

All required toolkit gates passed after the implementation was ready. No existing assertions were weakened and no production files were changed by the tester.

## Coverage

- Updated the expected block catalog to all 12 types and provenance to upstream `6e548457dba509a39f875cb3fceffb2a5f722a1a`, including the generated URL-validator dependency.
- Added 33 contract cases for defaults, preserved content, valid calendar dates, optional links, unsafe/public HTTPS hosts, activity limits, safe text, video URLs, and canonical block patches.
- Added disk roundtrip and compiler preservation checks, newest-first Activities rendering, safe links, unmonitored Pulse output without fabricated metrics, and normalized video preview links.
- Verified real client request construction and response preservation for get/add/patch/reorder, including URL-encoded block IDs.
- Exercised the shared stdio factory through MCP SDK linked transports and the real Worker handler in JSON and SSE modes. Covered validate/update/get/patch/reorder, CAS payload preservation, and invalid updates/patches rejected before upstream requests.

## Results

| Command | Result |
| --- | --- |
| Focused Vitest run | 6 files, 56 tests passed |
| `pnpm typecheck` | Passed |
| `pnpm check:drift` | All snapshots match the pinned commit |
| `pnpm test:base` | 28 files, 181 tests passed |
| `pnpm test:target` | 29 files, 184 tests passed |
| `pnpm build` | CJS, ESM, and declaration outputs passed |

The full base suite took 4.56 seconds and target suite 4.67 seconds. These are local regression checks with controlled upstream responses, not a live production publish or endpoint probe. The tester started no persistent services. No failures or unresolved questions remain.

## Built CLI release smoke

Ran the built `dist/cli/main.js` in ignored `tmp/cli-smoke/` with a local Activities/Pulse/video document and a dummy finalized-asset UUID used only for local readiness validation. No server or upstream mutation was involved.

| Built CLI command | Evidence |
| --- | --- |
| `validate --ready --json` | Exit 0; `isSubmissionReady: true` |
| `preview --export ./export --offline --json` | Exit 0; offline HTML emitted |
| `validate --ready --json` with activity date `2026-02-30` | Exit 2; `NOT_READY` and the calendar-date validation error |

Inspected exported HTML programmatically: all three block types rendered, Activities appeared newest first with a public HTTPS link, Pulse stated that it was not monitored and had no local samples, video used its normalized YouTube link, and offline CSP was present. No unsupported-block fallback or fabricated uptime/response-time values appeared. Restored the valid fixture after the negative check.

Reproduction: `node tmp/cli-smoke/check-smoke.cjs`. Individual command logs and the export remain in that ignored folder. Full suites were not repeated; production source was unchanged.
