import type { Participation } from '../types'

/** What Claude Code's VS Code extension sets as the session's entrypoint (`CLAUDE_CODE_ENTRYPOINT`). */
export const VSCODE_ENTRYPOINT = 'claude-vscode'

export interface StartSignals {
  isInteractive: boolean
  entrypoint: string | undefined
  surfaces: readonly string[]
}

/** The VS Code chat panel runs on the Agent SDK (not interactive) but is a person's session. */
export function isVsCodePanel(signals: Pick<StartSignals, 'entrypoint' | 'surfaces'>): boolean {
  return signals.entrypoint === VSCODE_ENTRYPOINT || signals.surfaces.includes('vscode')
}

/**
 * `active` for the interactive terminal or desktop session, `panel` for the VS Code chat panel
 * (no band or panes there), `off` for everything else: `-p`, other SDK hosts, fixers.
 */
export function participationAtStart(signals: StartSignals): Participation {
  if (signals.isInteractive) return 'active'
  return isVsCodePanel(signals) ? 'panel' : 'off'
}
