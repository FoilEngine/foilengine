// The game state, actions, events and views are pure JSON (ADR 0004).
// Use `type` aliases, not `interface`, so that they can be checked against `Json`.

export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };
