# Agent status spike

Shows which worktrees have a Claude Code agent running (`running`), blocked on you (`waiting`), or done (`idle`).

**1. Hooks** – `hook.mjs` is called by Claude Code and writes `~/.git-jungle/agents/<session>.json`
(override with `JUNGLE_STATUS_DIR`). Merge `settings.example.json` into `~/.claude/settings.json`
(all worktrees) or a project's `.claude/settings.json`, replacing `/ABSOLUTE/PATH/TO` with this folder.

**2. Extension** – open this worktree in VS Code and press F5 (`.vscode/launch.json`). In the new window open a repo with worktrees:
- "Worktree Agents" view in Source Control (spinner / bell per worktree, open-in-window and terminal buttons)
- status bar summary and a notification when an agent finishes or needs input
- *experimental*: a spinner/bell action on the built-in Source Control repository rows, matched via
  `scmProviderRootUri in gitJungle.running`. Unverified in a live window; the tree view works without it.

The extension imports `../src/git.js`, so it only runs from a repo checkout (bundle before publishing).
Hooks fire per tool call (`PostToolUse`); that costs one short `node` start each. Status is per machine, so a dev container needs its own status dir.
