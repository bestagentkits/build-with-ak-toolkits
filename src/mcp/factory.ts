import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createTools, type McpServices } from './tools';
import { createResources } from './resources';
import { createPrompts } from './prompts';

export const MCP_SERVER_INFO = {
  name: 'build-with-ak',
  version: '1.0.0',
} as const;

/**
 * Transport-agnostic MCP server factory. Builds an McpServer and registers the
 * standardized tools, resources, and prompts using the injected application
 * services. The same factory backs both the stdio adapter and the Cloudflare
 * Worker Streamable HTTP adapter.
 */
export function createMcpServer(services: McpServices): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, {
    capabilities: { tools: {}, resources: {}, prompts: {} },
  });

  for (const tool of createTools(services)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema.shape,
      },
      async (args: unknown) => {
        const result = await tool.handler(args);
        return { content: result.content, isError: result.isError };
      }
    );
  }

  for (const resource of createResources(services)) {
    server.registerResource(
      resource.name,
      resource.uri,
      { title: resource.title, description: resource.description, mimeType: resource.mimeType },
      async (uri: URL) => ({
        contents: [{ uri: uri.href, mimeType: resource.mimeType, text: await resource.load() }],
      })
    );
  }

  for (const prompt of createPrompts()) {
    const argsSchema: z.ZodRawShape = Object.fromEntries(
      prompt.arguments.map((arg) => {
        const field = z.string().describe(arg.description);
        return [arg.name, arg.required ? field : field.optional()];
      })
    );
    server.registerPrompt(
      prompt.name,
      {
        title: prompt.title,
        description: prompt.description,
        argsSchema,
      },
      (args: Record<string, string | undefined>) => ({
        messages: prompt.build(args).map((m) => ({ role: m.role, content: m.content })),
      })
    );
  }

  return server;
}
