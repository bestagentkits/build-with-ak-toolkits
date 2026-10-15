import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { pushDraft } from '../../project/sync';

export interface PushOptions {
  yes?: boolean;
  /** Create a new listing from this workspace instead of updating its bound listing. */
  new?: boolean;
}

export async function runPush(ctx: CliContext, options: PushOptions = {}): Promise<ExitCode> {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    if (!options.yes && !ctx.out.isJson) {
      ctx.out.failure('Push overwrites the remote draft. Re-run with --yes to confirm.', 'CONFIRMATION_REQUIRED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const client = ctx.createClient();
    const result = await pushDraft(client, ctx.store, { createNew: options.new });
    ctx.out.success(
      { listingId: result.listingId, draftRevisionId: result.newDraftRevisionId, created: result.created },
      result.created
        ? `Created listing ${result.listingId} (revision ${result.newDraftRevisionId ?? 'new'}).`
        : `Pushed draft (revision ${result.newDraftRevisionId ?? 'updated'}).`
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
