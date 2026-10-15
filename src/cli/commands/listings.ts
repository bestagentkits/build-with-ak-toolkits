import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';

export interface ListingsOptions {
  limit?: number;
  offset?: number;
}

/** Print the caller's active listings and how many listing slots remain. */
export async function runListings(ctx: CliContext, options: ListingsOptions = {}): Promise<ExitCode> {
  try {
    const result = await ctx.createClient().listListings(options);
    const { quota } = result;
    const quotaLine = quota.unlimited
      ? `Quota: ${quota.used} used, unlimited (admin).`
      : `Quota: ${quota.used}/${quota.limit} used (${quota.freeSlots} included, ${quota.purchasedSlots} purchased).` +
        (quota.remaining === 0 ? ` Buy an extra submission: ${result.purchaseUrl}` : '');
    const rows = result.listings.map((l) => `  ${l.id}  ${l.status.padEnd(14)} ${l.slug}  — ${l.name}`);
    ctx.out.success(
      ctx.out.isJson ? result : undefined,
      [`${result.total} listing(s)`, ...rows, quotaLine].join('\n')
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
