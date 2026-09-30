# Git Jungle: Agent Status

See which git worktrees have a Claude Code agent running, waiting for your input, or idle, right in VS Code.

- **Worktree Agents** view in Source Control, with a status icon per worktree
- Status bar summary and a notification when an agent finishes or needs input
- Experimental spinner/bell on the built-in Source Control repository rows

## Setup

Claude Code reports its state through hooks. Run **Git Jungle: Install Claude Code Hooks** from the Command Palette. It copies the hook script to `~/.git-jungle/hook.mjs` and puts the settings snippet on your clipboard; paste it into `~/.claude/settings.json`.

Requires Node.js on your PATH (Claude Code hooks run `node`).
