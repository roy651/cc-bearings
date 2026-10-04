/** The scan's input, all sources together, is cut to fit this many characters. */
export const SCAN_INPUT_LIMIT = 30_000

/** The files a scan reads first, most valuable first; a README, git and the file list follow. */
export const SCAN_FILES = ['.claude/handoff.md', 'CLAUDE.md', 'AGENTS.md'] as const

export const GIT_LOG_SOURCE = 'git log --oneline -15'
export const GIT_STATUS_SOURCE = 'git status --short'
export const FILE_LIST_SOURCE = 'top-level files'

export interface ScanSource {
  name: string
  text: string
  /** Set when the source was cut to fit the budget. */
  isCut?: boolean
}

/** `README.md` when the folder has it, else the first `README*` by name, else null. */
export function pickReadme(names: readonly string[]): string | null {
  if (names.includes('README.md')) return 'README.md'
  return [...names].sort().find(name => /^readme/i.test(name)) ?? null
}

/**
 * Cuts the sources to fit `limit` characters in all. Each gets an equal share; a source shorter
 * than its share is kept whole and what it leaves is shared among the rest. When the shares do
 * not divide evenly, the remainder goes to the earlier (more valuable) sources. Order is kept.
 */
export function fitToBudget(sources: ScanSource[], limit = SCAN_INPUT_LIMIT): ScanSource[] {
  const allowance = new Map<number, number>()
  let remaining = limit
  let open = sources.map((_, index) => index)

  while (open.length > 0) {
    const share = Math.floor(remaining / open.length)
    const fitting = open.filter(index => sources[index]!.text.length <= share)
    if (fitting.length === 0) {
      let leftover = remaining - share * open.length
      for (const index of open) {
        const extra = leftover > 0 ? 1 : 0
        leftover -= extra
        allowance.set(index, share + extra)
      }
      break
    }
    for (const index of fitting) {
      allowance.set(index, sources[index]!.text.length)
      remaining -= sources[index]!.text.length
    }
    open = open.filter(index => !fitting.includes(index))
  }

  return sources.map((source, index) => {
    const room = allowance.get(index) ?? 0
    return source.text.length <= room ? source : { ...source, text: source.text.slice(0, room), isCut: true }
  })
}
