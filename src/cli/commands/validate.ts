import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { authoringDraftSchema, submissionReadinessSchema } from '../../contracts/listing';
import { buildWireCandidate, MediaResolutionError } from '../../project/compiler';

export interface ValidateOptions {
  ready?: boolean;
}

/**
 * Validate the local draft. Default mode is a permissive draft check
 * (authoringDraftSchema); `--ready` runs the strict local submission-readiness
 * check by compiling to wire format and validating structural completeness.
 */
export function runValidate(ctx: CliContext, options: ValidateOptions = {}): ExitCode {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const doc = ctx.store.readDocument();

    if (!options.ready) {
      const draft = authoringDraftSchema.safeParse({
        name: doc.listing.name,
        slug: doc.listing.slug,
        tagline: doc.listing.tagline,
        category: doc.listing.category || undefined,
        websiteUrl: doc.listing.websiteUrl,
        blocks: doc.blocks,
      });
      if (draft.success) {
        ctx.out.success({ mode: 'draft', isDraftValid: true, errors: [] }, 'Draft is valid for local saving.');
        return EXIT_CODES.SUCCESS;
      }
      ctx.out.failure('Draft has validation issues.', 'DRAFT_INVALID', draft.error.issues);
      return EXIT_CODES.VALIDATION_ERROR;
    }

    // --ready: compile to wire then run readiness checks.
    let candidate;
    try {
      candidate = buildWireCandidate(doc);
    } catch (error) {
      if (error instanceof MediaResolutionError) {
        ctx.out.failure(error.message, 'MEDIA_UNRESOLVED');
        return EXIT_CODES.VALIDATION_ERROR;
      }
      throw error;
    }

    const readiness = submissionReadinessSchema.safeParse(candidate);
    if (readiness.success) {
      ctx.out.success({ mode: 'ready', isSubmissionReady: true, errors: [] }, 'Draft is structurally ready for submission.');
      return EXIT_CODES.SUCCESS;
    }
    ctx.out.failure('Draft is not ready for submission.', 'NOT_READY', readiness.error.issues);
    return EXIT_CODES.VALIDATION_ERROR;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
