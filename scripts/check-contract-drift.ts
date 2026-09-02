import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SCHEMA_DIGESTS, COMMITTED_UPSTREAM_SHA } from '../src/contracts/provenance';

export function checkContractDrift(): { ok: boolean; mismatches: string[] } {
  const targetDir = path.join(process.cwd(), 'src', 'contracts', 'generated');
  const mismatches: string[] = [];

  for (const [filename, expectedDigest] of Object.entries(SCHEMA_DIGESTS)) {
    const filePath = path.join(targetDir, filename);
    if (!fs.existsSync(filePath)) {
      mismatches.push(`Missing snapshot file: ${filename}`);
      continue;
    }

    const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
    const actualDigest = createHash('sha256').update(content, 'utf8').digest('hex');

    if (actualDigest !== expectedDigest) {
      mismatches.push(
        `Digest mismatch for ${filename}: expected ${expectedDigest.slice(0, 12)}..., got ${actualDigest.slice(0, 12)}...`
      );
    }
  }

  return {
    ok: mismatches.length === 0,
    mismatches,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const result = checkContractDrift();
  if (!result.ok) {
    console.error(`[drift-check] FAILED — Contract drift detected against pinned commit ${COMMITTED_UPSTREAM_SHA}:`);
    for (const msg of result.mismatches) {
      console.error(`  - ${msg}`);
    }
    process.exit(1);
  }
  console.log(`[drift-check] OK — All snapshots match pinned commit ${COMMITTED_UPSTREAM_SHA}`);
}
