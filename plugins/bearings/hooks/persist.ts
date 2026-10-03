import type { Bearings, BtwExchange, GlossaryEntry, UpdateStats } from '../types'

/** The part of `$.fs` the files need, so the round trip tests with an in-memory stand-in. */
export interface FileAccess {
  read(path: string): Promise<string>
  write(path: string, text: string): Promise<void>
  list(path: string): Promise<readonly { name: string; kind: string; mtimeMs: number }[]>
}

/**
 * What `<session id>.json` holds: the session's whole state, led by its signature
 * (`sessionId`, `cwd`, `startedAt`, `lastTouched`, `goal`), which is how sessions
 * working in the same folder find each other. Each session writes only its own file.
 */
export interface SavedSession {
  sessionId: string
  cwd: string
  startedAt: string
  lastTouched: string
  /** The current Bearings goal, one line. */
  goal: string
  turn: number
  glossary: GlossaryEntry[]
  bearings: Bearings | null
  btw: BtwExchange[]
  stats: UpdateStats
}

/** `~/.claude/projects/<cwd with every "/" as "-">/bearings`, next to Claude's own project folder. */
export function bearingsFolder(home: string, cwd: string): string {
  return `${home}/.claude/projects/${cwd.replaceAll('/', '-')}/bearings`
}

export function firstLine(text: string): string {
  return text.split('\n')[0]?.trim() ?? ''
}

export async function saveSession(files: FileAccess, folder: string, saved: SavedSession, markdown: string): Promise<void> {
  await files.write(`${folder}/${saved.sessionId}.json`, JSON.stringify(saved, null, 2))
  await files.write(`${folder}/${saved.sessionId}.md`, markdown)
}

/**
 * Every session file in the folder that parses, newest first. Files written before the
 * signature existed are read too: `lastTouched` falls back to the file's mtime and the
 * goal to the Bearings goal. A missing folder reads as no sessions.
 */
export async function readSessionFiles(files: FileAccess, folder: string): Promise<SavedSession[]> {
  let entries: readonly { name: string; kind: string; mtimeMs: number }[]
  try {
    entries = await files.list(folder)
  } catch {
    return []
  }

  const sessions: SavedSession[] = []
  for (const entry of entries) {
    if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue
    try {
      const parsed = JSON.parse(await files.read(`${folder}/${entry.name}`)) as Partial<SavedSession>
      if (typeof parsed.sessionId !== 'string' || !Array.isArray(parsed.glossary)) continue
      sessions.push(withSignature(parsed as SavedSession, new Date(entry.mtimeMs).toISOString()))
    } catch {
      // A half-written or foreign file: leave it out.
    }
  }
  return sessions.sort((a, b) => Date.parse(b.lastTouched) - Date.parse(a.lastTouched))
}

function withSignature(saved: SavedSession, fileTime: string): SavedSession {
  return {
    ...saved,
    cwd: saved.cwd ?? '',
    startedAt: saved.startedAt ?? '',
    lastTouched: saved.lastTouched ?? fileTime,
    goal: saved.goal ?? firstLine(saved.bearings?.goal ?? ''),
    btw: saved.btw ?? [],
  }
}
