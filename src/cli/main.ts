#!/usr/bin/env node
import { Command } from 'commander';
import { CliContext, type CliContextOptions } from './context';
import type { BuildWithAkEnvironment } from '../client/client';
import { runInit } from './commands/init';
import { runTemplateList, runTemplateApply } from './commands/template';
import { runSlugCheck } from './commands/slug';
import { runMediaList, runMediaUpload } from './commands/media';
import { runPull } from './commands/pull';
import { runValidate } from './commands/validate';
import { runDiff } from './commands/diff';
import { runPreview } from './commands/preview';
import { runPush } from './commands/push';
import { runSubmit } from './commands/submit';
import type { TemplateId } from '../contracts/templates';
import type { MediaKind } from '../client/client';

interface GlobalOptions {
  json?: boolean;
  color?: boolean;
  apiKey?: string;
  env?: BuildWithAkEnvironment;
}

function contextFrom(command: Command): CliContext {
  const opts = command.optsWithGlobals() as GlobalOptions;
  const options: CliContextOptions = {
    json: opts.json,
    noColor: opts.color === false,
    apiKey: opts.apiKey,
    environment: opts.env,
  };
  return new CliContext(options);
}

export function buildProgram(): Command {
  const program = new Command();

  program
    .name('build-with-ak')
    .description('CLI for submitting and customizing showcase layouts on Build with AK (agentkit.best)')
    .version('1.0.0')
    .option('--json', 'emit machine-readable JSON output')
    .option('--no-color', 'disable colored output')
    .option('--api-key <key>', 'AgentKit customer API key (ck_live_...) — overrides AGENTKIT_API_KEY')
    .option('--env <environment>', 'target environment: staging | production');

  program
    .command('init')
    .description('scaffold a local build-with-ak workspace')
    .option('--template <id>', 'seed with a layout template')
    .option('--env <environment>', 'staging | production')
    .option('--force', 'overwrite an existing workspace')
    .action((opts, command: Command) => {
      const code = runInit(contextFrom(command), { template: opts.template as TemplateId, env: opts.env, force: opts.force });
      process.exitCode = code;
    });

  const template = program.command('template').description('manage layout templates');
  template
    .command('list')
    .description('list the 5 curated templates')
    .action((_opts, command: Command) => {
      process.exitCode = runTemplateList(contextFrom(command));
    });
  template
    .command('apply <id>')
    .description('apply a template blueprint to the current draft')
    .action((id: string, _opts, command: Command) => {
      process.exitCode = runTemplateApply(contextFrom(command), id);
    });

  const slug = program.command('slug').description('slug utilities');
  slug
    .command('check <slug>')
    .description('check real-time slug availability with suggestions')
    .action(async (value: string, _opts, command: Command) => {
      process.exitCode = await runSlugCheck(contextFrom(command), value);
    });

  const media = program.command('media').description('media asset management');
  media
    .command('list')
    .description("query the customer's finalized asset library")
    .option('--kind <kind>', 'filter by kind: logo | cover | screenshot')
    .action(async (opts, command: Command) => {
      process.exitCode = await runMediaList(contextFrom(command), { kind: opts.kind as MediaKind });
    });
  media
    .command('upload <file>')
    .description('run the 3-step R2 upload pipeline and output the assetId')
    .requiredOption('--kind <kind>', 'logo | cover | screenshot')
    .option('--ref <ref>', 'workspace media reference key')
    .action(async (file: string, opts, command: Command) => {
      process.exitCode = await runMediaUpload(contextFrom(command), file, { kind: opts.kind as MediaKind, ref: opts.ref });
    });

  program
    .command('pull')
    .description('pull the remote listing and blocks into the local workspace')
    .action(async (_opts, command: Command) => {
      process.exitCode = await runPull(contextFrom(command));
    });

  program
    .command('validate')
    .description('validate the local draft (permissive by default; --ready for submission readiness)')
    .option('--ready', 'run strict submission-readiness validation')
    .action((opts, command: Command) => {
      process.exitCode = runValidate(contextFrom(command), { ready: opts.ready });
    });

  program
    .command('diff')
    .description('semantic diff between local draft and remote')
    .action(async (_opts, command: Command) => {
      process.exitCode = await runDiff(contextFrom(command));
    });

  program
    .command('preview')
    .description('launch the live preview server or export a static bundle')
    .option('--watch', 'enable live-reload on file changes')
    .option('--open', 'open the preview in a browser')
    .option('--export <dir>', 'export a static HTML bundle to a directory')
    .option('--offline', 'strict offline CSP for exported bundles')
    .action(async (opts, command: Command) => {
      process.exitCode = await runPreview(contextFrom(command), {
        watch: opts.watch,
        open: opts.open,
        export: opts.export,
        offline: opts.offline,
      });
    });

  program
    .command('push')
    .description('atomic CAS push of the full draft (PUT /listing)')
    .option('--yes', 'skip confirmation')
    .action(async (opts, command: Command) => {
      process.exitCode = await runPush(contextFrom(command), { yes: opts.yes });
    });

  program
    .command('submit')
    .description('frozen submission for moderation (POST /submit)')
    .option('--yes', 'confirm submission')
    .action(async (opts, command: Command) => {
      process.exitCode = await runSubmit(contextFrom(command), { yes: opts.yes });
    });

  program
    .command('studio')
    .description('launch the interactive Terminal Studio')
    .action(async (_opts, command: Command) => {
      // Lazy-load: the Studio pulls in readline/TUI rendering that non-studio
      // commands (validate, push) must not pay for on cold start.
      const { runStudio } = await import('../studio/app.js');
      process.exitCode = await runStudio(contextFrom(command));
    });

  return program;
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const program = buildProgram();
  await program.parseAsync(argv);
}

// Direct execution entrypoint (bin).
const isDirectRun = (() => {
  const invoked = process.argv[1] ?? '';
  return invoked.includes('build-with-ak') || invoked.endsWith('main.js') || invoked.endsWith('main.ts');
})();

if (isDirectRun) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
