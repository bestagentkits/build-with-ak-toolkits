import { describe, it, expect } from 'vitest';
import { checkContractDrift } from '../../scripts/check-contract-drift';
import { COMMITTED_UPSTREAM_SHA, SCHEMA_DIGESTS } from '../../src/contracts/provenance';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Phase 0: Contract Provenance & Drift Gate', () => {
  it('pins the exact commit SHA 500fe6ef7a7974acf235c84ad0ebb2f28fb5747c', () => {
    expect(COMMITTED_UPSTREAM_SHA).toBe('500fe6ef7a7974acf235c84ad0ebb2f28fb5747c');
  });

  it('verifies all generated contract snapshots match their SHA-256 digests', () => {
    const result = checkContractDrift();
    expect(result.ok).toBe(true);
    expect(result.mismatches).toHaveLength(0);
  });

  it('contains all required snapshot files', () => {
    const required = [
      'constants.ts',
      'blocks-schema.ts',
      'validation.ts',
      'slug.ts',
      'media-contract.ts',
    ];
    for (const file of required) {
      expect(SCHEMA_DIGESTS).toHaveProperty(file);
      const filePath = path.join(process.cwd(), 'src', 'contracts', 'generated', file);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
