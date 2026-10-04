# statusline

A two-line status line for Claude Code.

```
[Model ◕ effort] │ folder git:(branch)
Context ███░░░░░░░ 27% │ Usage █░░░░░░░░░ 12% (resets in 3h 14m) │ 7d █░░░░░░░░░ 9%
```

The bars are colored: green for context, blue for the 5-hour usage window, pink for the 7-day window. A figure that Claude Code does not send (for example the usage windows on an API key) is left out.

It is not a plugin. Claude Code does not let a plugin set the status line, so you install it by hand.

## Requirements

`bash`, `jq` and `git`.

## Install

1. Download the script and make it executable:

   ```
   curl -fsSL https://raw.githubusercontent.com/roy651/cc-plugins/main/extras/statusline/statusline.sh -o ~/.claude/statusline.sh
   chmod +x ~/.claude/statusline.sh
   ```

2. Add this to `~/.claude/settings.json`:

   ```json
   "statusLine": { "type": "command", "command": "~/.claude/statusline.sh" }
   ```

The status line appears at the next prompt.
