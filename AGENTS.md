# AGENTS.md

This file provides guidance to OpenCode, Claude Code, and other AI coding agents when working with code in this repository.

## Project Overview

**Name:** `build-with-ak-toolkits`
**Repository:** `bestagentkits/build-with-ak-toolkits`
**Type:** Node.js / TypeScript (CLI & MCP Server)
**Description:** Official CLI tool and Model Context Protocol (MCP) server for submitting, updating, previewing, and customizing product showcase layouts on the **"Build with AK"** Customer Product Directory on [agentkit.best/build-with-ak](https://agentkit.best/build-with-ak).

---

## Related Repositories & References

### Core Web Platform (Source of Truth)
- **Repository:** `bestagentkits/ak-web` (GitHub: [https://github.com/bestagentkits/ak-web](https://github.com/bestagentkits/ak-web))
- **Local Workspace Reference:** `D:\www\claudekit\claudekit-web`
- **Context & Integration:**
  - The `ak-web` repository houses the main `agentkit.best` web application and the "Build with AK" directory feature.
  - When designing CLI payloads, API schemas, layout components, or authentication mechanisms in this repo, ensure full compatibility with the contracts and endpoints defined in `D:\www\claudekit\claudekit-web`.
  - Reference `ak-web` for schema definitions (product metadata, categories, badges, layout sections, media assets, and submission verification rules).

---

## Role & Responsibilities

- **CLI Development:** Provide clean, typed, user-friendly commands (`init`, `preview`, `validate`, `submit`, `layout`) for managing product submissions.
- **MCP Server:** Expose robust MCP tools, resources, and prompt templates so AI agents can draft product showcase configurations and edit page layouts autonomously on behalf of developers.
- **Layout Customization Engine:** Maintain modular, extensible layout section schemas (hero, features, live demos, benchmarks, media embeds, pricing, changelog, testimonials).
- **Quality & Contract Verification:** Ensure strict validation before payload submission against `ak-web` API contracts.

---

## Development Principles

- **YAGNI**: You Aren't Gonna Need It - avoid over-engineering.
- **KISS**: Keep It Simple, Stupid - prefer simple, typed, and idiomatic TypeScript solutions.
- **DRY**: Don't Repeat Yourself - share common schemas between CLI and MCP server surfaces.
- **Compatibility**: Ensure parity between local validation and the live `ak-web` backend validation logic.

---

## Quality Gates

- Run tests before submitting changes.
- Ensure all public contracts and CLI/MCP interfaces are properly documented.
- Follow conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- Never commit secrets, tokens, credentials, or private configuration files.

---

*Generated for AgentKit Toolkits Ecosystem*
*Repository: bestagentkits/build-with-ak-toolkits*
