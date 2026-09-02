import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { instantiateTemplate, type TemplateId } from '../../contracts/templates';

export interface InitOptions {
  template?: TemplateId;
  env?: 'staging' | 'production';
  force?: boolean;
}

export function runInit(ctx: CliContext, options: InitOptions = {}): ExitCode {
  try {
    if (ctx.store.isInitialized() && !options.force) {
      ctx.out.failure(`Workspace already initialized at ${ctx.store.documentPath}. Use --force to overwrite.`, 'ALREADY_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const environment = options.env ?? ctx.resolveEnvironment();
    const doc = ctx.store.init({ environment, force: options.force });

    if (options.template) {
      const blocks = instantiateTemplate(options.template, {
        name: doc.listing.name || 'My Product',
        tagline: doc.listing.tagline || 'Built with AgentKit',
      });
      doc.blocks = blocks.map((b) => ({ id: b.id, order: b.order, content: b.content as Record<string, unknown> }));
      ctx.store.writeDocument(doc);
    }

    ctx.out.success(
      { documentPath: ctx.store.documentPath, environment, template: options.template ?? null, blockCount: doc.blocks.length },
      `Initialized build-with-ak workspace (${environment}).`
    );
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
