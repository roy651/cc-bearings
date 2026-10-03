export type Pin = 'none' | 'session' | 'project'

export type Source = 'auto' | 'operator' | 'claude' | 'inherited'

export interface GlossaryEntry {
  term: string
  meaning: string
  firstTurn: number
  lastSeenTurn: number
  pin: Pin
  source: Source
}

export interface Fact {
  text: string
  lastSeenTurn: number
  pin: Pin
  source: Source
}

export interface Bearings {
  goal: string
  subGoals: string[]
  doneRecently: string[]
  inProgress: string[]
  expectedNext: string[]
  openDecisions: string[]
  facts: Fact[]
  updatedAtTurn: number
  inheritedFrom?: { sessionId: string; savedAt: string }
}

export interface BtwExchange {
  question: string
  answer: string
  atTurn: number
}

export interface UpdateStats {
  calls: number
  failures: number
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
}

/** The prompt of the main-thread turn that is running, kept until its turn.complete. */
export interface PendingPrompt {
  turnId: string
  text: string
}

/** Another session working in the same folder, as its file last said: what the band and pane show of it. */
export interface SessionSummary {
  sessionId: string
  lastTouched: string
  goal: string
  inProgress: string[]
  expectedNext: string[]
  openDecisions: string[]
}

/**
 * Whether this session takes part: `off` for a non-interactive run (-p, the SDK, a fixer),
 * `active` for the interactive main thread, `unknown` until session.start says (a hot reload
 * of a session that started before this key existed stays `unknown` and counts as active).
 */
export type Participation = 'unknown' | 'active' | 'off'

/** One `/glossary print` or `/bearings print`: the view as it was then, drawn in that command's output row. */
export interface PrintedView {
  /** The number the output row's stub text names (`#<n>`). */
  n: number
  view: 'glossary' | 'bearings'
  markdown: string
  markdownPath: string | null
}

declare module 'claude-code' {
  interface PluginState {
    bearings: {
      glossary: GlossaryEntry[]
      bearings: Bearings | null
      /** Count of completed main-thread turns. */
      turn: number
      /** The last 20 side questions and their answers. */
      btw: BtwExchange[]
      stats: UpdateStats
      pendingPrompt: PendingPrompt | null
      isUpdating: boolean
      /** While a rebuild runs: how many transcript chunks are done of how many; null otherwise. */
      rebuildProgress: { done: number; total: number } | null
      /** The btw question being answered right now, shown as "thinking". */
      btwPendingQuestion: string | null
      /** A one-line message under the btw thread (nothing to fork, a failed call). */
      btwNotice: string | null
      isGlossaryEarlierOpen: boolean
      isBearingsEarlierOpen: boolean
      /** Other sessions active in this folder in the last 48 h, newest first; re-read once a minute. */
      otherSessions: SessionSummary[]
      isOtherSessionsOpen: boolean
      participation: Participation
      /** The last 20 printed views, oldest first. */
      prints: PrintedView[]
    }
  }
}
