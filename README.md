# bearings

Bearings is a Claude Code mod that helps you regain context. It is for people who step away from a long session, or who run several sessions at once, and need to see again what the work is about. A mod is a plugin that draws extra interface inside Claude Code. This one adds a band above the prompt with two views.

- **Glossary** lists the terms and ids from recent turns (acronyms, coined labels, backlog rows, gap codes) with a one-line meaning taken from the conversation. When the conversation does not state a meaning, it says so and does not guess.
- **Bearings** shows the goal, sub-goals, what was done recently, what is in progress, what is expected next, the open decisions waiting on you, and the facts to hold.

## Requirements

Claude Code 2.1.287 or later. Check with:

```
claude --version
```

## Install

```
claude plugin marketplace add roy651/cc-bearings
claude plugin install bearings@cc-bearings
```

Then run `/reload-plugins` in an open session, or start a new one. Run `/plugin` and check that bearings is listed as an active mod. Claude Code asks you to trust the folder the first time. Accept the prompt, because mods do not load in an untrusted folder.

To work on the mod from a clone, start Claude Code with:

```
claude --plugin-dir <clone>/plugins/bearings
```

Or set `CLAUDE_CODE_PLUGIN_DIRS` to the same path in the `env` block of `~/.claude/settings.json`. The mod then loads in every session and reloads when you save a file.

## Use

The band above the prompt has two buttons and a status:

- `Glossary · <n> new` opens the Glossary pane (hotkey `g`). "New" means first seen in the last 3 turns.
- `Bearings · <age>` opens the Bearings pane (hotkey `b`).
- `updating` shows while the background update or a rebuild runs.
- `<n> other sessions here` appears when other sessions are active in the same folder.

To use a hotkey, click the button in the fullscreen terminal, or press ctrl+x then tab to reach the band and then the key. The same panes open with the slash commands:

```
/glossary
/bearings
```

Add `print` (`/bearings print`) to draw the view inline in the conversation instead of opening a pane. Claude reads only a one-line stub, not the view. In the VS Code chat panel the commands open the session's Markdown file instead.

Both panes have an input line. Lines are read as commands when they start with one of these prefixes:

```
add: <term> = <meaning>
fact: <text>
pin: <term>
pin project: <term>
unpin: <term>
```

`add:` adds or replaces a glossary entry. `fact:` adds a fact to Bearings. `pin:` and `unpin:` take a term or the start of a fact text. Any other line typed in the Glossary pane shows the list of commands. Any other line typed in the Bearings pane is a btw question.

A btw question is a side question about the conversation. It is answered briefly in the pane and never enters the main conversation. The last 20 are kept.

The Rebuild button in the Bearings pane (hotkey `r`) regenerates the glossary and the bearings from the whole conversation. It reads the text of every message (not tool output) and feeds it to the background model in chunks, so it also works right after `claude --resume`. Pinned and added entries are kept.

You can also ask Claude in the conversation to add a term or a fact. Claude then calls the `add` tool (listed as `mcp__bearings__add`), and the entry appears in the panes.

**Pins and the 30-turn fold.** An entry stays in the main list while it was seen in the last 30 turns. Older entries move to a collapsed "Earlier" section and are never deleted. A pin keeps an entry in the main list. `pin:` holds it for this session, and `pin project:` holds it in every session started in the same folder.

## Several sessions in one folder

Each session writes only its own file, signed with its session id, folder, start time, last activity and current goal. There is no shared file and no lock. Sessions active in the last 48 hours are merged when read, without a model call. Older files stay on disk and are ignored.

- The Bearings pane has a collapsed "Other sessions here" section with one block per active session: its goal, in progress, expected next and open decisions.
- The merged glossary is the union by term. When two sessions give different meanings for one term, both are shown, each tagged with the first 8 characters of its session id.
- A new session starts with its glossary seeded from the other active sessions. It also receives one note in the conversation with the merged view, up to about 6000 characters. If no other session is active, it receives nothing. A resumed session reloads its own file instead.
- After compaction, the session receives its own Bearings and one line per other active session (id, time, goal).

Subagents do not take part. Non-interactive runs (`claude -p`, the SDK) register nothing: no band, no updates, no files.

## Where it runs

| Surface | Result |
|---|---|
| Terminal CLI, including JetBrains and editor terminals | Full |
| Claude desktop app, Code tab | Full |
| VS Code extension chat panel | Background updates and files work. No band or panes. `/glossary` and `/bearings` open the session's live Markdown file in an editor tab (needs the `code` command on your PATH). For btw and editing, run `claude` in the VS Code terminal. |
| Remote Control from claude.ai or mobile | Updates run. The views draw only in the terminal on your machine. |
| Cloud sessions | Not loaded unless the plugin is installed there |

## Cost and privacy

After each turn, one call goes to the background model with the turn's prompt and final reply plus the current glossary and bearings. That is a few thousand tokens. The default model is `sonnet`. Change it in `/config` under the plugin's options.

A btw question asks the session's own model over the whole conversation. This is cheap while the prompt cache is warm and a full-context read when it is cold. Right after a resume it is answered by the background model from the glossary, the bearings and the last 20 messages instead, and says so. Rebuild uses the background model over the text of every message.

Files are written to `~/.claude/projects/<folder>/bearings/<session id>.json` and `.md`, on your machine only. The `.md` file is the same content as readable Markdown.

## Development

```
claude plugin validate plugins/bearings
claude plugin test plugins/bearings
```

## License

MIT
