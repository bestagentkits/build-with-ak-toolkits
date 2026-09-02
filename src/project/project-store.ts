import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  authoringDocumentSchema,
  createEmptyDocument,
  type AuthoringDocument,
  type WorkspaceState,
} from './authoring-schema';

export const DOCUMENT_FILENAME = 'build-with-ak.json';
export const STATE_DIRNAME = '.build-with-ak';
export const STATE_FILENAME = 'state.json';
const GITIGNORE_ENTRY = `${STATE_DIRNAME}/`;

export interface InitOptions {
  environment: 'staging' | 'production';
  force?: boolean;
}

/**
 * Manages the local authoring workspace: the `build-with-ak.json` document and
 * the gitignored `.build-with-ak/state.json` CAS state. All writes are atomic
 * (temp sibling + rename) so an interrupted process never leaves corrupt JSON.
 */
export class ProjectStore {
  private readonly root: string;

  constructor(root: string = process.cwd()) {
    this.root = root;
  }

  get documentPath(): string {
    return path.join(this.root, DOCUMENT_FILENAME);
  }

  get statePath(): string {
    return path.join(this.root, STATE_DIRNAME, STATE_FILENAME);
  }

  isInitialized(): boolean {
    return fs.existsSync(this.documentPath);
  }

  init(options: InitOptions): AuthoringDocument {
    if (this.isInitialized() && !options.force) {
      throw new Error(`Workspace already initialized at ${this.documentPath}. Use force to overwrite.`);
    }
    const doc = createEmptyDocument(options.environment);
    this.writeDocument(doc);
    this.writeState({});
    this.ensureGitignore();
    return doc;
  }

  readDocument(): AuthoringDocument {
    if (!this.isInitialized()) {
      throw new Error(`No workspace found at ${this.documentPath}. Run "build-with-ak init" first.`);
    }
    const raw = fs.readFileSync(this.documentPath, 'utf8');
    return authoringDocumentSchema.parse(JSON.parse(raw));
  }

  writeDocument(doc: AuthoringDocument): void {
    const validated = authoringDocumentSchema.parse(doc);
    this.atomicWrite(this.documentPath, `${JSON.stringify(validated, null, 2)}\n`);
  }

  readState(): WorkspaceState {
    if (!fs.existsSync(this.statePath)) {
      return {};
    }
    const raw = fs.readFileSync(this.statePath, 'utf8');
    return JSON.parse(raw) as WorkspaceState;
  }

  writeState(state: WorkspaceState): void {
    const dir = path.dirname(this.statePath);
    fs.mkdirSync(dir, { recursive: true });
    this.atomicWrite(this.statePath, `${JSON.stringify(state, null, 2)}\n`);
  }

  private ensureGitignore(): void {
    const gitignorePath = path.join(this.root, '.gitignore');
    let content = '';
    if (fs.existsSync(gitignorePath)) {
      content = fs.readFileSync(gitignorePath, 'utf8');
      const alreadyIgnored = content.split('\n').some((line) => line.trim() === GITIGNORE_ENTRY);
      if (alreadyIgnored) return;
      if (content.length > 0 && !content.endsWith('\n')) content += '\n';
    }
    content += `${GITIGNORE_ENTRY}\n`;
    fs.writeFileSync(gitignorePath, content, 'utf8');
  }

  private atomicWrite(target: string, data: string): void {
    const dir = path.dirname(target);
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, `.${path.basename(target)}.${process.pid}.${Date.now()}.tmp`);
    fs.writeFileSync(tmp, data, 'utf8');
    fs.renameSync(tmp, target);
  }
}
