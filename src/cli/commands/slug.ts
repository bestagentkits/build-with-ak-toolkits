import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { BuildWithAkCapabilityError } from '../../client/errors';
import { isValidSlug } from '../../contracts/generated/slug';

export async function runSlugCheck(ctx: CliContext, slug: string): Promise<ExitCode> {
  try {
    const locallyValid = isValidSlug(slug);
    if (!locallyValid) {
      ctx.out.success(
        { slug, available: false, locallyValid: false, reason: 'Slug format is invalid or reserved.' },
        `Slug "${slug}" is not a valid format (use lowercase letters, numbers, hyphens; 3-64 chars; not reserved).`
      );
      return EXIT_CODES.SUCCESS;
    }

    const client = ctx.createClient({ targetExtensions: ctx.resolveTargetExtensions() });
    try {
      const result = await client.checkSlugAvailability(slug);
      ctx.out.success(
        { slug: result.slug, available: result.available, locallyValid: true, suggestions: result.suggestions ?? [] },
        result.available
          ? `Slug "${slug}" is available.`
          : `Slug "${slug}" is taken. Suggestions: ${(result.suggestions ?? []).join(', ') || 'none'}`
      );
      return EXIT_CODES.SUCCESS;
    } catch (error) {
      if (error instanceof BuildWithAkCapabilityError) {
        ctx.out.success(
          { slug, available: null, locallyValid: true, capability: 'unavailable' },
          `Slug "${slug}" has a valid format. Live availability check requires the target contract (not yet deployed).`
        );
        return EXIT_CODES.SUCCESS;
      }
      throw error;
    }
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
