import { expect, test } from 'claude-code/testing'

import { createSerialQueue } from '../hooks/queue'

/** A promise the test resolves by hand, standing for a model call in flight. */
function deferred() {
  let resolve = () => {}
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

async function settle() {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

test('two turns that finish while an update runs give one follow-up call', async () => {
  const calls: number[][] = []
  const inFlight = [deferred(), deferred()]
  const run = (turns: number[]) => {
    calls.push(turns)
    return inFlight[calls.length - 1]!.promise
  }
  const queue = createSerialQueue<number>()

  queue.push(1, run)
  await settle()
  expect(calls).toEqual([[1]])

  queue.push(2, run)
  queue.push(3, run)
  await settle()
  expect(calls).toEqual([[1]])

  inFlight[0]!.resolve()
  await settle()
  expect(calls).toEqual([[1], [2, 3]])

  inFlight[1]!.resolve()
  await settle()
  expect(calls).toEqual([[1], [2, 3]])
})

test('a runner that throws does not stop the next batch', async () => {
  const calls: number[][] = []
  const queue = createSerialQueue<number>()
  queue.push(1, async turns => {
    calls.push(turns)
    throw new Error('boom')
  })
  await settle()
  queue.push(2, async turns => { calls.push(turns) })
  await settle()
  expect(calls).toEqual([[1], [2]])
})
