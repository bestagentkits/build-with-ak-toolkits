import { describe, it, expect } from 'vitest';
import { StudioState } from '../../src/studio/state';
import { createEmptyDocument } from '../../src/project/authoring-schema';

function seededState(): StudioState {
  const doc = createEmptyDocument('staging');
  const state = new StudioState(doc);
  state.addBlock({ type: 'hero_banner', title: 'A', tagline: 'a', badges: [] });
  state.addBlock({ type: 'tech_stack', tags: ['x'] });
  state.addBlock({ type: 'outbound_cta', label: 'Go' });
  state.markSaved();
  return state;
}

describe('Phase 4: Terminal Studio State', () => {
  it('adds blocks with contiguous order and marks dirty', () => {
    const state = seededState();
    expect(state.blocks).toHaveLength(3);
    expect(state.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
    expect(state.isDirty).toBe(false);

    state.addBlock({ type: 'maker_quote', quote: 'q', attribution: 'a', quoteSource: 's' });
    expect(state.blocks).toHaveLength(4);
    expect(state.blocks[3].order).toBe(3);
    expect(state.isDirty).toBe(true);
  });

  it('patches a block content', () => {
    const state = seededState();
    const id = state.blocks[0].id;
    expect(state.patchBlock(id, { content: { title: 'Renamed' } })).toBe(true);
    expect(state.blocks[0].content.title).toBe('Renamed');
    expect(state.blocks[0].content.type).toBe('hero_banner'); // merge preserves type
  });

  it('applies patch.order by moving the block and renumbering', () => {
    const state = seededState();
    const firstId = state.blocks[0].id;
    expect(state.patchBlock(firstId, { order: 2 })).toBe(true);
    expect(state.blocks[2].id).toBe(firstId);
    expect(state.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it('reorders blocks preserving contiguous order', () => {
    const state = seededState();
    const firstId = state.blocks[0].id;
    expect(state.moveBlock(firstId, 'down')).toBe(true);
    expect(state.blocks[1].id).toBe(firstId);
    expect(state.blocks.map((b) => b.order)).toEqual([0, 1, 2]);
  });

  it('does not move the top block up or the bottom block down', () => {
    const state = seededState();
    expect(state.moveBlock(state.blocks[0].id, 'up')).toBe(false);
    expect(state.moveBlock(state.blocks[2].id, 'down')).toBe(false);
  });

  it('duplicates a block with a fresh unique id', () => {
    const state = seededState();
    const source = state.blocks[0];
    const copy = state.duplicateBlock(source.id);
    expect(copy).toBeDefined();
    expect(copy?.id).not.toBe(source.id);
    expect(state.blocks).toHaveLength(4);
    expect(state.blocks[1].id).toBe(copy?.id);
  });

  it('deletes a block and renumbers', () => {
    const state = seededState();
    const targetId = state.blocks[1].id;
    expect(state.removeBlock(targetId)).toBe(true);
    expect(state.blocks).toHaveLength(2);
    expect(state.blocks.map((b) => b.order)).toEqual([0, 1]);
    expect(state.blocks.some((b) => b.id === targetId)).toBe(false);
  });

  it('pauses autosave on a 409 CAS conflict and resumes after resolution', () => {
    const state = seededState();
    expect(state.autosavePaused).toBe(false);

    state.markConflict({ remoteRevisionId: 'rev-remote', localBaseRevisionId: 'rev-local' });
    expect(state.hasConflict).toBe(true);
    expect(state.autosavePaused).toBe(true);
    expect(state.conflictInfo?.remoteRevisionId).toBe('rev-remote');

    state.resolveConflict('keep_mine');
    expect(state.hasConflict).toBe(false);
    expect(state.autosavePaused).toBe(false);
  });

  it('load_remote resolution replaces the working copy and clears dirty', () => {
    const state = seededState();
    state.addBlock({ type: 'tech_stack', tags: ['dirty'] });
    expect(state.isDirty).toBe(true);

    const remote = createEmptyDocument('staging');
    remote.listing.name = 'Remote Wins';
    state.markConflict({ remoteRevisionId: 'r' });
    state.resolveConflict('load_remote', remote);

    expect(state.listing.name).toBe('Remote Wins');
    expect(state.blocks).toHaveLength(0);
    expect(state.isDirty).toBe(false);
  });
});
