import { EXIT_CODES, type ExitCode } from './exit-codes';
import { OutputWriter } from './output';
import {
  BuildWithAkError,
  BuildWithAkAuthError,
  BuildWithAkValidationError,
  BuildWithAkNotFoundError,
  BuildWithAkConflictError,
} from '../client/errors';
import { CASConflictError } from '../project/sync';

/**
 * Map any thrown error to a standardized CLI exit code and emit it through the
 * output writer's error envelope.
 */
export function handleCommandError(out: OutputWriter, error: unknown): ExitCode {
  if (error instanceof BuildWithAkAuthError) {
    out.failure(error.message, error.code);
    return EXIT_CODES.AUTH_ERROR;
  }
  if (error instanceof BuildWithAkNotFoundError) {
    out.failure(error.message, error.code);
    return EXIT_CODES.NOT_FOUND;
  }
  if (error instanceof CASConflictError || error instanceof BuildWithAkConflictError) {
    out.failure(error.message, 'STALE_REVISION');
    return EXIT_CODES.CAS_CONFLICT;
  }
  if (error instanceof BuildWithAkValidationError) {
    out.failure(error.message, error.code, error.details);
    return EXIT_CODES.VALIDATION_ERROR;
  }
  if (error instanceof BuildWithAkError) {
    out.failure(error.message, error.code);
    return EXIT_CODES.NETWORK_ERROR;
  }
  out.failure(error instanceof Error ? error.message : String(error));
  return EXIT_CODES.VALIDATION_ERROR;
}
