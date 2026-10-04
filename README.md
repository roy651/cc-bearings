# cc-plugins

Claude Code plugins and extras by Roy Abitbol.

## Install the marketplace

```
claude plugin marketplace add roy651/cc-plugins
```

Then install a plugin from the table below and run `/reload-plugins` in an open session, or start a new one.

## Plugins

| Plugin | What it does | Install |
|---|---|---|
| [bearings](plugins/bearings/README.md) | A glossary of the conversation's terms and a map of where the work stands, kept up in the background, for people who step away from a session or run several at once. | `claude plugin install bearings@cc-plugins` |

## Extras

Extras are not plugins. Each one has its own install steps.

| Extra | What it does |
|---|---|
| [statusline](extras/statusline/README.md) | A two-line status line: model, effort, folder and git branch, then colored bars for context use, the 5-hour usage window and the 7-day window. |

## License

MIT. See [LICENSE](LICENSE).
