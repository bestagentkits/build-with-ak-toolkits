# Build with AK Toolkits 🚀

Official developer CLI and Model Context Protocol (MCP) server for submitting, validating, managing, and customizing showcase layouts for products published on **Build with AK** ([agentkit.best/build-with-ak](https://agentkit.best/build-with-ak)).

---

## 🌟 Overview

**Build with AK Toolkits** empowers creators, developers, and AI agents to seamlessly publish and maintain their product showcases on AgentKit's official directory. Whether deploying a new AI tool built with AgentKit or updating showcase layouts, this toolkit provides a first-class developer and agentic experience.

### Key Capabilities

- 🛠️ **Showcase CLI**: Command-line interface to create, validate, preview, submit, and update product listings and rich showcase layouts.
- 🤖 **Showcase MCP Server**: Model Context Protocol integration enabling AI coding agents (OpenCode, Claude Code, Cursor, Windsurf) to draft product metadata, design layout blocks, and submit listings autonomously with developer oversight.
- 🎨 **Layout Customization**: Rich block-based layout builder (hero, features, live demos, benchmarks, media embeds, testimonials, tech stack, and changelog).
- ✅ **Schema Validation**: Automated pre-submission validation ensuring compatibility with `agentkit.best` directory standards.

---

## 🏗️ Architecture & Modules

```
build-with-ak-toolkits/
├── src/
│   ├── cli/           # CLI tool implementation
│   ├── mcp/           # MCP Server (tools, resources, prompts)
│   ├── schema/        # Product metadata and layout component schemas
│   └── client/        # API client communicating with agentkit.best
├── docs/              # Technical documentation and specs
├── AGENTS.md          # AI agent conventions and references
└── README.md
```

---

## 🚀 Quick Start

### Installation

```bash
# Using npm
npm install -g @bestagentkits/build-with-ak-toolkits

# Using pnpm
pnpm add -g @bestagentkits/build-with-ak-toolkits

# Using bun
bun add -g @bestagentkits/build-with-ak-toolkits
```

### CLI Usage

```bash
# Authenticate with AgentKit account
ak-showcase auth login

# Initialize a new product showcase configuration
ak-showcase init

# Preview showcase layout locally
ak-showcase preview

# Validate product metadata and layout schema
ak-showcase validate

# Submit or update showcase listing
ak-showcase submit
```

### MCP Server Configuration

Add to your MCP settings file (e.g. `claude_desktop_config.json` or `opencode.json`):

```json
{
  "mcpServers": {
    "build-with-ak": {
      "command": "npx",
      "args": ["-y", "@bestagentkits/build-with-ak-toolkits", "mcp"]
    }
  }
}
```

---

## 🔗 Related Repositories & Context

- **Main Web Application**: [`bestagentkits/ak-web`](https://github.com/bestagentkits/ak-web) (Local: `D:\www\claudekit\claudekit-web`)
  - Contains the core "Build with AK" customer product directory, backend API routes, showcase rendering engine, and database models.

---

## 📄 License

MIT © [AgentKit Team](https://agentkit.best)
