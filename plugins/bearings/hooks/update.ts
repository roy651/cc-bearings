import type { ModelForkResult, ModelUsage } from 'claude-code'

import type { UpdateStats } from '../types'
import { applyDelta, applyScanDelta, parseDelta } from './merge'
import type { Delta, Snapshot } from './merge'
import { pruneStale } from './retention'

export function emptyStats(): UpdateStats {
  return { calls: 0, failures: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0 }
}

/** Input counts both the uncached tokens and those written to the cache: both are billed as fresh input. */
export function addUsage(stats: UpdateStats, usage: ModelUsage, isFailure: boolean): UpdateStats {
  return {
    calls: stats.calls + 1,
    failures: stats.failures + (isFailure ? 1 : 0),
    inputTokens: stats.inputTokens + usage.input_tokens + usage.cache_creation_input_tokens,
    outputTokens: stats.outputTokens + usage.output_tokens,
    cacheReadTokens: stats.cacheReadTokens + usage.cache_read_input_tokens,
  }
}

/** Why a model call left no text, in a few words. */
export function describeFailure(reply: Exclude<ModelForkResult, { isAnswered: true }>): string {
  if (reply.reason === 'api-error') return `api-error ${reply.status ?? 'no status'} ${reply.error}`
  return reply.reason
}

export interface ReplyOutcome {
  snapshot: Snapshot
  stats: UpdateStats
  /** Why the state was left unchanged, or null when the reply was applied. */
  failure: string | null
}

/**
 * Turns a model reply into the next state. A call that did not answer, or an answer
 * that does not parse, leaves the snapshot as it was and counts one failure.
 * `merge` says how a parsed reply joins the current state.
 */
function applyReply(
  snapshot: Snapshot,
  stats: UpdateStats,
  reply: ModelForkResult,
  merge: (delta: Delta) => Snapshot,
): ReplyOutcome {
  if (!reply.isAnswered) {
    // nothing-to-fork made no request, so it costs nothing and is no call.
    const nextStats = reply.reason === 'nothing-to-fork' ? stats : addUsage(stats, reply.usage, true)
    return { snapshot, stats: nextStats, failure: describeFailure(reply) }
  }

  const delta = parseDelta(reply.text)
  if ('error' in delta) {
    return { snapshot, stats: addUsage(stats, reply.usage, true), failure: delta.error }
  }
  return { snapshot: merge(delta), stats: addUsage(stats, reply.usage, false), failure: null }
}

export function applyUpdateReply(snapshot: Snapshot, stats: UpdateStats, reply: ModelForkResult, turn: number): ReplyOutcome {
  return applyReply(snapshot, stats, reply, delta => applyDelta(snapshot, delta, turn))
}

/** The background update after each turn: the reply applied, then the stale automatic items pruned. */
export function applyBackgroundUpdate(
  snapshot: Snapshot,
  stats: UpdateStats,
  reply: ModelForkResult,
  turn: number,
  knownTerms: readonly string[],
): ReplyOutcome {
  const outcome = applyUpdateReply(snapshot, stats, reply, turn)
  if (outcome.failure !== null) return outcome
  return { ...outcome, snapshot: pruneStale(outcome.snapshot, turn, knownTerms) }
}

export function applyScanReply(snapshot: Snapshot, stats: UpdateStats, reply: ModelForkResult, turn: number): ReplyOutcome {
  return applyReply(snapshot, stats, reply, delta => applyScanDelta(snapshot, delta, turn))
}

/** How much of a failed reply's text its log line keeps. */
export const FAILURE_EXCERPT_LIMIT = 300

/** One line of the failure log: when, the turn, which call, why, the output tokens and the reply's start. */
export function failureLogLine(at: string, what: string, turn: number, failure: string, reply: ModelForkResult): string {
  const outputTokens = 'usage' in reply ? ` out=${reply.usage.output_tokens}` : ''
  const text = reply.isAnswered ? reply.text.replace(/\s+/g, ' ').trim() : ''
  const excerpt = text === '' ? '' : ` excerpt: ${text.slice(0, FAILURE_EXCERPT_LIMIT)}`
  return `${at} T${turn} ${what} failed: ${failure}${outputTokens}${excerpt}`
}
