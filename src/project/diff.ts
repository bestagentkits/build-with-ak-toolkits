import { createHash } from 'node:crypto';
import type { UpsertListingDraftInput } from '../contracts/listing';
import type { BuildWithAkBlock } from '../contracts/blocks';

export interface FieldChange {
  field: string;
  local: unknown;
  remote: unknown;
}

export interface BlockChange {
  kind: 'added' | 'removed' | 'modified' | 'reordered';
  blockId: string;
}

export interface ListingDiff {
  hasChanges: boolean;
  metadataChanges: FieldChange[];
  blockChanges: BlockChange[];
}

const METADATA_FIELDS: readonly (keyof UpsertListingDraftInput)[] = [
  'name',
  'slug',
  'tagline',
  'category',
  'websiteUrl',
  'demoUrl',
  'githubUrl',
  'twitterUrl',
  'logoAssetId',
  'coverAssetId',
];

function blockDigest(block: BuildWithAkBlock): string {
  return createHash('sha256').update(JSON.stringify(block.content)).digest('hex');
}

/**
 * Compute a semantic diff between the local compiled draft and the remote draft:
 * which metadata fields changed and which blocks were added, removed, modified,
 * or reordered.
 */
export function computeListingDiff(
  local: UpsertListingDraftInput,
  remote: UpsertListingDraftInput | undefined
): ListingDiff {
  const metadataChanges: FieldChange[] = [];
  for (const field of METADATA_FIELDS) {
    const localValue = local[field] ?? undefined;
    const remoteValue = remote?.[field] ?? undefined;
    if (JSON.stringify(localValue) !== JSON.stringify(remoteValue)) {
      metadataChanges.push({ field: String(field), local: localValue, remote: remoteValue });
    }
  }

  const blockChanges: BlockChange[] = [];
  const localBlocks = local.blocks ?? [];
  const remoteBlocks = remote?.blocks ?? [];
  const remoteById: Record<string, BuildWithAkBlock> = {};
  for (const b of remoteBlocks) remoteById[b.id] = b;
  const localById: Record<string, BuildWithAkBlock> = {};
  for (const b of localBlocks) localById[b.id] = b;

  for (const local of localBlocks) {
    const remoteBlock = remoteById[local.id];
    if (!remoteBlock) {
      blockChanges.push({ kind: 'added', blockId: local.id });
    } else if (blockDigest(local) !== blockDigest(remoteBlock)) {
      blockChanges.push({ kind: 'modified', blockId: local.id });
    } else if (local.order !== remoteBlock.order) {
      blockChanges.push({ kind: 'reordered', blockId: local.id });
    }
  }

  for (const remoteBlock of remoteBlocks) {
    if (!localById[remoteBlock.id]) {
      blockChanges.push({ kind: 'removed', blockId: remoteBlock.id });
    }
  }

  return {
    hasChanges: metadataChanges.length > 0 || blockChanges.length > 0,
    metadataChanges,
    blockChanges,
  };
}
