import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE_PROPS = {
  title: 'pane',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

/** No HOME, so the session files are skipped; the cwd names the project; store writes are recorded. */
function world(on: On) {
  const storeWrites: { key: string; value: unknown }[] = []
  mock.env(on, {})
  mock.clock(on, { now: Date.parse('2026-10-03T10:00:00.000Z') })
  on('session.cwd', () => ({ value: '/work/repo' }))
  on('store.set', ($, e) => {
    storeWrites.push({ key: e.key, value: e.value })
    return { value: undefined }
  })
  return { storeWrites }
}

test('mcp__bearings__add adds a term and a project-pinned fact that the panes then show', async ($, on) => {
  const { storeWrites } = world(on)

  const term = await $.tool.call({ tool: 'mcp__bearings__add', term: 'S4', meaning: 'the ReTraj stage four' })
  expect(term.result).toBe('Added the term "S4" to the Bearings glossary.')

  const fact = await $.tool.call({ tool: 'mcp__bearings__add', fact: 'ssh to the VM is allowed', pin: 'project' })
  expect(fact.result).toBe('Added the fact to Bearings.')

  const glossaryPane = await $.ui.mount({
    plugin: 'bearings', surface: 'terminal', component: 'Pane', requestId: 'bearings-glossary', props: PANE_PROPS,
  })
  const terms = await glossaryPane.find({ type: 'Markdown' })
  expect(terms?.text).toBe('- **S4**: the ReTraj stage four (T0)')

  const bearingsPane = await $.ui.mount({
    plugin: 'bearings', surface: 'terminal', component: 'Pane', requestId: 'bearings-map', props: PANE_PROPS,
  })
  expect(await bearingsPane.find({ type: 'Markdown', text: '- ssh to the VM is allowed [project pin]' })).toBeDefined()

  const lastWrite = storeWrites[storeWrites.length - 1]
  expect(lastWrite?.key).toBe('project-pins:/work/repo')
  expect(lastWrite?.value).toEqual({
    glossary: [],
    facts: [{ text: 'ssh to the VM is allowed', lastSeenTurn: 0, pin: 'project', source: 'claude' }],
  })
})

test('mcp__bearings__add refuses input with neither a term nor a fact', async ($, on) => {
  world(on)

  const refused = await $.tool.call({ tool: 'mcp__bearings__add', meaning: 'orphan meaning' })
  expect(refused.deny).toBe('Give "term" with "meaning", or "fact".')
})
