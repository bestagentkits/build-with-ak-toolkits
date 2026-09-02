import * as readline from 'node:readline';
import pc from 'picocolors';
import { CliContext } from '../cli/context';
import { StudioState } from './state';
import { submissionReadinessSchema } from '../contracts/listing';
import { buildWireCandidate } from '../project/compiler';

function maskKey(key: string): string {
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 8)}••••${key.slice(-4)}`;
}

function renderHeader(ctx: CliContext, state: StudioState): string {
  const env = ctx.resolveEnvironment();
  let maskedKey = 'no-key';
  try {
    maskedKey = maskKey(ctx.resolveApiKey());
  } catch {
    maskedKey = 'no-key';
  }
  const dirty = state.isDirty ? pc.yellow('● unsaved') : pc.green('✓ saved');
  const conflict = state.hasConflict ? pc.red(' ⚠ CAS CONFLICT (autosave paused)') : '';
  return [
    pc.bold('Build with AK — Terminal Studio'),
    `  env: ${env}   key: ${maskedKey}   ${dirty}${conflict}`,
    `  listing: ${state.listing.name || '(unnamed)'}   blocks: ${state.blocks.length}`,
  ].join('\n');
}

function renderBlocks(state: StudioState): string {
  if (state.blocks.length === 0) return pc.dim('  (no blocks — press "a" to add one)');
  return state.blocks
    .map((b, i) => `  ${String(i).padStart(2, ' ')}. ${pc.cyan(String(b.content.type ?? 'unknown'))}  ${pc.dim(b.id.slice(0, 8))}`)
    .join('\n');
}

const HELP = `
Keys:
  ↑/↓ or j/k  navigate blocks     a  add block        d  delete block
  x/z         move down/up        v  validate         p  print preview URL hint
  s           save workspace      q  quit
`;

export interface StudioAppOptions {
  input?: NodeJS.ReadableStream & { setRawMode?: (mode: boolean) => void };
  output?: NodeJS.WritableStream;
}

/**
 * Launch the interactive keyboard-driven Terminal Studio. Renders the current
 * workspace state and forwards keystrokes into the StudioState machine. Lazy
 * loaded by the CLI so non-studio commands stay fast.
 */
export function runStudio(ctx: CliContext, options: StudioAppOptions = {}): Promise<number> {
  const input = options.input ?? process.stdin;
  const output = options.output ?? process.stdout;

  if (!ctx.store.isInitialized()) {
    ctx.out.failure('No workspace found. Run "build-with-ak init" first.', 'NOT_INITIALIZED');
    return Promise.resolve(2);
  }

  const doc = ctx.store.readDocument();
  const state = new StudioState(doc);
  let cursor = 0;
  let statusLine = '';

  const write = (s: string) => output.write(s);
  const clear = () => write('\x1b[2J\x1b[H');

  const paint = () => {
    clear();
    write(`${renderHeader(ctx, state)}\n\n`);
    write(`${renderBlocks(state)}\n`);
    write(`${pc.dim(HELP)}\n`);
    if (state.blocks[cursor]) {
      write(pc.dim(`  > selected: ${state.blocks[cursor].id}\n`));
    }
    if (statusLine) write(`${statusLine}\n`);
  };

  readline.emitKeypressEvents(input as NodeJS.ReadableStream);
  if (input.setRawMode) input.setRawMode(true);

  const { promise, resolve } = Promise.withResolvers<number>();

  const cleanup = (code: number) => {
    if (input.setRawMode) input.setRawMode(false);
    input.removeListener('keypress', onKey);
    resolve(code);
  };

  function onKey(_str: string, key: readline.Key): void {
    if (!key) return;
    const name = key.name ?? '';
    statusLine = '';

    if (name === 'q' || (key.ctrl && name === 'c')) {
      cleanup(0);
      return;
    }
    if (name === 'up' || name === 'k') cursor = Math.max(0, cursor - 1);
    else if (name === 'down' || name === 'j') cursor = Math.min(Math.max(0, state.blocks.length - 1), cursor + 1);
    else if (name === 'a') {
      state.addBlock({ type: 'outbound_cta', label: 'New CTA' });
      cursor = state.blocks.length - 1;
    } else if (name === 'd') {
      const block = state.blocks[cursor];
      if (block) {
        state.removeBlock(block.id);
        cursor = Math.min(cursor, Math.max(0, state.blocks.length - 1));
      }
    } else if (name === 'x') {
      const block = state.blocks[cursor];
      if (block && state.moveBlock(block.id, 'down')) cursor = Math.min(state.blocks.length - 1, cursor + 1);
    } else if (name === 'z') {
      const block = state.blocks[cursor];
      if (block && state.moveBlock(block.id, 'up')) cursor = Math.max(0, cursor - 1);
    } else if (name === 's') {
      ctx.store.writeDocument(state.toDocument());
      state.markSaved();
      statusLine = pc.green('  saved workspace');
    } else if (name === 'v') {
      try {
        const readiness = submissionReadinessSchema.safeParse(buildWireCandidate(state.toDocument()));
        statusLine = readiness.success
          ? pc.green('  ✓ submission ready')
          : pc.yellow(`  ${readiness.error.issues.length} readiness issue(s) — run "build-with-ak validate --ready"`);
      } catch (error) {
        statusLine = pc.yellow(`  ${error instanceof Error ? error.message : 'validation error'}`);
      }
    } else if (name === 'p') {
      statusLine = pc.cyan('  preview: run "build-with-ak preview --watch" in this workspace');
    }

    paint();
  }

  input.on('keypress', onKey);
  paint();

  return promise;
}
