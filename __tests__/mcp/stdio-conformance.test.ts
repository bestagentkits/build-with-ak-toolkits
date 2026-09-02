import { describe, it, expect, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '../../src/mcp/factory';
import type { McpServices } from '../../src/mcp/tools';
import type { BuildWithAkClient } from '../../src/client/client';
import { createEmptyDocument } from '../../src/project/authoring-schema';

function stubServices(): McpServices {
  const client = {
    getListing: vi.fn(async () => ({ listing: { id: 'l-1', name: 'Conformance', slug: 'conf', status: 'draft' } })),
    getBlocks: vi.fn(async () => ({ blocks: [] })),
  };
  return {
    transport: 'stdio',
    getClient: () => client as unknown as BuildWithAkClient,
    readWorkspaceDoc: () => createEmptyDocument('staging'),
    uploadFromPath: vi.fn(),
    uploadFromPayload: vi.fn(),
  } as McpServices;
}

describe('Phase 5: MCP stdio conformance (in-memory transport)', () => {
  it('completes handshake, lists tools/resources/prompts, and invokes a tool', async () => {
    const server = createMcpServer(stubServices());
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    const client = new Client({ name: 'test-client', version: '1.0.0' });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const tools = await client.listTools();
    expect(tools.tools.length).toBeGreaterThanOrEqual(12);
    expect(tools.tools.some((t) => t.name === 'build_with_ak_get_listing')).toBe(true);

    const resources = await client.listResources();
    expect(resources.resources.some((r) => r.uri === 'build-with-ak://templates/catalog')).toBe(true);

    const prompts = await client.listPrompts();
    expect(prompts.prompts.some((p) => p.name === 'prepare_submission')).toBe(true);

    const listTemplates = await client.callTool({ name: 'build_with_ak_list_templates', arguments: {} });
    const content = listTemplates.content as { type: string; text: string }[];
    expect(content[0].type).toBe('text');
    const parsed = JSON.parse(content[0].text) as unknown[];
    expect(parsed).toHaveLength(5);

    await client.close();
    await server.close();
  });
});
