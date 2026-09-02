import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { compileToPreview } from '../../project/compiler';
import { exportStaticBundle } from '../../preview/export';
import { startPreviewServer, type PreviewServerHandle } from '../../preview/server';

export interface PreviewOptions {
  watch?: boolean;
  open?: boolean;
  export?: string;
  offline?: boolean;
}

export async function runPreview(ctx: CliContext, options: PreviewOptions = {}): Promise<ExitCode> {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    if (options.export) {
      const doc = ctx.store.readDocument();
      const model = compileToPreview(doc);
      const indexPath = exportStaticBundle(model, options.export, { offline: options.offline });
      ctx.out.success({ exported: indexPath, offline: !!options.offline }, `Exported static preview bundle to ${indexPath}`);
      return EXIT_CODES.SUCCESS;
    }

    const handle: PreviewServerHandle = await startPreviewServer({ root: ctx.cwd, watch: options.watch });
    ctx.out.note(`Preview server running at ${handle.url} (Ctrl+C to stop)`);
    ctx.out.success({ url: handle.url, port: handle.port, watch: !!options.watch }, undefined);

    // Keep the process alive until interrupted.
    const { promise, resolve } = Promise.withResolvers<void>();
    const shutdown = () => {
      handle.close().then(() => resolve());
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    await promise;
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
