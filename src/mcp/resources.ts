import type { McpServices } from './tools';
import { BUILD_WITH_AK_TEMPLATES } from '../contracts/templates';
import {
  CATEGORIES,
  BLOCK_TYPES,
  MEDIA_LIMITS,
  ALLOWED_IMAGE_MIME,
  SLUG_REGEX,
  SLUG_MIN_LENGTH,
  SLUG_MAX_LENGTH,
  TAGLINE_MAX_LENGTH,
  MAX_SCREENSHOTS,
} from '../contracts/generated/constants';

export interface McpResourceDefinition {
  uri: string;
  name: string;
  title: string;
  description: string;
  mimeType: string;
  load: () => Promise<string>;
}

export function createResources(services: McpServices): McpResourceDefinition[] {
  const resources: McpResourceDefinition[] = [
    {
      uri: 'build-with-ak://schemas/listing',
      name: 'listing-schema',
      title: 'Listing Metadata Schema',
      description: 'Field rules for listing metadata (name, slug, tagline, category, URLs, media).',
      mimeType: 'application/json',
      load: async () =>
        JSON.stringify(
          {
            categories: CATEGORIES,
            slug: { pattern: SLUG_REGEX.source, minLength: SLUG_MIN_LENGTH, maxLength: SLUG_MAX_LENGTH },
            taglineMaxLength: TAGLINE_MAX_LENGTH,
            requiredHttps: ['websiteUrl', 'demoUrl', 'githubUrl', 'twitterUrl'],
            logoAssetId: 'required (finalized asset UUID)',
          },
          null,
          2
        ),
    },
    {
      uri: 'build-with-ak://schemas/blocks',
      name: 'blocks-schema',
      title: 'Block Layout Schema',
      description: 'The 9 supported block types and media/text constraints.',
      mimeType: 'application/json',
      load: async () =>
        JSON.stringify(
          {
            blockTypes: BLOCK_TYPES,
            columnsVariants: ['two', 'three', 'bento'],
            maxScreenshots: MAX_SCREENSHOTS,
            mediaFields: 'require finalized asset UUID (never raw URLs)',
            allowedImageMime: ALLOWED_IMAGE_MIME,
            mediaLimits: MEDIA_LIMITS,
          },
          null,
          2
        ),
    },
    {
      uri: 'build-with-ak://templates/catalog',
      name: 'templates-catalog',
      title: 'Template Catalog',
      description: 'The 5 curated layout template blueprints.',
      mimeType: 'application/json',
      load: async () => JSON.stringify(BUILD_WITH_AK_TEMPLATES, null, 2),
    },
    {
      uri: 'build-with-ak://remote/listing',
      name: 'remote-listing',
      title: 'Remote Listing Snapshot',
      description: 'The authenticated remote listing and current draft revision.',
      mimeType: 'application/json',
      load: async () => JSON.stringify(await services.getClient().getListing(), null, 2),
    },
  ];

  // Local-only resource: current workspace draft file (stdio transport).
  if (services.transport === 'stdio' && services.readWorkspaceDoc) {
    const readDoc = services.readWorkspaceDoc;
    resources.push({
      uri: 'build-with-ak://workspace/draft',
      name: 'workspace-draft',
      title: 'Local Workspace Draft',
      description: 'The current local build-with-ak.json authoring document.',
      mimeType: 'application/json',
      load: async () => JSON.stringify(readDoc(), null, 2),
    });
  }

  return resources;
}
