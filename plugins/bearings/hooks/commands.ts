import { addFact, addTerm, setPin } from './merge'
import type { Snapshot } from './merge'
import type { Pin } from '../types'

/** A line typed into a pane's input that edits the glossary or the facts. */
export type PaneCommand =
  | { kind: 'add'; term: string; meaning: string }
  | { kind: 'fact'; text: string }
  | { kind: 'pin'; target: string; pin: 'session' | 'project' }
  | { kind: 'unpin'; target: string }

export const COMMAND_HELP =
  'Commands: "add: <term> = <meaning>", "fact: <text>", "pin: <term>", "pin project: <term>", "unpin: <term>".'

/** Reads one input line as a command, or null when it is none (then it may be a btw question). */
export function parsePaneCommand(line: string): PaneCommand | null {
  const text = line.trim()

  const add = /^add:\s*(.+?)\s*=\s*(.+)$/i.exec(text)
  if (add) return { kind: 'add', term: add[1]!, meaning: add[2]!.trim() }

  const fact = /^fact:\s*(.+)$/i.exec(text)
  if (fact) return { kind: 'fact', text: fact[1]!.trim() }

  const pinProject = /^pin project:\s*(.+)$/i.exec(text)
  if (pinProject) return { kind: 'pin', target: pinProject[1]!.trim(), pin: 'project' }

  const pin = /^pin:\s*(.+)$/i.exec(text)
  if (pin) return { kind: 'pin', target: pin[1]!.trim(), pin: 'session' }

  const unpin = /^unpin:\s*(.+)$/i.exec(text)
  if (unpin) return { kind: 'unpin', target: unpin[1]!.trim() }

  return null
}

/** Applies a pane command made by the operator, and says in one line what it did. */
export function applyPaneCommand(snapshot: Snapshot, command: PaneCommand, turn: number): { snapshot: Snapshot; message: string } {
  switch (command.kind) {
    case 'add':
      return { snapshot: addTerm(snapshot, command.term, command.meaning, 'operator', turn), message: `Added "${command.term}".` }
    case 'fact':
      return { snapshot: addFact(snapshot, command.text, 'operator', turn), message: 'Added the fact.' }
    case 'pin':
    case 'unpin': {
      const pin = command.kind === 'pin' ? command.pin : 'none'
      const result = setPin(snapshot, command.target, pin)
      const message = result.matched === null
        ? `No term or fact matches "${command.target}".`
        : `${command.kind === 'pin' ? `Pinned (${command.pin})` : 'Unpinned'} "${command.target}".`
      return { snapshot: result.snapshot, message }
    }
  }
}

/** The input of the `mcp__bearings__add` tool, as the main model sends it. */
export interface ToolAddInput {
  term?: unknown
  meaning?: unknown
  fact?: unknown
  pin?: unknown
}

const PINS: readonly Pin[] = ['none', 'session', 'project']

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** Applies an add the main model made on the operator's request, or says what is wrong with the input. */
export function applyToolAdd(snapshot: Snapshot, input: ToolAddInput, turn: number): { snapshot: Snapshot; message: string } | { error: string } {
  const pin = input.pin ?? 'none'
  if (!PINS.includes(pin as Pin)) return { error: `"pin" must be one of ${PINS.join(', ')}.` }

  if (nonEmpty(input.term)) {
    if (!nonEmpty(input.meaning)) return { error: 'A term needs a "meaning".' }
    const added = addTerm(snapshot, input.term, input.meaning, 'claude', turn)
    const pinned = pin === 'none' ? added : setPin(added, input.term, pin as Pin).snapshot
    return { snapshot: pinned, message: `Added the term "${input.term.trim()}" to the Bearings glossary.` }
  }

  if (nonEmpty(input.fact)) {
    const added = addFact(snapshot, input.fact, 'claude', turn)
    const pinned = pin === 'none' ? added : setPin(added, input.fact, pin as Pin).snapshot
    return { snapshot: pinned, message: 'Added the fact to Bearings.' }
  }

  return { error: 'Give "term" with "meaning", or "fact".' }
}
