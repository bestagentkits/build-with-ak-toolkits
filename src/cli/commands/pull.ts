import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';

export async function runPull(ctx: CliContext): Promise<ExitCode> {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const client = ctx.createClient();
    const remote = await client.getListing();
    const blocksResponse = await client.getBlocks();

    const doc = ctx.store.readDocument();
    const listing = remote.listing;
    doc.listing = {
      ...doc.listing,
      name: String(listing.name ?? doc.listing.name),
      slug: String(listing.slug ?? doc.listing.slug),
      tagline: String(listing.tagline ?? doc.listing.tagline),
      category: String(listing.category ?? doc.listing.category),
      websiteUrl: String(listing.websiteUrl ?? doc.listing.websiteUrl),
      demoUrl: String(listing.demoUrl ?? doc.listing.demoUrl ?? ''),
      githubUrl: String(listing.githubUrl ?? doc.listing.githubUrl ?? ''),
      twitterUrl: String(listing.twitterUrl ?? doc.listing.twitterUrl ?? ''),
    };
    // Preserve remote media by recording finalized asset UUIDs so a pull→push
    // round-trip does not wipe the logo/cover the backend already has.
    if (typeof listing.logoAssetId === 'string') {
      doc.media.logo = { ...doc.media.logo, assetId: listing.logoAssetId };
      doc.listing.logoMediaRef = 'logo';
    }
    if (typeof listing.coverAssetId === 'string') {
      doc.media.cover = { ...doc.media.cover, assetId: listing.coverAssetId };
      doc.listing.coverMediaRef = 'cover';
    }
    doc.blocks = blocksResponse.blocks.map((b) => ({ id: b.id, order: b.order, content: b.content as unknown as Record<string, unknown> }));
    ctx.store.writeDocument(doc);

    ctx.store.writeState({
      ...ctx.store.readState(),
      listingId: listing.id,
      baseDraftRevisionId: listing.draftRevisionId,
      lastPulledAt: new Date().toISOString(),
    });

    ctx.out.success(
      { listingId: listing.id, draftRevisionId: listing.draftRevisionId, blockCount: doc.blocks.length },
      `Pulled listing "${listing.name}" (${doc.blocks.length} blocks).`
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
