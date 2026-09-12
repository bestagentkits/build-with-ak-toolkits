import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { BuildWithAkError } from '../../client/errors';
import type { AnalyticsQuery } from '../../contracts/analytics';

export async function runAnalytics(ctx: CliContext, params: AnalyticsQuery = {}): Promise<ExitCode> {
  try {
    const result = await ctx.createClient().getAnalytics(params);
    ctx.out.success(ctx.out.isJson ? result : undefined,
      `Analytics for ${result.listing.slug} (${result.period.from} to ${result.period.to}, UTC)\n` +
      `Views: ${result.totals.views} | Outbound clicks: ${result.totals.outboundClicks} | Referral conversions: unavailable\n` +
      'Views are deduplicated per day; clicks are redirect requests. Conversion tracking is not instrumented; do not infer conversions or conversion rates. These metrics are not external product sales.');
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    if (error instanceof BuildWithAkError && error.status === 400) {
      ctx.out.failure(error.message, error.code ?? 'VALIDATION_ERROR', error.details);
      return EXIT_CODES.VALIDATION_ERROR;
    }
    return handleCommandError(ctx.out, error);
  }
}
