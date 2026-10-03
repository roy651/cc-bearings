import { describe, expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE_PROPS = {
  title: 'pane',
  isFocused: false,
  bodyColumns: 100,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 60 },
  view: {},
}

const USAGE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

interface WorldOptions {
  messages?: { role: 'user' | 'assistant'; text: string }[]
  /** The reply of the n-th `$.model.complete` call (0-based). */
  completeReply?: (callIndex: number) => string
  forkReason?: 'nothing-to-fork'
  surfaces?: string[]
}

/** No HOME (no files); records every model call, log line and pane opened. */
function world(on: On, options: WorldOptions = {}) {
  const completePrompts: string[] = []
  const forkPrompts: string[] = []
  const logs: string[] = []
  const opened: string[] = []

  mock.env(on, {})
  mock.store(on)
  mock.clock(on, { now: Date.parse('2026-10-03T12:00:00.000Z') })
  on('session.cwd', () => ({ value: '/work/repo' }))
  on('session.id', () => ({ value: 'session-under-test' }))
  on('session.surfaces', () => ({ value: (options.surfaces ?? ['terminal']) as never }))
  on('session.messages', () => ({ value: (options.messages ?? []).map(one => ({ ...one, toolUses: [] })) as never }))
  on('model.complete', ($, e) => {
    completePrompts.push(e.prompt)
    const text = options.completeReply?.(completePrompts.length - 1) ?? 'no json'
    return { value: { isAnswered: true, text, usage: USAGE } }
  })
  on('model.fork', ($, e) => {
    forkPrompts.push(e.prompt)
    return { value: { isAnswered: false, reason: options.forkReason ?? 'nothing-to-fork' } as never }
  })
  on('ui.log', ($, e) => {
    logs.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    opened.push(e.id)
    return { value: { isPlaced: true } as never }
  })
  return { completePrompts, forkPrompts, logs, opened }
}

function mountPane($: Engine, requestId: string) {
  return $.ui.mount({ plugin: 'bearings', surface: 'terminal', component: 'Pane', requestId, props: PANE_PROPS })
}

/** A message of about 40,000 characters: two never fit one 60,000-character chunk. */
function longMessage(role: 'user' | 'assistant', marker: string) {
  return { role, text: `${marker} ${'x'.repeat(40_000)}` }
}

describe('rebuild', () => {
  test('three chunks make three calls in order, each over the state so far; pins survive; no fork', async ($, on) => {
    const { completePrompts, forkPrompts } = world(on, {
      messages: [longMessage('user', 'MARK-ONE'), longMessage('assistant', 'MARK-TWO'), longMessage('user', 'MARK-THREE')],
      completeReply: n => JSON.stringify({ glossary: { upsert: [{ term: `C${n + 1}`, meaning: `from chunk ${n + 1}` }] } }),
    })
    await $.tool.call({ tool: 'mcp__bearings__add', term: 'PINNED', meaning: 'kept by hand', pin: 'session' })

    const pane = await mountPane($, 'bearings-map')
    await pane.press({ key: 'rebuild' })

    expect(forkPrompts).toEqual([])
    expect(completePrompts.length).toBe(3)
    expect(completePrompts.map(prompt => /part (\d) of 3/.exec(prompt)?.[1])).toEqual(['1', '2', '3'])
    expect(completePrompts.map(prompt => /MARK-\w+/.exec(prompt)?.[0])).toEqual(['MARK-ONE', 'MARK-TWO', 'MARK-THREE'])
    expect(completePrompts[1]).toContain('"C1"')
    expect(completePrompts[2]).toContain('"C2"')

    const glossary = await (await mountPane($, 'bearings-glossary')).find({ type: 'Markdown' })
    expect(glossary?.text).toContain('**PINNED**: kept by hand (T0) [pinned]')
    for (const term of ['C1', 'C2', 'C3']) expect(glossary?.text).toContain(`**${term}**`)
  })

  test('a malformed reply changes nothing, and the log line carries no own prefix', async ($, on) => {
    const { logs } = world(on, { messages: [{ role: 'user', text: 'short' }], completeReply: () => 'not json at all' })
    await $.tool.call({ tool: 'mcp__bearings__add', term: 'STAYS', meaning: 'unchanged' })

    const pane = await mountPane($, 'bearings-map')
    await pane.press({ key: 'rebuild' })

    expect(logs).toEqual(['rebuild failed at part 1 of 1, nothing changed (the reply holds no JSON object)'])
    expect(logs.some(line => line.startsWith('bearings:'))).toBe(false)
    const glossary = await (await mountPane($, 'bearings-glossary')).find({ type: 'Markdown' })
    expect(glossary?.text).toBe('- **STAYS**: unchanged (T0)')
  })
})

test('btw with nothing to fork falls back to the bearings and marks the answer', async ($, on) => {
  const { completePrompts, forkPrompts } = world(on, {
    messages: [{ role: 'user', text: 'we call it S4' }],
    completeReply: () => 'S4 is stage four.',
  })

  const pane = await mountPane($, 'bearings-map')
  await pane.input({ key: 'btw-input', text: 'what is S4?' })

  expect(forkPrompts.length).toBe(1)
  expect(completePrompts.length).toBe(1)
  expect(completePrompts[0]).toContain('Question: what is S4?')
  expect(completePrompts[0]).toContain('we call it S4')
  expect(await pane.find({ type: 'Markdown', text: 'S4 is stage four.\n\n_(from bearings, not the full conversation)_' })).toBeDefined()
})

/** A slash command as the person types it at the prompt. */
function typed(args: string) {
  return { command: 'bearings', args, origin: { kind: 'composer' as const }, presentation: { isFullscreen: true, columns: 120 } }
}

describe('view commands', () => {
  test('in the terminal, /bearings opens the pane as before', async ($, on) => {
    const { logs, opened } = world(on)
    await $.command.run(typed(''))
    expect(logs).toEqual([])
    expect(opened).toEqual(['bearings-map'])
  })
})
