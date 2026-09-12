/** Authorization policy, independent of advisory MCP annotations. */
export const MCP_TOOL_SCOPES: Record<string, 'build-with-ak:read' | 'build-with-ak:write'> = {
  build_with_ak_get_analytics: 'build-with-ak:read',
  build_with_ak_get_listing: 'build-with-ak:read',
  build_with_ak_update_listing: 'build-with-ak:write',
  build_with_ak_submit_listing: 'build-with-ak:write',
  build_with_ak_validate_listing: 'build-with-ak:read',
  build_with_ak_list_templates: 'build-with-ak:read',
  build_with_ak_apply_template: 'build-with-ak:read',
  build_with_ak_check_slug_availability: 'build-with-ak:read',
  build_with_ak_list_media_assets: 'build-with-ak:read',
  build_with_ak_get_blocks: 'build-with-ak:read',
  build_with_ak_patch_block: 'build-with-ak:write',
  build_with_ak_reorder_blocks: 'build-with-ak:write',
  build_with_ak_upload_media_payload: 'build-with-ak:write',
  build_with_ak_upload_media_file: 'build-with-ak:write',
};

export function requiredMcpScopes(message: unknown): string[] {
  if (!message || typeof message !== 'object') return ['build-with-ak:read', 'build-with-ak:write'];
  const { method, params } = message as { method?: unknown; params?: { name?: unknown } };
  if (method === 'tools/call') {
    const name = typeof params?.name === 'string' ? params.name : '';
    return [Object.hasOwn(MCP_TOOL_SCOPES, name) ? MCP_TOOL_SCOPES[name]! : 'build-with-ak:write'];
  }
  if (method === 'resources/read') return ['build-with-ak:read'];
  // Initialization, prompts and capability discovery do not read customer data.
  return ['build-with-ak:read', 'build-with-ak:write'];
}
