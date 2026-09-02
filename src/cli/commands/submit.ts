import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';

export interface SubmitOptions {
  yes?: boolean;
}

/**
 * Frozen submission: POST /submit with { listingId, expectedDraftRevisionId }.
 * The expected revision locks the moderation target so later draft edits cannot
 * silently change what reviewers see.
 */
export async function runSubmit(ctx: CliContext, options: SubmitOptions = {}): Promise<ExitCode> {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const state = ctx.store.readState();
    if (!state.listingId) {
      ctx.out.failure('No listingId in local state. Run "build-with-ak push" or "pull" first.', 'NO_LISTING_ID');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    if (!options.yes && !ctx.out.isJson) {
      ctx.out.failure('Submission requires confirmation. Re-run with --yes to submit for moderation.', 'CONFIRMATION_REQUIRED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const client = ctx.createClient();
    const result = await client.submitListing({
      listingId: state.listingId,
      expectedDraftRevisionId: state.baseDraftRevisionId,
    });

    if (result.submittedRevisionId) {
      ctx.store.writeState({ ...state, baseDraftRevisionId: result.submittedRevisionId });
    }

    ctx.out.success(
      { listingId: result.listingId, status: result.status, submittedRevisionId: result.submittedRevisionId },
      `Submitted for moderation (status: ${result.status}).`
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
