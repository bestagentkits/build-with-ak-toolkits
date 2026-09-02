import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { pushDraft } from '../../project/sync';

export interface PushOptions {
  yes?: boolean;
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
    const result = await pushDraft(client, ctx.store);
    ctx.out.success(
      { listingId: result.listingId, draftRevisionId: result.newDraftRevisionId },
      `Pushed draft (revision ${result.newDraftRevisionId ?? 'updated'}).`
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
