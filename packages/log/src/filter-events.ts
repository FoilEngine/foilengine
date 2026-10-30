// Events as one player may see them (ADR 0005, ADR 0006): a private event keeps its private
// fields only for the players it is visible to; the others get it redacted.

import {
  type GameEvent,
  type PlayerId,
  PRIVATE_EVENT_FIELDS,
  type RedactedEvent,
  type VisibleEvent,
} from '@foilengine/types';

export function filterEventFor(event: GameEvent, player: PlayerId): VisibleEvent {
  if (event.visibility.kind === 'public' || event.visibility.to.includes(player)) return event;
  const hidden: readonly string[] = PRIVATE_EVENT_FIELDS[event.type];
  const redacted = Object.fromEntries(
    Object.entries(event).filter(([key]) => !hidden.includes(key)),
  );
  return { ...redacted, redacted: true } as RedactedEvent;
}

export function filterEventsFor(events: readonly GameEvent[], player: PlayerId): VisibleEvent[] {
  return events.map((event) => filterEventFor(event, player));
}
