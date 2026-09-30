# Agents

This document describes the specialized agents available when using the Copilot CLI task tool and guidance for when to use each in this repository.

## Overview
The task tool can launch several agent types to run focused work in separate contexts. Use agents when a task benefits from delegation, parallel work, or isolation.

## Agent types
- explore
  - Fast, parallel research across many files or modules.
  - Use for: large cross-cutting investigations, multiple independent questions, or when exploring unfamiliar code.
  - Provide complete context in the prompt; the agent is stateless.

- task
  - Executes commands: build, test, lint, dependency installs.
  - Use for: running repo tasks that may be long or noisy. Returns concise success summary on success and full output on failure.

- general-purpose
  - Full-capability agent for complex multi-step work that benefits from a separate environment.
  - Use for: large changes, multi-file refactors, or longer-running sequences that should not clutter the main conversation.

- code-review
  - Focused on reviewing code changes. Only surfaces real issues (bugs, vulnerabilities) and won’t modify code.
  - Use for: high-signal code reviews of PRs or staged changes.

## Best practices
- Provide complete, self-contained prompts when delegating work.
- Batch independent tasks into a single agent call when possible to reduce round-trips.
- Use `background` mode for long-running agents; the system will notify when they complete.
- Don’t duplicate work between agents and the main session.
- When invoking an agent, include repository root, relevant file paths, and any constraints or style rules.

## Examples
- Launch an explore agent:
  task: { "description": "Analyze worktree flow", "agent_type": "explore", "prompt": "Find code that creates or manipulates worktrees and list functions and entrypoints." }

- Run tests via task agent:
  task: { "description": "Run tests", "agent_type": "task", "prompt": "Run npm test and return failures only." }

## Notes
Keep prompts concise but include enough detail so the agent can act without follow-ups. If unsure which agent to use, start with `task` for runs and `explore` for broad searches.