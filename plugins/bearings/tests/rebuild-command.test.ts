import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const NOW = Date.parse('2026-10-04T09:00:00.000Z')
const MD_PATH = '/home/me/.claude/projects/-work-repo/bearings/session-under-test.md'
const USAGE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const PANE_PROPS = {
  title: 'pane', isFocused: false, bodyColumns: 100, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 60 }, view: {},
}

/** Two messages of about 40,000 characters: two chunks. */
const TWO_CHUNK_TRANSCRIPT = [
  { role: 'user' as const, text: `MARK-ONE ${'x'.repeat(40_000)}`, toolUses: [] },
  { role: 'assistant' as const, text: `MARK-TWO ${'y'.repeat(40_000)}`, toolUses: [] },
]

/** Records, in order, every model call, `code` run and log line; answers chunk n with the term `C<n>` and a full Bearings. */
function world(on: On, surfaces: string[]) {
  const events: string[] = []
  const completePrompts: string[] = []
  const opened: string[] = []

  mock.env(on, { HOME: '/home/me' })
  mock.store(on)
  const clock = mock.clock(on, { now: NOW })
  on('session.cwd', () => ({ value: '/work/repo' }))
  on('session.id', () => ({ value: 'session-under-test' }))
  on('session.usage', () => ({ value: { startedAt: NOW } }) as never)
  on('session.surfaces', () => ({ value: surfaces as never }))
  on('session.messages', () => ({ value: TWO_CHUNK_TRANSCRIPT as never }))
  on('fs.write', () => ({ value: undefined }))
  on('fs.exists', () => ({ value: true }))
  on('model.complete', ($, e) => {
    completePrompts.push(e.prompt)
    events.push('model.complete')
    const term = `C${/number="(\d+)"/.exec(e.prompt)?.[1] ?? '?'}`
    // A full result (a goal and three items), so the rebuild is not lean and no repo scan follows.
    const reply = { glossary: { upsert: [{ term, meaning: 'm' }] }, bearings: { goal: 'g', inProgress: ['a', 'b', 'c'] } }
    return { value: { isAnswered: true, text: JSON.stringify(reply), usage: USAGE } }
  })
  on('process.run', ($, e) => {
    events.push(`run ${e.argv.join(' ')}`)
    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('ui.log', ($, e) => {
    if (e.to !== 'debug') events.push(`log ${e.text}`)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } as never }
  })
  return { events, completePrompts, opened, clock }
}

function typedRebuild() {
  return { command: 'bearings', args: 'rebuild', origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }
}

test('/bearings rebuild makes the same model calls as the Rebuild button, and opens the pane', async ($, on) => {
  const { completePrompts, opened, clock } = world(on, ['terminal'])

  const pane = await $.ui.mount({ plugin: 'bearings', surface: 'terminal', component: 'Pane', requestId: 'bearings-map', props: PANE_PROPS })
  await pane.press({ key: 'rebuild' })
  const fromButton = [...completePrompts]
  expect(fromButton.length).toBe(2)

  const result = await $.command.run(typedRebuild())
  await clock.settle()

  expect(result.text).toBeUndefined()
  expect(opened).toEqual(['bearings-map'])
  expect(completePrompts.slice(2)).toEqual(fromButton)
})

test('in the VS Code panel, /bearings rebuild logs its start and end, then opens the .md once the rebuild is done', async ($, on) => {
  const { events, clock } = world(on, ['vscode'])

  const result = await $.command.run(typedRebuild())
  await clock.settle()

  expect(result.text).toBeUndefined()
  expect(events).toEqual([
    'log rebuilding bearings from the transcript',
    'model.complete',
    'model.complete',
    'log rebuilt from 2 chunks',
    `run code ${MD_PATH}`,
    `log opened ${MD_PATH} in VS Code`,
  ])
})
