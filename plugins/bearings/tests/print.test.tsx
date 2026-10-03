import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const NOW = Date.parse('2026-10-03T12:00:00.000Z')
const MD_PATH = '/home/me/.claude/projects/-work-repo/bearings/session-under-test.md'

interface WorldOptions {
  surfaces?: string[]
  mdExists?: boolean
  codeExit?: number
}

/** HOME is set, so the session has a .md path; records log lines and every process run. */
function world(on: On, options: WorldOptions = {}) {
  const logs: string[] = []
  const processRuns: (readonly string[])[] = []

  mock.env(on, { HOME: '/home/me' })
  mock.store(on)
  mock.clock(on, { now: NOW })
  on('session.cwd', () => ({ value: '/work/repo' }))
  on('session.id', () => ({ value: 'session-under-test' }))
  on('session.usage', () => ({ value: { startedAt: NOW } }) as never)
  on('session.surfaces', () => ({ value: (options.surfaces ?? ['terminal']) as never }))
  on('fs.write', () => ({ value: undefined }))
  on('fs.exists', () => ({ value: options.mdExists ?? true }))
  on('process.run', ($, e) => {
    processRuns.push(e.argv)
    const exitCode = options.codeExit ?? 0
    return { value: { exitCode, stdout: '', stderr: exitCode === 0 ? '' : 'boom', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.log', ($, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  // The engine's own drawing of an output row, standing for what `next(e)` reaches.
  on('ui.render', { component: 'CommandOutput' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine row</Text>
  })
  return { logs, processRuns }
}

/** A slash command as the person types it at the prompt. */
function typed(command: 'glossary' | 'bearings', args: string) {
  return { command, args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }
}

function mountRow($: Engine, surface: 'terminal' | 'desktop', command: string, text: string) {
  return $.ui.mount({
    plugin: 'bearings', surface, component: 'CommandOutput', props: { command, args: 'print', text, isErrored: false },
  })
}

describe('print in the terminal and desktop', () => {
  test('print answers a short stub naming the snapshot, and the output row draws it as Markdown', async ($, on) => {
    world(on)
    const result = await $.command.run(typed('bearings', 'print'))
    expect(result.text).toBe('Bearings view #1 shown to the person (not in the conversation).')
    expect(result.context).toBeUndefined()

    for (const surface of ['terminal', 'desktop'] as const) {
      const row = await mountRow($, surface, 'bearings', result.text ?? '')
      const drawn = await row.find({ type: 'Markdown' })
      expect(drawn?.text.startsWith('# Bearings')).toBe(true)
      expect(drawn?.text.endsWith(`_Full file: ${MD_PATH}_`)).toBe(true)
      await row.unmount()
    }
  })

  test('a row that names no print is left to the engine', async ($, on) => {
    world(on)
    const row = await mountRow($, 'terminal', 'bearings', 'Bearings pane opened.')
    expect(await row.find({ type: 'Markdown' })).toBeUndefined()
    expect(await row.find({ text: 'engine row' })).toBeDefined()
  })

  test('a later change of state does not alter an earlier print', async ($, on) => {
    world(on)
    const first = await $.command.run(typed('glossary', 'print'))
    await $.tool.call({ tool: 'mcp__bearings__add', term: 'S4', meaning: 'stage four' })
    const second = await $.command.run(typed('glossary', 'print'))
    expect(second.text).toBe('Glossary view #2 shown to the person (not in the conversation).')

    const firstDrawn = await (await mountRow($, 'terminal', 'glossary', first.text ?? '')).find({ type: 'Markdown' })
    expect(firstDrawn?.text).toContain('_No terms yet._')
    expect(firstDrawn?.text).not.toContain('S4')

    const secondDrawn = await (await mountRow($, 'terminal', 'glossary', second.text ?? '')).find({ type: 'Markdown' })
    expect(secondDrawn?.text).toContain('- **S4**: stage four (T0)')
  })
})

describe('VS Code', () => {
  test('opens the session\'s .md file with code and returns no text', async ($, on) => {
    const { logs, processRuns } = world(on, { surfaces: ['vscode'] })
    const result = await $.command.run(typed('bearings', ''))
    expect(result.text).toBeUndefined()
    expect(processRuns).toEqual([['code', MD_PATH]])
    expect(logs).toEqual([`opened ${MD_PATH} in VS Code`])
  })

  test('a failing code falls back to the view as one log line and says why', async ($, on) => {
    const { logs } = world(on, { surfaces: ['vscode'], codeExit: 1 })
    const result = await $.command.run(typed('bearings', 'print'))
    expect(result.text).toBeUndefined()
    expect(logs.length).toBe(2)
    expect(logs[0]?.startsWith('# Bearings')).toBe(true)
    expect(logs[1]).toBe('not opened in VS Code: code exited with 1 (boom)')
  })

  test('with no .md file yet, code is not run and the fallback says so', async ($, on) => {
    const { logs, processRuns } = world(on, { surfaces: ['vscode'], mdExists: false })
    await $.command.run(typed('glossary', ''))
    expect(processRuns).toEqual([])
    expect(logs[0]?.startsWith('# Glossary')).toBe(true)
    expect(logs[1]).toBe('not opened in VS Code: the session has no .md file yet')
  })
})
