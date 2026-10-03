import type { Snapshot } from './merge'

/** One finished main-thread turn, as the background update reads it. */
export interface TurnText {
  turn: number
  prompt: string
  answer: string
}

/** Each side of a turn is capped before it reaches the background model. */
export const TURN_TEXT_LIMIT = 6000

const DELTA_SHAPE = `{
  "glossary": {
    "upsert": [{ "term": "...", "meaning": "..." }],
    "seen": ["term"]
  },
  "bearings": {
    "goal": "...",
    "subGoals": ["..."],
    "doneRecently": ["..."],
    "inProgress": ["..."],
    "expectedNext": ["..."],
    "openDecisions": ["..."],
    "factsAdd": ["..."],
    "factsSeen": ["..."]
  }
}`

const RULES = `Rules:
- Take every meaning only from the conversation text. If a term's meaning is not stated there, write "meaning not stated in the conversation". Never invent a meaning.
- Terms are acronyms, coined labels, ids (backlog rows, gap codes, ticket numbers and the like) and key terms of the work.
- Keep each meaning to one line.
- Bearings items are short, plain sentences.
- Open decisions are only questions the assistant asked the operator that the operator has not answered yet.
- Facts are things to hold in mind while working (numbers, paths, constraints, agreed choices).`

export const UPDATE_SYSTEM = `You keep a glossary and a map of where the work stands for a person who follows a long working conversation between an operator and an AI assistant, and who often steps away.

You receive the current glossary and map as JSON, and the newest turn or turns of the conversation. Answer with one JSON object and nothing else: a delta in this shape.

${DELTA_SHAPE}

- "upsert": terms that are new, or whose meaning the new turns state or change.
- "seen": known terms the new turns mention without changing their meaning.
- In "bearings", include a field only when it changes; a list you include replaces the old list whole.
- "factsAdd": new facts. "factsSeen": known facts the new turns rely on again, quoted exactly.

${RULES}`

function cap(text: string): string {
  return text.length <= TURN_TEXT_LIMIT ? text : `${text.slice(0, TURN_TEXT_LIMIT)} ... (cut)`
}

/** The glossary and map as the background model reads them: meanings and items only, no bookkeeping. */
function currentStateJson(snapshot: Snapshot): string {
  const bearings = snapshot.bearings
  return JSON.stringify({
    glossary: snapshot.glossary.map(entry => ({ term: entry.term, meaning: entry.meaning })),
    bearings: bearings === null ? null : {
      goal: bearings.goal,
      subGoals: bearings.subGoals,
      doneRecently: bearings.doneRecently,
      inProgress: bearings.inProgress,
      expectedNext: bearings.expectedNext,
      openDecisions: bearings.openDecisions,
      facts: bearings.facts.map(fact => fact.text),
    },
  })
}

export function updatePrompt(snapshot: Snapshot, turns: TurnText[]): string {
  const turnBlocks = turns.map(turn =>
    `<turn number="${turn.turn}">\n<operator>\n${cap(turn.prompt)}\n</operator>\n<assistant>\n${cap(turn.answer)}\n</assistant>\n</turn>`,
  )
  return `<current>\n${currentStateJson(snapshot)}\n</current>\n\n<new_turns>\n${turnBlocks.join('\n')}\n</new_turns>\n\nAnswer with the JSON delta only.`
}

/** One message of the transcript as the rebuild reads it: who wrote it and its text, nothing else. */
export interface TranscriptMessage {
  role: 'user' | 'assistant'
  text: string
}

/** The rebuild sends the transcript in pieces of about this many characters, one call each. */
export const REBUILD_CHUNK_LIMIT = 60_000

function messageBlock(message: TranscriptMessage): string {
  const tag = message.role === 'user' ? 'operator' : 'assistant'
  return `<${tag}>\n${message.text}\n</${tag}>`
}

/** Cuts a text longer than `limit` into consecutive pieces of at most `limit` characters. */
function splitToLimit(text: string, limit: number): string[] {
  const pieces: string[] = []
  for (let start = 0; start < text.length; start += limit) pieces.push(text.slice(start, start + limit))
  return pieces
}

/**
 * The transcript, in order, packed into chunks of at most `limit` characters.
 * Messages with no text are left out; one longer than a chunk is cut across several.
 */
export function transcriptChunks(messages: TranscriptMessage[], limit = REBUILD_CHUNK_LIMIT): string[] {
  const pieces = messages
    .filter(message => message.text.trim() !== '')
    .flatMap(message => splitToLimit(messageBlock(message), limit))

  const chunks: string[] = []
  let current = ''
  for (const piece of pieces) {
    const joined = current === '' ? piece : `${current}\n${piece}`
    if (joined.length <= limit) {
      current = joined
      continue
    }
    chunks.push(current)
    current = piece
  }
  if (current !== '') chunks.push(current)
  return chunks
}

/** One step of a rebuild: the state so far and the next piece of the transcript, answered as a delta. */
export function rebuildChunkPrompt(snapshot: Snapshot, chunk: string, index: number, total: number): string {
  return `<current>\n${currentStateJson(snapshot)}\n</current>\n\n<transcript_part number="${index + 1}" of="${total}">\n${chunk}\n</transcript_part>\n\nThis is part ${index + 1} of ${total} of the whole conversation, in order. Answer with the JSON delta only.`
}

export function btwPrompt(question: string): string {
  return `A side question from the operator, asked from a side panel. Your answer is shown to them there and does not enter the conversation. Answer briefly, for a human reader, in plain prose. Take no actions, propose no tool calls and do not talk about tools.

Question: ${question}`
}

/** The last messages the btw fallback reads beside the glossary and bearings. */
export const BTW_FALLBACK_MESSAGES = 20

/** For a btw question when there is no conversation to fork (a resumed process before its first request). */
export function btwFallbackPrompt(question: string, bearingsMarkdown: string, recent: TranscriptMessage[]): string {
  const messages = recent.slice(-BTW_FALLBACK_MESSAGES).map(messageBlock).join('\n')
  return `You answer a side question from the operator of a long working conversation between them and an AI assistant. You do not have the whole conversation: only its glossary and map of where the work stands, and its last messages. Answer briefly, for a human reader, in plain prose. If these do not hold the answer, say so.

<bearings>
${bearingsMarkdown}
</bearings>

<last_messages>
${messages}
</last_messages>

Question: ${question}`
}

export const BTW_FALLBACK_MARK = '(from bearings, not the full conversation)'
