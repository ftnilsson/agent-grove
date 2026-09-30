# Agent Grove: Worktree Status for AI Coding Agents

See which git worktree has an AI coding agent (Claude Code, GitHub Copilot CLI, Codex CLI) working, waiting for you, or idle, right in the Source Control sidebar.

- **Worktree Agents** view with a branded, pulsing logo per working agent
- Status bar summary and a notification when an agent finishes or needs your input
- Experimental icon on the built-in Source Control repository rows

## Setup

Agents report their state through hooks. Run **Agent Grove: Install Agent Hooks** from the Command Palette, choose your agent, and paste the snippet it copies to your clipboard into that agent's config. Restart the agent session afterwards.

Requires Node.js on your PATH.

## Settings

- `agentGrove.hideAfterMinutes` (default 10): remove a worktree's indicator when its agent has been silent this long.

## Privacy

Everything stays on your machine. Agents write small status files to `~/.agent-grove/agents/`; the extension reads them. No network access.
