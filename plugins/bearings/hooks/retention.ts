import type { Pin } from '../types'

/** An entry stays in the main list while it was seen within this many turns. */
export const RECENT_TURNS = 30

/** "New" in the band means first seen within this many turns. */
export const NEW_TURNS = 3

interface Seen {
  lastSeenTurn: number
  pin: Pin
}

/** Pinned entries always stay in the main list; the rest fold into "Earlier" after 30 turns unseen. */
export function isRecent(item: Seen, currentTurn: number): boolean {
  return item.pin !== 'none' || currentTurn - item.lastSeenTurn < RECENT_TURNS
}

export function splitByRecency<T extends Seen>(items: T[], currentTurn: number): { recent: T[]; earlier: T[] } {
  return {
    recent: items.filter(item => isRecent(item, currentTurn)),
    earlier: items.filter(item => !isRecent(item, currentTurn)),
  }
}

export function isNew(entry: { firstTurn: number; source: string }, currentTurn: number): boolean {
  return entry.source !== 'inherited' && currentTurn - entry.firstTurn < NEW_TURNS
}
