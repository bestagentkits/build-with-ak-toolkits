# Independent toolkit review

Verdict: Approve
Status: DONE

Scope: pending changes against origin/main for issue #8; two passes covering correctness/security, then compatibility/tests/docs. No source or git mutations performed by reviewer.

## Findings

No remaining actionable findings. The initial unsupported Vitest `toEndWith` matcher was corrected by the tests owner; final typecheck and tests pass. Empty duplicate documentation headings were removed during review.

## Evidence

- All six generated snapshots byte-match `git show 6e548457dba509a39f875cb3fceffb2a5f722a1a:lib/build-with-ak/<file>` after LF normalization. `pnpm check:drift` also passed.
- Activities validate real calendar dates, item/text limits and public HTTPS links before rendering. Text and attributes are escaped; links use noopener/noreferrer. Descending date order uses a copied array.
- Pulse preview ignores client metrics and states that no monitoring samples exist. No client monitoring target, cron endpoint, or probe was introduced.
- Video preview reconstructs the destination from a validated 11-character YouTube ID instead of rendering the caller URL directly.
- MCP patch validation now uses the existing canonical patch contract, including full typed content or order-only patches. Client payload preservation and invalid-content rejection pass through stdio factory, HTTP JSON and HTTP SSE paths.
- CAS push and frozen submit paths remain unchanged. The pre-existing local submission-readiness completeness check remains intact; the repinned upstream draft schema intentionally permits incomplete drafts.
- New `ipaddr.js` dependency does not introduce filesystem access. An independent in-memory Worker bundle covered 291 inputs with existing crypto compatibility external and no filesystem dependency. Controller also reported successful actual Wrangler dry-run bundle and filesystem scan.
- Documentation and companion skill describe all 12 blocks, real owner-authored Activities, server-owned Pulse, and distinct browser/hosted MCP credentials.

## Verification

Reviewer ran:
- Focused contracts/project: 45 tests passed.
- Focused client/MCP: 11 tests passed.
- Final `pnpm typecheck`: passed.
- Final `pnpm test:target`: 29 files, 184 tests passed.
- `pnpm check:drift`: passed.
- Independent pinned-source comparison and Worker dependency bundle inspection: passed.

Controller supplied final gate results: `pnpm test:base` 28 files/181 tests; CJS/ESM/DTS build passed; 11 documentation JSON examples validated. Release remains controller-owned and is not claimed by this review.

Unresolved questions: none.
