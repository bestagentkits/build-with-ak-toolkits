import { BuildWithAkClient, type BuildWithAkEnvironment } from '../client/client';
import { ProjectStore } from '../project/project-store';
import { OutputWriter } from './output';

export interface ClientFactoryConfig {
  apiKey: string;
  environment: BuildWithAkEnvironment;
  capabilities?: { targetExtensions?: boolean };
}

export type ClientFactory = (config: ClientFactoryConfig) => BuildWithAkClient;

export interface CliContextOptions {
  cwd?: string;
  json?: boolean;
  noColor?: boolean;
  apiKey?: string;
  environment?: BuildWithAkEnvironment;
  clientFactory?: ClientFactory;
  output?: OutputWriter;
}

/**
 * Shared execution context threaded through every CLI command: working
 * directory, output writer, workspace store, and a lazily-constructed API
 * client. `clientFactory` is injectable so command handlers are unit-testable
 * without real network access.
 */
export class CliContext {
  readonly cwd: string;
  readonly out: OutputWriter;
  readonly store: ProjectStore;
  private readonly explicitApiKey?: string;
  private readonly explicitEnv?: BuildWithAkEnvironment;
  private readonly clientFactory: ClientFactory;

  constructor(options: CliContextOptions = {}) {
    this.cwd = options.cwd ?? process.cwd();
    this.out = options.output ?? new OutputWriter({ json: options.json, noColor: options.noColor });
    this.store = new ProjectStore(this.cwd);
    this.explicitApiKey = options.apiKey;
    this.explicitEnv = options.environment;
    this.clientFactory = options.clientFactory ?? ((config) => new BuildWithAkClient(config));
  }

  resolveEnvironment(): BuildWithAkEnvironment {
    if (this.explicitEnv) return this.explicitEnv;
    const fromEnv = process.env.AGENTKIT_ENV;
    if (fromEnv === 'staging' || fromEnv === 'production') return fromEnv;
    if (this.store.isInitialized()) {
      return this.store.readDocument().environment;
    }
    return 'production';
  }

  resolveTargetExtensions(): boolean {
    return process.env.AGENTKIT_TARGET_EXTENSIONS === '1';
  }

  resolveApiKey(): string {
    const key = this.explicitApiKey ?? process.env.AGENTKIT_API_KEY;
    if (!key) {
      throw new Error(
        'Missing API key. Set AGENTKIT_API_KEY (ck_live_...) or pass --api-key. Generate one from your Customer Dashboard at agentkit.best.'
      );
    }
    return key;
  }

  createClient(capabilities?: { targetExtensions?: boolean }): BuildWithAkClient {
    return this.clientFactory({
      apiKey: this.resolveApiKey(),
      environment: this.resolveEnvironment(),
      capabilities,
    });
  }
}
