import type { IllegalReason } from '@foilengine/types';

/** An action refused by the rules. Callers should check `isLegal` first. */
export class IllegalActionError extends Error {
  override readonly name = 'IllegalActionError';
  readonly reason: IllegalReason;
  constructor(reason: IllegalReason) {
    super(`${reason.code}: ${reason.message}`);
    this.reason = reason;
  }
}

/** An impossible state: always a bug in the engine (docs/03-rules-engine.md). */
export class EngineInvariantError extends Error {
  override readonly name = 'EngineInvariantError';
}
