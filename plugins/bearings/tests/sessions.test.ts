import { expect, test } from 'claude-code/testing'

import type { GlossaryEntry } from '../types'
import { emptyBearings } from '../hooks/merge'
import type { SavedSession } from '../hooks/persist'
import {
  activeOthers, coldStartMarkdown, coldStartNote, compactionMarkdown, COLD_START_HEADING, CONVERSATION_NOTE_LIMIT, mergeGlossaries, mergedGlossaryMarkdown, seedGlossary, summarize,
} from '../hooks/sessions'
import { emptyStats } from '../hooks/update'

const NOW = Date.parse('2026-10-03T12:00:00.000Z')
const HOUR = 60 * 60 * 1000

function term(name: string, meaning: string): GlossaryEntry {
  return { term: name, meaning, firstTurn: 1, lastSeenTurn: 1, pin: 'none', source: 'auto' }
}

function session(sessionId: string, hoursAgo: number, goal: string, glossary: GlossaryEntry[]): SavedSession {
  return {
    sessionId,
    cwd: '/w',
    startedAt: '',
    lastTouched: new Date(NOW - hoursAgo * HOUR).toISOString(),
    goal,
    turn: 3,
    glossary,
    bearings: { ...emptyBearings(), goal, inProgress: [`${goal}: working`], expectedNext: ['next step'] },
    btw: [],
    stats: emptyStats(),
  }
}

const alpha = session('aaaaaaaa-1111', 1, 'ship the mod', [term('FMA', 'failure mechanism analyzer'), term('S4', 'stage four')])
const beta = session('bbbbbbbb-2222', 5, 'fix the dashboard', [term('fma', 'Failure Mechanism Analyzer'), term('S4', 'the fourth sprint')])
const stale = session('cccccccc-3333', 49, 'an old thread', [term('OLD', 'only in the stale session')])

test('with two sessions, the glossary is a union and a term with two meanings shows both, tagged', () => {
  const merged = mergeGlossaries([alpha, beta])
  expect(merged.map(one => one.term)).toEqual(['FMA', 'S4'])
  expect(mergedGlossaryMarkdown(merged)).toBe(
    '- **FMA**: failure mechanism analyzer\n- **S4**: stage four [aaaaaaaa] | the fourth sprint [bbbbbbbb]',
  )
})

test('with three sessions, the one older than 48 h and this session itself are left out, newest first', () => {
  const others = activeOthers([stale, beta, alpha, session('own-session', 0, 'mine', [])], 'own-session', NOW)
  expect(others.map(one => one.sessionId)).toEqual(['aaaaaaaa-1111', 'bbbbbbbb-2222'])

  const markdown = coldStartMarkdown(others, NOW)
  expect(markdown.indexOf('### aaaaaaaa · 1 h ago · ship the mod')).toBeLessThan(markdown.indexOf('### bbbbbbbb · 5 h ago · fix the dashboard'))
  expect(markdown).toContain('- ship the mod: working')
  expect(markdown).not.toContain('cccccccc')
  expect(markdown).not.toContain('OLD')
})

test('the seeded glossary is marked inherited and keeps both meanings', () => {
  const seeded = seedGlossary(mergeGlossaries([alpha, beta]))
  expect(seeded[1]).toEqual({
    term: 'S4', meaning: 'stage four [aaaaaaaa] | the fourth sprint [bbbbbbbb]', firstTurn: 0, lastSeenTurn: 0, pin: 'none', source: 'inherited',
  })
})

test('after compaction: own Bearings, then one line per other session', () => {
  const markdown = compactionMarkdown('## Goal\nmine', [summarize(alpha)], NOW)
  expect(markdown).toBe('## Goal\nmine\n\n## Other sessions active in this folder\n\n- aaaaaaaa · 1 h ago · ship the mod\n')
  expect(compactionMarkdown('## Goal\nmine', [], NOW)).toBe('## Goal\nmine')
})

test('the cold start row: the heading and the merged view, capped; none when no other session is active', () => {
  const note = coldStartNote([alpha, beta], NOW) ?? ''
  expect(note.startsWith(`${COLD_START_HEADING}\n\n### aaaaaaaa · 1 h ago · ship the mod`)).toBe(true)
  expect(note).toContain('- **S4**: stage four [aaaaaaaa] | the fourth sprint [bbbbbbbb]')
  expect(coldStartNote([], NOW)).toBeNull()

  const wordy = session('dddddddd-4444', 1, 'x'.repeat(9000), [])
  expect((coldStartNote([wordy], NOW) ?? '').length).toBeLessThan(COLD_START_HEADING.length + CONVERSATION_NOTE_LIMIT + 100)
})
