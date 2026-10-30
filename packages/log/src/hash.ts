// A stable, portable 128-bit hash, in pure JavaScript (no node:crypto) so that replays can be
// checked in a browser too. Not a cryptographic hash: it detects divergences, it does not resist
// an attacker.

/** Murmur3 finalizer. */
function fmix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85eb_ca6b) >>> 0;
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2_ae35) >>> 0;
  x ^= x >>> 16;
  return x >>> 0;
}

/** Four independent FNV-1a lanes over the UTF-16 code units, each finalized: 32 hex characters. */
export function hash128(text: string): string {
  const lanes = [0x811c_9dc5, 0x2b99_2ddf, 0x9e37_79b9, 0x5bd1_e995];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    for (let lane = 0; lane < 4; lane++) {
      lanes[lane] = Math.imul((lanes[lane] as number) ^ (code + lane * 0x9e37), 0x0100_0193) >>> 0;
    }
  }
  return lanes
    .map((h, lane) =>
      fmix32(h ^ text.length ^ (lane << 24))
        .toString(16)
        .padStart(8, '0'),
    )
    .join('');
}
