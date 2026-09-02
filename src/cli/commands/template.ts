import { CliContext } from '../context';
import { EXIT_CODES, type ExitCode } from '../exit-codes';
import { handleCommandError } from '../error-handler';
import { BUILD_WITH_AK_TEMPLATES, instantiateTemplate, type TemplateId } from '../../contracts/templates';

export function runTemplateList(ctx: CliContext): ExitCode {
  const templates = BUILD_WITH_AK_TEMPLATES.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    recommendedFor: t.recommendedFor,
    blocks: t.blockTypes,
  }));
  if (ctx.out.isJson) {
    ctx.out.success(templates);
  } else {
    ctx.out.success(undefined, 'Available templates:');
    for (const t of templates) {
      ctx.out.success(undefined, `\n  ${t.id}\n    ${t.name} — ${t.description}\n    Blocks: ${t.blocks.join(' → ')}`);
    }
  }
  return EXIT_CODES.SUCCESS;
}

export function runTemplateApply(ctx: CliContext, templateId: string): ExitCode {
  try {
    if (!ctx.store.isInitialized()) {
      ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
      return EXIT_CODES.VALIDATION_ERROR;
    }
    const known = BUILD_WITH_AK_TEMPLATES.some((t) => t.id === templateId);
    if (!known) {
      ctx.out.failure(`Unknown template "${templateId}". Run "build-with-ak template list".`, 'UNKNOWN_TEMPLATE');
      return EXIT_CODES.VALIDATION_ERROR;
    }

    const doc = ctx.store.readDocument();
    const blocks = instantiateTemplate(templateId as TemplateId, {
      name: doc.listing.name || 'My Product',
      tagline: doc.listing.tagline || 'Built with AgentKit',
    });
    doc.blocks = blocks.map((b) => ({ id: b.id, order: b.order, content: b.content as Record<string, unknown> }));
    ctx.store.writeDocument(doc);

    ctx.out.success({ template: templateId, blockCount: doc.blocks.length }, `Applied template "${templateId}" (${doc.blocks.length} blocks).`);
    return EXIT_CODES.SUCCESS;
  } catch (error) {
    return handleCommandError(ctx.out, error);
  }
}
