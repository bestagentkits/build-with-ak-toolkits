import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { compileToWire } from '../../project/compiler';
import { computeListingDiff } from '../../project/diff';
import type { UpsertListingDraftInput } from '../../contracts/listing';

export async function runDiff(ctx: CliContext): Promise<ExitCode> {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const doc = ctx.store.readDocument();
    const local = compileToWire(doc);

    const client = ctx.createClient();
    const remote = await client.getListing();
    const remoteBlocks = await client.getBlocks();
    const remoteWire = {
      ...(remote.listing as unknown as UpsertListingDraftInput),
      blocks: remoteBlocks.blocks,
    } as UpsertListingDraftInput;

    const diff = computeListingDiff(local, remoteWire);
    ctx.out.success(
      diff,
      diff.hasChanges
        ? `${diff.metadataChanges.length} metadata change(s), ${diff.blockChanges.length} block change(s).`
        : 'No changes between local draft and remote.'
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
