# Changelog

All notable changes to `@bestagentkits/build-with-ak` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-09-12

### 🚀 Features

- feat(analytics): expose owned product metrics through toolkit (e1ff256)
- feat(marketplace): ensure compatibility with skills.sh, Claude Plugins, and ChatGPT Actions (#5) (581648a)
- feat(infra): configure custom domain bwak.agentkit.best for Cloudflare Worker MCP server (9c6cb37)
- feat: build-with-ak CLI, dual-transport MCP server, and agent skill (#2) (c200fb3)
- feat: initialize repository with README and AGENTS reference (4868b32)

### 🐛 Bug Fixes

- fix(release): declare npm source repository (0249962)
- fix: remove provenance true from package.json publishConfig to allow local publish (CI uses CLI flag) (dcbd3b1)
- fix: enforce OAuth bearer scope on the worker and verify wrangler config (#3) (a662d12)

### 📚 Documentation

- docs: document exact skills.sh CLI commands (npx skills add/use) (a752424)
- docs: expand Agent & Marketplace Integrations section in README (ce6ff6b)
- docs: add Claude plugin install guide and OpenAI discovery endpoints to mcp-setup.md (4c5346d)
- docs: add remote MCP server setup and update doc links in README (956d562)
- docs: streamline and optimize AGENTS.md root agent context (810c37d)
- docs: sync plan and phase statuses to completed (6f783df)

### 🔧 Maintenance & Tooling

- chore: update package namespace to @bestagentkits/build-with-ak (05657af)
- ci: ensure npm@latest is used for OIDC Trusted Publishing provenance in release workflow (bd55989)
- ci: guard Cloudflare deployment step against missing credentials (097660a)
- ci: add SemVer release workflow with changelog and npm Trusted Publisher (237279e)
- ci: add Cloudflare Workers deployment job on push to main (ed12d44)
- chore: remove stray wrangler dry-run artifacts and gitignore tmp/ (#4) (6218387)

### 📝 Other Changes

- Merge pull request #10 from bestagentkits/codex/fix-toolkit-npm-repository (33f67ae)
- Merge pull request #9 from bestagentkits/codex/build-with-ak-analytics (43850a3)

## [1.0.0] - 2026-09-02

### 🚀 Features

- feat: build-with-ak CLI, dual-transport MCP server, and agent skill (#2) (c200fb3)
- feat: initialize repository with README and AGENTS reference (4868b32)

### 🐛 Bug Fixes

- fix: enforce OAuth bearer scope on the worker and verify wrangler config (#3) (a662d12)

### 📚 Documentation

- docs: sync plan and phase statuses to completed (6f783df)

### 🔧 Maintenance & Tooling

- ci: add Cloudflare Workers deployment job on push to main (ed12d44)
- chore: remove stray wrangler dry-run artifacts and gitignore tmp/ (#4) (6218387)

## [1.0.0] - 2026-09-02

### 🚀 Features

- feat: build-with-ak CLI, dual-transport MCP server, and agent skill (#2) (c200fb3)
- feat: initialize repository with README and AGENTS reference (4868b32)

### 🐛 Bug Fixes

- fix: enforce OAuth bearer scope on the worker and verify wrangler config (#3) (a662d12)

### 📚 Documentation

- docs: sync plan and phase statuses to completed (6f783df)

### 🔧 Maintenance & Tooling

- ci: add Cloudflare Workers deployment job on push to main (ed12d44)
- chore: remove stray wrangler dry-run artifacts and gitignore tmp/ (#4) (6218387)
