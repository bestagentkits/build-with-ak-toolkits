# Activities and Pulse toolkit delivery

Status: implementation verified; release pending

Outcome: synchronize the toolkit with the deployed website, then publish npm and deploy hosted MCP.

Constraints: preserve CAS updates, filesystem-free Worker, real activity data, server-owned Pulse history, and unrelated shared-checkout changes.

Non-goals: new monitoring endpoints, client-side health checks, website changes, release infrastructure changes.

## Steps and acceptance

- [x] Isolate from current main and inspect issue #8 and deployed upstream contracts.
- [x] Re-pin generated contracts through the sync script, including URL validation dependency.
- [x] CLI/client/MCP preserve and validate Activities/Pulse/video; preview and Studio support authoring without fabricated samples.
- [x] Update companion skill and owning documentation.
- [x] Pass focused regressions, typecheck, drift verification, base/target tests, build and independent review.
- [ ] Merge reviewed PR with green CI, publish a patch release and verify hosted MCP and installed package.

Rollback: revert feature commit and redeploy previous Worker; npm versions are immutable, so publish a corrective patch if required. No database changes.

Evidence: [tests](reports/tests.md), [review](reports/review.md). The release PR records final CI, npm publication, and hosted MCP verification after merge.
