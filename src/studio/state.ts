import { randomUUID } from 'node:crypto';
import type { AuthoringDocument, AuthoringBlock, AuthoringListing } from '../project/authoring-schema';

export type ConflictResolution = 'load_remote' | 'keep_mine' | 'manual';

export interface StudioConflict {
  remoteRevisionId?: string;
  localBaseRevisionId?: string;
}

/**
 * In-memory studio state manager: mutates a working copy of the authoring
 * document, tracks the dirty flag, and pauses autosave while a CAS (409)
 * conflict is unresolved. Fully synchronous and unit-testable — the TUI shell
 * renders from this state and forwards keystrokes into these methods.
 */
export class StudioState {
  private doc: AuthoringDocument;
  private dirty = false;
  private conflict: StudioConflict | undefined;

  constructor(doc: AuthoringDocument) {
    this.doc = { ...doc, blocks: doc.blocks.map((b) => ({ ...b })), media: { ...doc.media } };
  }

  get blocks(): AuthoringBlock[] {
    return this.doc.blocks;
  }

  get listing(): AuthoringListing {
    return this.doc.listing;
  }

  get isDirty(): boolean {
    return this.dirty;
  }

  get hasConflict(): boolean {
    return this.conflict !== undefined;
  }

  get autosavePaused(): boolean {
    return this.hasConflict;
  }

  get conflictInfo(): StudioConflict | undefined {
    return this.conflict;
  }

  private renumber(): void {
    this.doc.blocks.forEach((block, index) => {
      block.order = index;
    });
  }

  patchListing(patch: Partial<AuthoringListing>): void {
    this.doc.listing = { ...this.doc.listing, ...patch };
    this.dirty = true;
  }

  addBlock(content: Record<string, unknown>): AuthoringBlock {
    const block: AuthoringBlock = { id: randomUUID(), order: this.doc.blocks.length, content };
    this.doc.blocks.push(block);
    this.renumber();
    this.dirty = true;
    return block;
  }

  insertBlock(index: number, content: Record<string, unknown>): AuthoringBlock {
    const block: AuthoringBlock = { id: randomUUID(), order: index, content };
    const clamped = Math.max(0, Math.min(index, this.doc.blocks.length));
    this.doc.blocks.splice(clamped, 0, block);
    this.renumber();
    this.dirty = true;
    return block;
  }

  patchBlock(id: string, patch: { content?: Record<string, unknown>; order?: number }): boolean {
    const index = this.doc.blocks.findIndex((b) => b.id === id);
    if (index === -1) return false;
    const block = this.doc.blocks[index];
    if (patch.content) block.content = { ...block.content, ...patch.content };
    if (patch.order !== undefined && patch.order !== index) {
      const [moved] = this.doc.blocks.splice(index, 1);
      const target = Math.max(0, Math.min(patch.order, this.doc.blocks.length));
      this.doc.blocks.splice(target, 0, moved);
      this.renumber();
    }
    this.dirty = true;
    return true;
  }

  removeBlock(id: string): boolean {
    const before = this.doc.blocks.length;
    this.doc.blocks = this.doc.blocks.filter((b) => b.id !== id);
    if (this.doc.blocks.length === before) return false;
    this.renumber();
    this.dirty = true;
    return true;
  }

  duplicateBlock(id: string): AuthoringBlock | undefined {
    const index = this.doc.blocks.findIndex((b) => b.id === id);
    if (index === -1) return undefined;
    const source = this.doc.blocks[index];
    const copy: AuthoringBlock = {
      id: randomUUID(),
      order: index + 1,
      content: JSON.parse(JSON.stringify(source.content)),
    };
    this.doc.blocks.splice(index + 1, 0, copy);
    this.renumber();
    this.dirty = true;
    return copy;
  }

  /** Move a block up or down one position, preserving contiguous order. */
  moveBlock(id: string, direction: 'up' | 'down'): boolean {
    const index = this.doc.blocks.findIndex((b) => b.id === id);
    if (index === -1) return false;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= this.doc.blocks.length) return false;
    const [block] = this.doc.blocks.splice(index, 1);
    this.doc.blocks.splice(target, 0, block);
    this.renumber();
    this.dirty = true;
    return true;
  }

  /** Enter conflict mode after a 409 CAS conflict; autosave pauses until resolved. */
  markConflict(conflict: StudioConflict): void {
    this.conflict = conflict;
  }

  resolveConflict(resolution: ConflictResolution, remoteDoc?: AuthoringDocument): void {
    if (resolution === 'load_remote' && remoteDoc) {
      this.doc = { ...remoteDoc, blocks: remoteDoc.blocks.map((b) => ({ ...b })), media: { ...remoteDoc.media } };
      this.dirty = false;
    }
    // keep_mine and manual retain the local working copy; dirty stays as-is.
    this.conflict = undefined;
  }

  markSaved(): void {
    this.dirty = false;
  }

  toDocument(): AuthoringDocument {
    this.renumber();
    return { ...this.doc, blocks: this.doc.blocks.map((b) => ({ ...b })), media: { ...this.doc.media } };
  }
}
