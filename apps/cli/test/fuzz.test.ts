import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFuzz } from '../src/commands/fuzz.ts';

describe('foil fuzz', () => {
  it('plays the games and writes no reproduction when no invariant breaks', () => {
    const dir = mkdtempSync(join(tmpdir(), 'foil-fuzz-'));
    try {
      let progress = 0;
      const result = runFuzz({
        games: 3,
        seed: 1,
        reproDir: dir,
        onProgress: (n) => (progress = n),
      });
      expect(result).toMatchObject({ seed: 1, games: 3, violation: null, files: [] });
      expect(progress).toBe(3);
      expect(readdirSync(dir)).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);
});
