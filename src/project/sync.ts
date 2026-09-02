import type { BuildWithAkClient, ListingResponse } from '../client/client';
import type { UpsertListingDraftInput } from '../contracts/listing';
import { BuildWithAkConflictError } from '../client/errors';
import { ProjectStore } from './project-store';
import { compileToWire } from './compiler';

export class CASConflictError extends Error {
  public readonly localBaseRevision?: string;
  public readonly remoteRevision?: string;
  constructor(localBaseRevision?: string, remoteRevision?: string) {
    super(
      `CAS conflict: the remote draft was updated since your last pull (local base revision: ${
        localBaseRevision ?? 'none'
      }, remote revision: ${remoteRevision ?? 'unknown'}). Pull and reconcile before pushing.`
    );
    this.name = 'CASConflictError';
    this.localBaseRevision = localBaseRevision;
    this.remoteRevision = remoteRevision;
  }
}

export interface PushResult {
  listingId: string;
  newDraftRevisionId?: string;
}

/**
 * Execute an atomic CAS push: fetch the current remote draft, verify our stored
 * base revision still matches, then PUT the entire compiled draft in a single
 * request carrying `expectedDraftRevisionId`. On a 409 the server-authoritative
 * conflict is surfaced as `CASConflictError`.
 */
export async function pushDraft(client: BuildWithAkClient, store: ProjectStore): Promise<PushResult> {
  const doc = store.readDocument();
  const state = store.readState();

  const remote: ListingResponse = await client.getListing();
  const remoteRevision = remote.listing.draftRevisionId;

  // A remote draft exists but we have no recorded base revision (never pulled):
  // pushing would blind-overwrite it with no CAS token. Force a pull first.
  if (!state.baseDraftRevisionId && remoteRevision) {
    throw new CASConflictError(undefined, remoteRevision);
  }
  if (state.baseDraftRevisionId && remoteRevision && state.baseDraftRevisionId !== remoteRevision) {
    throw new CASConflictError(state.baseDraftRevisionId, remoteRevision);
  }

  const wire: UpsertListingDraftInput = compileToWire(doc);
  if (state.baseDraftRevisionId) {
    wire.expectedDraftRevisionId = state.baseDraftRevisionId;
  }

  let updated: ListingResponse;
  try {
    updated = await client.updateListing(wire);
  } catch (error) {
    if (error instanceof BuildWithAkConflictError) {
      throw new CASConflictError(state.baseDraftRevisionId, remoteRevision);
    }
    throw error;
  }

  store.writeState({
    ...state,
    listingId: updated.listing.id,
    baseDraftRevisionId: updated.listing.draftRevisionId,
    lastPulledAt: new Date().toISOString(),
  });

  return {
    listingId: updated.listing.id,
    newDraftRevisionId: updated.listing.draftRevisionId,
  };
}
