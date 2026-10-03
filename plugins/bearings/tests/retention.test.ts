import { expect, test } from 'claude-code/testing'

import type { GlossaryEntry } from '../types'
import { isNew, splitByRecency } from '../hooks/retention'

function seenAt(term: string, lastSeenTurn: number, pin: GlossaryEntry['pin'] = 'none'): GlossaryEntry {
  return { term, meaning: 'm', firstTurn: 1, lastSeenTurn, pin, source: 'auto' }
}

test('an entry stays in the main list for 30 turns after it was last seen, then folds into Earlier', () => {
  const entries = [seenAt('A', 10), seenAt('B', 11)]

  const atTurn39 = splitByRecency(entries, 39)
  expect(atTurn39.recent.map(one => one.term)).toEqual(['A', 'B'])

  const atTurn40 = splitByRecency(entries, 40)
  expect(atTurn40.recent.map(one => one.term)).toEqual(['B'])
  expect(atTurn40.earlier.map(one => one.term)).toEqual(['A'])
})

test('a pinned entry never folds', () => {
  const split = splitByRecency([seenAt('S', 1, 'session'), seenAt('P', 1, 'project')], 500)
  expect(split.earlier).toEqual([])
})

test('"new" means first seen in the last 3 turns, never inherited', () => {
  const entry = { firstTurn: 8, source: 'auto' }
  expect(isNew(entry, 10)).toBe(true)
  expect(isNew(entry, 11)).toBe(false)
  expect(isNew({ firstTurn: 0, source: 'inherited' }, 0)).toBe(false)
})
