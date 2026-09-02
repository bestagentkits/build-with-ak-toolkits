import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import worker, { type WorkerEnv } from '../../src/worker';

describe('Marketplace Compatibility: skills.sh, Claude Plugins & ChatGPT Custom Actions', () => {
  describe('1. skills.sh Compatibility', () => {
    it('provides valid SKILL.md with name and description in YAML frontmatter', () => {
      const skillPath = resolve(process.cwd(), 'skills/build-with-ak/SKILL.md');
      expect(existsSync(skillPath)).toBe(true);

      const content = readFileSync(skillPath, 'utf-8');
      expect(content.startsWith('---')).toBe(true);

      const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      expect(frontmatterMatch).toBeTruthy();

      const frontmatter = frontmatterMatch ? frontmatterMatch[1] : '';
      expect(frontmatter).toContain('name: build-with-ak');
      expect(frontmatter).toContain('description:');
      expect(content).toContain('## Golden rules');
      expect(content).toContain('## Standard workflow');
    });

    it('provides all referenced companion documentation', () => {
      expect(existsSync(resolve(process.cwd(), 'skills/build-with-ak/references/block-catalog.md'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'skills/build-with-ak/references/troubleshooting.md'))).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'skills/build-with-ak/references/workflows.md'))).toBe(true);
    });
  });

  describe('2. Claude Plugins Marketplace Compatibility', () => {
    it('provides valid .claude-plugin/plugin.json manifest', () => {
      const pluginPath = resolve(process.cwd(), '.claude-plugin/plugin.json');
      expect(existsSync(pluginPath)).toBe(true);

      const plugin = JSON.parse(readFileSync(pluginPath, 'utf-8'));
      expect(plugin.name).toBe('build-with-ak');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.description).toBeTruthy();
      expect(plugin.mcpServers).toHaveProperty('build-with-ak-stdio');
      expect(plugin.mcpServers).toHaveProperty('build-with-ak-remote');
      expect(plugin.mcpServers['build-with-ak-remote'].url).toBe('https://bwak.agentkit.best/mcp');
      expect(plugin.skills).toContain('./skills/build-with-ak');
      expect(plugin.userConfig).toHaveProperty('AGENTKIT_API_KEY');
      expect(plugin.userConfig.AGENTKIT_API_KEY).toHaveProperty('title');
      expect(plugin.userConfig.AGENTKIT_ENV).toHaveProperty('title');
      expect(plugin.mcpServers['build-with-ak-stdio'].args).toContain('--package=@bestagentkits/build-with-ak');
    });
    it('provides valid .claude-plugin/marketplace.json catalog', () => {
      const marketPath = resolve(process.cwd(), '.claude-plugin/marketplace.json');
      expect(existsSync(marketPath)).toBe(true);

      const marketplace = JSON.parse(readFileSync(marketPath, 'utf-8'));
      expect(marketplace.name).toBe('bestagentkits');
      expect(Array.isArray(marketplace.plugins)).toBe(true);
      expect(marketplace.plugins[0].name).toBe('build-with-ak');
      expect(marketplace.plugins[0].source).toBe('./plugin.json');
    });
  });

  describe('3. ChatGPT Plugins & OpenAI Custom GPTs Compatibility', () => {
    it('provides valid .well-known/ai-plugin.json and docs/openapi.json', () => {
      const aiPluginPath = resolve(process.cwd(), '.well-known/ai-plugin.json');
      const openApiPath = resolve(process.cwd(), 'docs/openapi.json');

      expect(existsSync(aiPluginPath)).toBe(true);
      expect(existsSync(openApiPath)).toBe(true);

      const aiPlugin = JSON.parse(readFileSync(aiPluginPath, 'utf-8'));
      expect(aiPlugin.schema_version).toBe('v1');
      expect(aiPlugin.name_for_model).toBe('build_with_ak');
      expect(aiPlugin.api.type).toBe('openapi');

      const openApi = JSON.parse(readFileSync(openApiPath, 'utf-8'));
      expect(openApi.openapi).toBe('3.1.0');
      expect(openApi.paths).toHaveProperty('/mcp');
      expect(openApi.paths).toHaveProperty('/.well-known/oauth-protected-resource');
    });

    it('serves /.well-known/ai-plugin.json via Cloudflare Worker', async () => {
      const env: WorkerEnv = { WORKER_RESOURCE_URL: 'https://bwak.agentkit.best' };
      const res = await worker.fetch(new Request('https://bwak.agentkit.best/.well-known/ai-plugin.json'), env);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const body = (await res.json()) as { schema_version: string; name_for_model: string; api: { url: string } };
      expect(body.schema_version).toBe('v1');
      expect(body.name_for_model).toBe('build_with_ak');
      expect(body.api.url).toBe('https://bwak.agentkit.best/openapi.json');
    });

    it('serves /openapi.json via Cloudflare Worker', async () => {
      const env: WorkerEnv = { WORKER_RESOURCE_URL: 'https://bwak.agentkit.best' };
      const res = await worker.fetch(new Request('https://bwak.agentkit.best/openapi.json'), env);

      expect(res.status).toBe(200);
      expect(res.headers.get('Content-Type')).toContain('application/json');

      const body = (await res.json()) as { openapi: string; paths: Record<string, unknown>; components: { securitySchemes: Record<string, unknown> } };
      expect(body.openapi).toBe('3.1.0');
      expect(body.paths).toHaveProperty('/mcp');
      expect(body.paths).toHaveProperty('/.well-known/oauth-protected-resource');
      expect(body.components.securitySchemes).toHaveProperty('ApiKeyAuth');
      expect(body.components.securitySchemes).toHaveProperty('OAuth2');
    });
    it('serves /health check via Cloudflare Worker', async () => {
      const res = await worker.fetch(new Request('https://bwak.agentkit.best/health'), {});
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; timestamp: string };
      expect(body.status).toBe('ok');
      expect(body.timestamp).toBeTruthy();
    });

    it('serves discovery index on GET / without auth headers', async () => {
      const env: WorkerEnv = { WORKER_RESOURCE_URL: 'https://bwak.agentkit.best' };
      const res = await worker.fetch(new Request('https://bwak.agentkit.best/'), env);

      expect(res.status).toBe(200);
      const body = (await res.json()) as { service: string; endpoints: { mcp: string } };
      expect(body.service).toContain('Build with AK MCP Server');
      expect(body.endpoints.mcp).toBe('https://bwak.agentkit.best/mcp');
    });
  });
});
