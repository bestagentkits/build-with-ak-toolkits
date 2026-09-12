---
title: Align toolkit authoring with Activities and Pulse
date: 2026-09-12
summary: "Refresh schema parity and truthful authoring guidance for video, Activities, and Pulse."
---

# Align toolkit authoring with Activities and Pulse

## What happened

The toolkit's old upstream pin omitted video, Activities, and Pulse. The refresh pins the generated contract to 6e548457dba509a39f875cb3fceffb2a5f722a1a and includes the upstream activity URL validator with exact ipaddr.js 2.2.0 dependency. Companion docs now cover all twelve block types and their real authoring limits.

## Decision

Activities contain owner-authored updates with valid dates and optional safe public HTTPS links. Empty blocks remain empty. Pulse content contains only its type and title; upstream server cron supplies checks against the published revision's website. Local preview shows no monitoring samples, and video preview uses a safe YouTube link. The existing CAS save contract remains unchanged. Hosted toolkit MCP and the optional browser Studio WebMCP bridge have separate credentials and capabilities.

## Verification and next steps

Documentation wording was checked against the pinned schema, CLI definitions, preview rendering, and upstream monitoring/browser integration source. The documentation diff passed whitespace checks. Release remains pending the controller's remaining verification, review, and shipping gates; this entry does not assert a completed release or full test suite.

AgentWiki publish skipped. No social publishing performed.

> Historical work record — not durable authority. Prefer docs/specs/ADRs for current decisions.
