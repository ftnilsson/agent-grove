# Agent Grove 🌴

**See what every AI coding agent is doing across your git worktrees, from the VS Code Source Control sidebar.**

Running Claude Code, Copilot CLI or Codex in several worktrees at once? Agent Grove shows which worktree has an agent working, which one is waiting on you, and tells you when one finishes.

| State | What you see |
|---|---|
| Working | The agent's logo in its brand colour, pulsing |
| Needs your input | The logo in amber |
| Idle / no session | A plain branch or circle icon |

It appears in three places: a **Worktree Agents** view in Source Control, a status bar summary, and (experimental) an icon on the built-in Source Control repository rows. A notification appears when an agent finishes or needs input.

## How it works

Agents report their state through **hooks**. A tiny script (`hooks/hook.mjs`) is called by the agent on each lifecycle event and writes one JSON file per session to `~/.agent-grove/agents/`. The extension watches that folder. Nothing is sent anywhere; it is all local files.

If an agent sends no event for 10 minutes (a closed or crashed session), its indicator is removed. Change this with the `agentGrove.hideAfterMinutes` setting.

## Install

```bash
npm install
npm run package:ext
code --install-extension agent-grove.vsix
```

Then restart VS Code and run **Agent Grove: Install Agent Hooks** from the Command Palette. Pick your agent; Agent Grove copies the hook to `~/.agent-grove/hook.mjs` and puts the config snippet on your clipboard. Agent Grove never edits your agent settings itself.

| Agent | Paste into | Notes |
|---|---|---|
| Claude Code | `~/.claude/settings.json` (merge the `hooks` block) | Reports running, waiting, idle |
| GitHub Copilot CLI | `~/.copilot/hooks/agent-grove.json` (new file) | CLI only; Copilot chat inside VS Code has no hooks |
| Codex CLI | `~/.codex/hooks.json` | No "waiting" signal, so shows running or idle |

Restart the agent session afterwards so it loads the hooks. Requires Node.js on your PATH.

## Development

```bash
npm test               # hook and git tests
npm run build:ext      # bundle into extension/dist
```

Open the folder in VS Code and press **Ctrl+F5** to launch an Extension Development Host (F5 with the debugger sometimes fails to attach). See [AGENTS.md](AGENTS.md) for the repository layout and gotchas.

## Releasing

Releases are built by GitHub Actions. Merge to `main`, then push a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The workflow runs the tests, stamps `0.2.0` into the extension, builds `agent-grove-0.2.0.vsix` and publishes it as a GitHub Release with generated notes. Tags must look like `vMAJOR.MINOR.PATCH` and be on `main`. Every push and pull request also runs the tests on Linux and Windows and checks that the extension still packages.

## Troubleshooting

- **No indicator for an agent:** check that a file appears in `~/.agent-grove/agents/` when the agent works. If not, the hook is not installed or the session was not restarted.
- **Stuck on an old state:** wait for the `agentGrove.hideAfterMinutes` timeout, or delete the file in `~/.agent-grove/agents/`.
- **Icons do not pulse:** animation depends on VS Code rendering animated SVGs; report it with your VS Code version.

## License

MIT
