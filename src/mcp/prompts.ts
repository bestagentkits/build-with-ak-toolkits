export interface McpPromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: { type: 'text'; text: string };
}

export interface McpPromptDefinition {
  name: string;
  title: string;
  description: string;
  arguments: McpPromptArgument[];
  build: (args: Record<string, string | undefined>) => McpPromptMessage[];
}

function userText(text: string): McpPromptMessage {
  return { role: 'user', content: { type: 'text', text } };
}

export function createPrompts(): McpPromptDefinition[] {
  return [
    {
      name: 'draft_product_showcase',
      title: 'Draft Product Showcase',
      description: 'Interview the developer and seed a template into a build-with-ak draft.',
      arguments: [
        { name: 'productName', description: 'The product name', required: false },
        { name: 'repoPath', description: 'Local repository path to inspect for evidence', required: false },
      ],
      build: (args) => [
        userText(
          `You are drafting a "Build with AK" product showcase${args.productName ? ` for "${args.productName}"` : ''}.\n` +
            `${args.repoPath ? `Inspect the repository at ${args.repoPath}: read README, package manifests, git tags, and screenshot assets.\n` : ''}` +
            `1. Extract real product evidence — never invent testimonials, metrics, or unfinalized asset URLs.\n` +
            `2. Call build_with_ak_list_templates and choose the best-fitting layout.\n` +
            `3. Call build_with_ak_apply_template with real name/tagline seeded from evidence.\n` +
            `4. Call build_with_ak_validate_listing and resolve any draft errors before proceeding.`
        ),
      ],
    },
    {
      name: 'curate_layout_blocks',
      title: 'Curate Layout Blocks',
      description: 'Optimize the block sequence and verify quantitative claim evidence.',
      arguments: [],
      build: () => [
        userText(
          `Review the current draft blocks (build_with_ak_get_blocks). Improve the narrative order for conversion, ` +
            `ensure every quantitative or superlative claim carries claimEvidence, and confirm each maker_quote has a real ` +
            `attribution and quoteSource. Use build_with_ak_patch_block and build_with_ak_reorder_blocks. Do not fabricate data.`
        ),
      ],
    },
    {
      name: 'prepare_submission',
      title: 'Prepare Submission',
      description: 'Validate readiness, resolve media UUIDs, and request explicit submission approval.',
      arguments: [],
      build: () => [
        userText(
          `Prepare the draft for submission:\n` +
            `1. Call build_with_ak_validate_listing; ensure isSubmissionReady is true.\n` +
            `2. Confirm all media fields reference finalized asset UUIDs (upload any local files first).\n` +
            `3. Push the draft (build_with_ak_update_listing) with the current expectedDraftRevisionId.\n` +
            `4. STOP and request explicit developer approval before calling build_with_ak_submit_listing — submission is frozen and moderated.`
        ),
      ],
    },
  ];
}
