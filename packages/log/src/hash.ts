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
  // The four lanes are unrolled: this loop runs over every character of every fingerprint.
  let h0 = 0x811c_9dc5;
  let h1 = 0x2b99_2ddf;
  let h2 = 0x9e37_79b9;
  let h3 = 0x5bd1_e995;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    h0 = Math.imul(h0 ^ code, 0x0100_0193);
    h1 = Math.imul(h1 ^ (code + 0x9e37), 0x0100_0193);
    h2 = Math.imul(h2 ^ (code + 2 * 0x9e37), 0x0100_0193);
    h3 = Math.imul(h3 ^ (code + 3 * 0x9e37), 0x0100_0193);
  }
  const hex = (h: number, lane: number) =>
    fmix32(h ^ text.length ^ (lane << 24))
      .toString(16)
      .padStart(8, '0');
  return hex(h0, 0) + hex(h1, 1) + hex(h2, 2) + hex(h3, 3);
}
