import type { Bearings, GlossaryEntry, SessionSummary } from '../types'
import { capText, relativeTime } from './markdown'
import { sameText } from './merge'
import type { SavedSession } from './persist'

/** The Markdown in a row handed to the model is capped at this length. */
export const CONVERSATION_NOTE_LIMIT = 6000

export const COLD_START_HEADING =
  'Other sessions active in this folder in the last 48 h (they may be unrelated to this session\'s task):'
export const COMPACTION_HEADING = 'Bearings at compaction:'

/** A session counts as active in its folder while its file was touched within this many hours. */
export const ACTIVE_HOURS = 48

/** Sessions touched within the last 48 hours, newest first, leaving out `exceptSessionId` (this session). */
export function activeOthers(sessions: SavedSession[], exceptSessionId: string, nowMs: number): SavedSession[] {
  const cutoff = nowMs - ACTIVE_HOURS * 60 * 60 * 1000
  return sessions
    .filter(session => session.sessionId !== exceptSessionId && Date.parse(session.lastTouched) >= cutoff)
    .sort((a, b) => Date.parse(b.lastTouched) - Date.parse(a.lastTouched))
}

export function summarize(session: SavedSession): SessionSummary {
  return {
    sessionId: session.sessionId,
    lastTouched: session.lastTouched,
    goal: session.goal,
    inProgress: session.bearings?.inProgress ?? [],
    expectedNext: session.bearings?.expectedNext ?? [],
    openDecisions: session.bearings?.openDecisions ?? [],
  }
}

export function shortId(sessionId: string): string {
  return sessionId.slice(0, 8)
}

/** `<first 8 chars of id> · <relative lastTouched> · <goal>` */
export function sessionHeading(session: SessionSummary, nowMs: number): string {
  const goal = session.goal === '' ? 'goal not stated' : session.goal
  return `${shortId(session.sessionId)} · ${relativeTime(Date.parse(session.lastTouched), nowMs)} · ${goal}`
}

function bullets(items: string[]): string {
  return items.length === 0 ? '_none_' : items.map(item => `- ${item}`).join('\n')
}

/** One other session's section: its heading, then what it has in progress, expects next and waits on. */
export function sessionSection(session: SessionSummary, nowMs: number): string {
  return [
    `### ${sessionHeading(session, nowMs)}`,
    `**In progress**\n${bullets(session.inProgress)}`,
    `**Expected next**\n${bullets(session.expectedNext)}`,
    `**Open decisions**\n${bullets(session.openDecisions)}`,
  ].join('\n\n')
}

export function sessionSections(sessions: SessionSummary[], nowMs: number): string {
  return sessions.map(session => sessionSection(session, nowMs)).join('\n\n')
}

// ---------------------------------------------------------------------------
// Glossary union across sessions

/** One term across sessions; `meanings` holds each distinct meaning with the session that gave it. */
export interface MergedTerm {
  term: string
  meanings: { meaning: string; sessionId: string }[]
}

/** The union by term (case-insensitive). Different meanings are all kept; no session wins. */
export function mergeGlossaries(sessions: { sessionId: string; glossary: GlossaryEntry[] }[]): MergedTerm[] {
  const merged: MergedTerm[] = []
  for (const session of sessions) {
    for (const entry of session.glossary) {
      const known = merged.find(one => sameText(one.term, entry.term))
      const meaning = { meaning: entry.meaning, sessionId: session.sessionId }
      if (known === undefined) {
        merged.push({ term: entry.term, meanings: [meaning] })
      } else if (!known.meanings.some(one => sameText(one.meaning, entry.meaning))) {
        known.meanings.push(meaning)
      }
    }
  }
  return merged
}

/** The meaning as one line: the meaning alone when the sessions agree, else each tagged with its session. */
export function mergedMeaning(term: MergedTerm): string {
  if (term.meanings.length === 1) return term.meanings[0]!.meaning
  return term.meanings.map(one => `${one.meaning} [${shortId(one.sessionId)}]`).join(' | ')
}

export function mergedGlossaryMarkdown(terms: MergedTerm[]): string {
  return terms.length === 0 ? '_No terms._' : terms.map(term => `- **${term.term}**: ${mergedMeaning(term)}`).join('\n')
}

/** The union as this session's starting glossary, every entry marked inherited. */
export function seedGlossary(terms: MergedTerm[]): GlossaryEntry[] {
  return terms.map(term => ({
    term: term.term, meaning: mergedMeaning(term), firstTurn: 0, lastSeenTurn: 0, pin: 'none', source: 'inherited',
  }))
}

// ---------------------------------------------------------------------------
// What the model reads

function note(heading: string, markdown: string): string {
  return `${heading}\n\n${capText(markdown, CONVERSATION_NOTE_LIMIT)}`
}

/** The one row appended at cold start, or null when no other session is active (then nothing is appended). */
export function coldStartNote(others: SavedSession[], nowMs: number): string | null {
  return others.length === 0 ? null : note(COLD_START_HEADING, coldStartMarkdown(others, nowMs))
}

export function compactionNote(ownBearingsMarkdown: string, others: SessionSummary[], nowMs: number): string {
  return note(COMPACTION_HEADING, compactionMarkdown(ownBearingsMarkdown, others, nowMs))
}

/** At cold start: the other sessions' sections, then their glossary union. */
export function coldStartMarkdown(others: SavedSession[], nowMs: number): string {
  const sections = sessionSections(others.map(summarize), nowMs)
  return `${sections}\n\n## Glossary of these sessions\n\n${mergedGlossaryMarkdown(mergeGlossaries(others))}\n`
}

/** After compaction: this session's own Bearings, then one line per other active session. */
export function compactionMarkdown(ownBearingsMarkdown: string, others: SessionSummary[], nowMs: number): string {
  if (others.length === 0) return ownBearingsMarkdown
  const lines = others.map(session => `- ${sessionHeading(session, nowMs)}`).join('\n')
  return `${ownBearingsMarkdown}\n\n## Other sessions active in this folder\n\n${lines}\n`
}

/** This session's starting Bearings when it inherits: empty but for where the glossary came from. */
export function inheritedBearings(newestOther: SavedSession, empty: Bearings): Bearings {
  return { ...empty, inheritedFrom: { sessionId: newestOther.sessionId, savedAt: newestOther.lastTouched } }
}
