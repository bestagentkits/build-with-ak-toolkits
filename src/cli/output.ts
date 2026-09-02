import pc from 'picocolors';

export interface JsonEnvelope {
  ok: boolean;
  data?: unknown;
  error?: { message: string; code?: string; details?: unknown };
}

export interface OutputSink {
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

const defaultSink: OutputSink = {
  stdout: (line) => process.stdout.write(`${line}\n`),
  stderr: (line) => process.stderr.write(`${line}\n`),
};

/**
 * Structured CLI output writer. In `--json` mode every result is a single
 * `{ ok, data?, error? }` envelope on stdout; human diagnostics always go to
 * stderr so stdout stays parseable.
 */
export class OutputWriter {
  private readonly json: boolean;
  private readonly noColor: boolean;
  private readonly sink: OutputSink;

  constructor(options: { json?: boolean; noColor?: boolean; sink?: OutputSink } = {}) {
    this.json = options.json ?? false;
    this.noColor = options.noColor ?? !process.stdout.isTTY;
    this.sink = options.sink ?? defaultSink;
  }

  get isJson(): boolean {
    return this.json;
  }

  private paint(fn: (s: string) => string, text: string): string {
    return this.noColor ? text : fn(text);
  }

  /** Emit a successful result. In JSON mode this is the sole stdout line. */
  success(data: unknown, humanMessage?: string): void {
    if (this.json) {
      this.sink.stdout(JSON.stringify({ ok: true, data } satisfies JsonEnvelope));
      return;
    }
    if (humanMessage) this.sink.stdout(this.paint(pc.green, humanMessage));
    if (data !== undefined && typeof data !== 'boolean') {
      this.sink.stdout(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
    }
  }

  /** Emit an error result. In JSON mode this is the sole stdout line. */
  failure(message: string, code?: string, details?: unknown): void {
    if (this.json) {
      this.sink.stdout(JSON.stringify({ ok: false, error: { message, code, details } } satisfies JsonEnvelope));
      return;
    }
    this.sink.stderr(this.paint(pc.red, `✗ ${message}`));
  }

  info(message: string): void {
    if (this.json) return;
    this.sink.stderr(this.paint(pc.dim, message));
  }

  note(message: string): void {
    if (this.json) return;
    this.sink.stderr(this.paint(pc.cyan, message));
  }
}
