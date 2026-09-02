#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './factory';
import { createStdioServices } from './services';
import type { BuildWithAkEnvironment } from '../client/client';

/**
 * Local stdio MCP adapter for IDE agents (Cursor, Claude Desktop, Claude Code,
 * OpenCode). Reads credentials from the environment and exposes local workspace
 * tools. Emits nothing but MCP protocol traffic on stdout.
 */
export async function startStdioServer(): Promise<void> {
  const apiKey = process.env.AGENTKIT_API_KEY;
  if (!apiKey) {
    process.stderr.write('AGENTKIT_API_KEY is required to start the build-with-ak MCP server.\n');
    process.exitCode = 1;
    return;
  }

  const envValue = process.env.AGENTKIT_ENV;
  const environment: BuildWithAkEnvironment = envValue === 'staging' ? 'staging' : 'production';
  const targetExtensions = process.env.AGENTKIT_TARGET_EXTENSIONS === '1';

  const services = createStdioServices({ apiKey, environment, cwd: process.cwd(), targetExtensions });
  const server = createMcpServer(services);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const invoked = process.argv[1] ?? '';
if (invoked.endsWith('stdio.js') || invoked.endsWith('stdio.ts') || invoked.includes('build-with-ak-mcp')) {
  startStdioServer().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
