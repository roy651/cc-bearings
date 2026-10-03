/**
 * Runs one batch at a time. Items pushed while a batch runs wait, and all of them
 * go into the next single call, so a burst of turns costs one follow-up update.
 *
 * Each push brings the function that runs its batch; a batch runs with the one
 * pushed last, so the newest turn's hook does the work.
 */
export function createSerialQueue<Item>() {
  let waiting: Item[] = []
  let runNewest: ((items: Item[]) => Promise<void>) | null = null
  let isRunning = false

  async function drain(): Promise<void> {
    isRunning = true
    while (waiting.length > 0 && runNewest !== null) {
      const batch = waiting
      waiting = []
      try {
        await runNewest(batch)
      } catch {
        // The runner reports its own failures; a throw must not stop later batches.
      }
    }
    isRunning = false
  }

  return {
    push(item: Item, run: (items: Item[]) => Promise<void>): void {
      waiting.push(item)
      runNewest = run
      if (!isRunning) void drain()
    },
  }
}
