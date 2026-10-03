import { expect, test } from 'claude-code/testing'
import type { ModelUsage } from 'claude-code'

import { emptyBearings } from '../hooks/merge'
import type { Snapshot } from '../hooks/merge'
import { applyUpdateReply, emptyStats } from '../hooks/update'

const usage: ModelUsage = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 10 }

const before: Snapshot = {
  glossary: [{ term: 'FMA', meaning: 'failure mechanism analyzer', firstTurn: 1, lastSeenTurn: 1, pin: 'none', source: 'auto' }],
  bearings: { ...emptyBearings(), goal: 'ship the mod' },
}

test('a malformed reply keeps the state and counts one failure', () => {
  const outcome = applyUpdateReply(before, emptyStats(), { isAnswered: true, text: 'Sure! Here is the delta: {not json', usage }, 2)
  expect(outcome.snapshot).toBe(before)
  expect(outcome.failure).not.toBeNull()
  expect(outcome.stats).toEqual({ calls: 1, failures: 1, inputTokens: 110, outputTokens: 20, cacheReadTokens: 5 })
})

test('an unanswered call keeps the state and counts one failure', () => {
  const outcome = applyUpdateReply(before, emptyStats(), { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage }, 2)
  expect(outcome.snapshot).toBe(before)
  expect(outcome.failure).toBe('api-error 529 overloaded')
  expect(outcome.stats.failures).toBe(1)
})

test('nothing to fork made no request: no call, no failure counted', () => {
  const outcome = applyUpdateReply(before, emptyStats(), { isAnswered: false, reason: 'nothing-to-fork' }, 2)
  expect(outcome.snapshot).toBe(before)
  expect(outcome.stats).toEqual(emptyStats())
})

test('a good reply is applied and counted as a call without failure', () => {
  const reply = '{"glossary":{"upsert":[{"term":"BME","meaning":"behavioral model extractor"}],"seen":["FMA"]},"bearings":{"inProgress":["writing tests"]}}'
  const outcome = applyUpdateReply(before, emptyStats(), { isAnswered: true, text: reply, usage }, 4)
  expect(outcome.failure).toBeNull()
  expect(outcome.snapshot.glossary.map(one => [one.term, one.lastSeenTurn])).toEqual([['FMA', 4], ['BME', 4]])
  expect(outcome.snapshot.bearings?.inProgress).toEqual(['writing tests'])
  expect(outcome.stats).toEqual({ calls: 1, failures: 0, inputTokens: 110, outputTokens: 20, cacheReadTokens: 5 })
})
