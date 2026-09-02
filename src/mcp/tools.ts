import { z } from 'zod';
import type { BuildWithAkClient, MediaKind, MediaMimeType } from '../client/client';
import { BuildWithAkError } from '../client/errors';
import type { AuthoringDocument } from '../project/authoring-schema';
import type { UploadMediaResult } from '../media/upload';
import { upsertListingDraftSchema, authoringDraftSchema, submissionReadinessSchema } from '../contracts/listing';
import { BUILD_WITH_AK_TEMPLATES, instantiateTemplate, type TemplateId } from '../contracts/templates';

export interface UploadPayloadInput {
  filename: string;
  kind: MediaKind;
  mimeType: MediaMimeType;
  base64Content: string;
}

export interface McpServices {
  transport: 'stdio' | 'http';
  getClient(): BuildWithAkClient;
  readWorkspaceDoc?(): AuthoringDocument;
  writeWorkspaceDoc?(doc: AuthoringDocument): void;
  uploadFromPath?(filePath: string, kind: MediaKind): Promise<UploadMediaResult>;
  uploadFromPayload(input: UploadPayloadInput): Promise<UploadMediaResult>;
}

export interface McpToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<McpToolResult>;
}

const MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;

function ok(data: unknown): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string, code?: string): McpToolResult {
  return { content: [{ type: 'text', text: JSON.stringify({ error: message, code }, null, 2) }], isError: true };
}

async function guard(fn: () => Promise<McpToolResult>): Promise<McpToolResult> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof BuildWithAkError) {
      return fail(error.message, error.code);
    }
    return fail(error instanceof Error ? error.message : String(error));
  }
}

const mediaKindSchema = z.enum(['logo', 'cover', 'screenshot']);
const mediaMimeSchema = z.enum(['image/png', 'image/jpeg', 'image/webp']);

export function createTools(services: McpServices): McpToolDefinition[] {
  const tools: McpToolDefinition[] = [
    {
      name: 'build_with_ak_get_listing',
      title: 'Get Listing',
      description: 'Read the remote listing and its current draft revision metadata.',
      inputSchema: z.object({}),
      handler: () => guard(async () => ok(await services.getClient().getListing())),
    },
    {
      name: 'build_with_ak_update_listing',
      title: 'Update Listing (CAS)',
      description: 'Atomic full-draft save via PUT /listing. Pass expectedDraftRevisionId for CAS protection.',
      inputSchema: upsertListingDraftSchema as unknown as z.ZodObject<z.ZodRawShape>,
      handler: (args) =>
        guard(async () => {
          const input = upsertListingDraftSchema.parse(args);
          return ok(await services.getClient().updateListing(input));
        }),
    },
    {
      name: 'build_with_ak_submit_listing',
      title: 'Submit Listing (Frozen)',
      description: 'Frozen submission via POST /submit with { listingId, expectedDraftRevisionId? }.',
      inputSchema: z.object({
        listingId: z.string(),
        expectedDraftRevisionId: z.string().uuid().optional(),
      }),
      handler: (args) =>
        guard(async () => {
          const input = z.object({ listingId: z.string(), expectedDraftRevisionId: z.string().uuid().optional() }).parse(args);
          return ok(await services.getClient().submitListing(input));
        }),
    },
    {
      name: 'build_with_ak_validate_listing',
      title: 'Validate Listing',
      description: 'Validate a draft locally. Returns { isDraftValid, isSubmissionReady, errors }.',
      inputSchema: z.object({ draft: z.record(z.unknown()) }),
      handler: (args) =>
        guard(async () => {
          const { draft } = z.object({ draft: z.record(z.unknown()) }).parse(args);
          const draftResult = authoringDraftSchema.safeParse(draft);
          const readyResult = submissionReadinessSchema.safeParse(draft);
          const errors = [
            ...(draftResult.success ? [] : draftResult.error.issues.map((i) => ({ scope: 'draft', path: i.path.join('.'), message: i.message }))),
            ...(readyResult.success ? [] : readyResult.error.issues.map((i) => ({ scope: 'readiness', path: i.path.join('.'), message: i.message }))),
          ];
          return ok({ isDraftValid: draftResult.success, isSubmissionReady: readyResult.success, errors });
        }),
    },
    {
      name: 'build_with_ak_list_templates',
      title: 'List Templates',
      description: 'Return all 5 curated layout template blueprints.',
      inputSchema: z.object({}),
      handler: () => guard(async () => ok(BUILD_WITH_AK_TEMPLATES)),
    },
    {
      name: 'build_with_ak_apply_template',
      title: 'Apply Template',
      description: 'Instantiate a template into schema-valid blocks with fresh unique IDs.',
      inputSchema: z.object({
        templateId: z.string(),
        metadata: z.object({
          name: z.string(),
          tagline: z.string(),
          category: z.string().optional(),
          websiteUrl: z.string().optional(),
        }),
      }),
      handler: (args) =>
        guard(async () => {
          const parsed = z
            .object({
              templateId: z.string(),
              metadata: z.object({ name: z.string(), tagline: z.string(), category: z.string().optional(), websiteUrl: z.string().optional() }),
            })
            .parse(args);
          const known = BUILD_WITH_AK_TEMPLATES.some((t) => t.id === parsed.templateId);
          if (!known) return fail(`Unknown template "${parsed.templateId}".`, 'UNKNOWN_TEMPLATE');
          const blocks = instantiateTemplate(parsed.templateId as TemplateId, parsed.metadata);
          return ok({ blocks });
        }),
    },
    {
      name: 'build_with_ak_check_slug_availability',
      title: 'Check Slug Availability',
      description: 'Real-time slug availability with suggestions (requires target contract capability).',
      inputSchema: z.object({ slug: z.string() }),
      handler: (args) =>
        guard(async () => {
          const { slug } = z.object({ slug: z.string() }).parse(args);
          return ok(await services.getClient().checkSlugAvailability(slug));
        }),
    },
    {
      name: 'build_with_ak_list_media_assets',
      title: 'List Media Assets',
      description: "Query the customer's finalized asset library (requires target contract capability).",
      inputSchema: z.object({ kind: mediaKindSchema.optional() }),
      handler: (args) =>
        guard(async () => {
          const { kind } = z.object({ kind: mediaKindSchema.optional() }).parse(args);
          return ok(await services.getClient().listMediaAssets({ kind }));
        }),
    },
    {
      name: 'build_with_ak_get_blocks',
      title: 'Get Blocks',
      description: 'Read the current draft blocks.',
      inputSchema: z.object({}),
      handler: () => guard(async () => ok(await services.getClient().getBlocks())),
    },
    {
      name: 'build_with_ak_patch_block',
      title: 'Patch Block',
      description: 'Quick-edit an individual block content or order.',
      inputSchema: z.object({ blockId: z.string(), patch: z.record(z.unknown()) }),
      handler: (args) =>
        guard(async () => {
          const { blockId, patch } = z.object({ blockId: z.string(), patch: z.record(z.unknown()) }).parse(args);
          return ok(await services.getClient().patchBlock(blockId, patch));
        }),
    },
    {
      name: 'build_with_ak_reorder_blocks',
      title: 'Reorder Blocks',
      description: 'Reorder the block ID sequence.',
      inputSchema: z.object({ blockIds: z.array(z.string()).min(1) }),
      handler: (args) =>
        guard(async () => {
          const { blockIds } = z.object({ blockIds: z.array(z.string()).min(1) }).parse(args);
          return ok(await services.getClient().reorderBlocks(blockIds));
        }),
    },
    {
      name: 'build_with_ak_upload_media_payload',
      title: 'Upload Media (Payload)',
      description: `Upload a bounded base64 image payload (< ${MAX_PAYLOAD_BYTES} bytes) via the 3-step pipeline.`,
      inputSchema: z.object({
        filename: z.string(),
        kind: mediaKindSchema,
        mimeType: mediaMimeSchema,
        base64Content: z.string(),
      }),
      handler: (args) =>
        guard(async () => {
          const input = z
            .object({ filename: z.string(), kind: mediaKindSchema, mimeType: mediaMimeSchema, base64Content: z.string() })
            .parse(args);
          const approxBytes = Math.floor((input.base64Content.length * 3) / 4);
          if (approxBytes > MAX_PAYLOAD_BYTES) {
            return fail(`Payload exceeds ${MAX_PAYLOAD_BYTES} bytes.`, 'PAYLOAD_TOO_LARGE');
          }
          return ok(await services.uploadFromPayload(input));
        }),
    },
  ];

  // Local-only tool: reads a file from the workspace disk (stdio transport).
  if (services.transport === 'stdio' && services.uploadFromPath) {
    const uploadFromPath = services.uploadFromPath;
    tools.push({
      name: 'build_with_ak_upload_media_file',
      title: 'Upload Media (Local Path)',
      description: 'Upload a local workspace file (e.g. ./assets/logo.png) via the 3-step pipeline. Local stdio only.',
      inputSchema: z.object({ path: z.string(), kind: mediaKindSchema }),
      handler: (args) =>
        guard(async () => {
          const { path: filePath, kind } = z.object({ path: z.string(), kind: mediaKindSchema }).parse(args);
          return ok(await uploadFromPath(filePath, kind));
        }),
    });
  }

  return tools;
}
