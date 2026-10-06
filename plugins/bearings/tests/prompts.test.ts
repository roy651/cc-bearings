import { expect, test } from 'claude-code/testing'

import { emptyBearings } from '../hooks/merge'
import type { Snapshot } from '../hooks/merge'
import { updatePrompt, UPDATE_SYSTEM } from '../hooks/prompts'

const snapshot: Snapshot = {
  glossary: [{ term: 'FMA', meaning: 'failure mechanism analyzer', firstTurn: 1, lastSeenTurn: 1, pin: 'none', source: 'auto' }],
  bearings: {
    ...emptyBearings(),
    goal: 'ship it',
    facts: [
      { text: 'seen at turn 11', lastSeenTurn: 11, pin: 'none', source: 'auto' },
      { text: 'seen at turn 10', lastSeenTurn: 10, pin: 'none', source: 'auto' },
      { text: 'pinned at turn 2', lastSeenTurn: 2, pin: 'session', source: 'auto' },
    ],
  },
}

function currentState(prompt: string): { glossaryTerms: string[]; bearings: { facts: string[]; olderFactCount: number } } {
  return JSON.parse(/<current>\n(.*)\n<\/current>/.exec(prompt)![1]!)
}

test('the update sends glossary term names without meanings', () => {
  const prompt = updatePrompt(snapshot, [], 40)
  expect(currentState(prompt).glossaryTerms).toEqual(['FMA'])
  expect(prompt).not.toContain('failure mechanism analyzer')
})

test('the update sends facts seen in the last 30 turns in full and counts the older ones', () => {
  const state = currentState(updatePrompt(snapshot, [], 40))
  expect(state.bearings.facts).toEqual(['seen at turn 11'])
  expect(state.bearings.olderFactCount).toBe(2)
})

test('the update rules ask for inProgress every time and cap two lists at 10', () => {
  expect(UPDATE_SYSTEM).toContain('always include "inProgress", restated from the newest turns even when it has not changed')
  expect(UPDATE_SYSTEM).toContain('"subGoals" and "expectedNext" hold at most 10 items each: drop items that are done and merge near-duplicates')
})
