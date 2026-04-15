# healthy-developer

Wellness reminders integrated natively into your AI agent workflow.

Instead of a separate app, **healthy-developer** works inside your existing conversations — Claude (or any MCP-compatible agent) reminds you to drink water or take a walk **between tasks**, naturally, without interrupting your flow.

## Why this exists

Every new AI tool today is obsessed with saving tokens. Fewer context calls, shorter prompts, leaner pipelines — and that's fine. Efficiency matters.

But **healthy-developer** doesn't care about spending a few extra tokens. Because what's the point of optimizing your workflow if you're not taking care of the person running it?

You can be the most productive developer in the room and still end the day dehydrated, with a stiff back and tired eyes. Productivity without health isn't sustainable — it's just a slow way to burn out.

So yes, this tool costs a few tokens per session. It does it on purpose. Because being able to enjoy what you're building matters more than saving a fraction of a cent on your API bill.

## How it works

You send a message → the agent checks if it's time for a wellness reminder → if yes, it mentions it briefly before answering your question.

```
You: "Refactor this component"

Claude: "Before we start — you've been at it for 40 minutes, grab some water 💧
         Here's the refactored version: ..."
```

No separate window. No annoying notifications. Just part of the conversation.

## Install

```bash
npx healthy-developer
```

This runs the interactive setup: configure your intervals, daily water goal, and language. Hooks are registered in Claude Code automatically.

## Commands

```bash
npx healthy-developer          # interactive setup
npx healthy-developer status   # show current state
npx healthy-developer serve    # start MCP server (for Cursor/Windsurf/Zed)
npx healthy-developer enable   # enable reminders
npx healthy-developer disable  # disable reminders
```

## IDE support

### Claude Code
Installed automatically by `npx healthy-developer`. Hooks are registered in `~/.claude/settings.json`.

### Cursor / Windsurf / Zed / any MCP-compatible IDE
Add to your MCP config:

```json
{
  "healthy-developer": {
    "command": "npx",
    "args": ["healthy-developer", "serve"]
  }
}
```

The agent will call `check_wellness` before each response.

## MCP tools

| Tool | Description |
|------|-------------|
| `check_wellness` | Returns pending reminders (water / walk) |
| `snooze_reminder` | Snooze a reminder for N minutes |
| `wellness_status` | Current stats: water today, time since last reminders |

## Configuration

Stored in `~/.healthy-developer/config.json`.

| Key | Default | Description |
|-----|---------|-------------|
| `waterIntervalMinutes` | 30 | Minutes between water reminders |
| `walkIntervalMinutes` | 60 | Minutes between walk reminders |
| `dailyLiters` | 2 | Daily water goal in liters |
| `language` | `es` | Reminder language (`es` or `en`) |
| `enabled` | `true` | Toggle reminders on/off |

## License

MIT
