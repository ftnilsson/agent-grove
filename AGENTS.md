# Claude Agents

This document covers using Anthropic Claude models via the Copilot CLI task tool in this repository. It explains when to prefer Claude models, example invocations, and best practices.

## Available Claude models
- claude-haiku-4.5 — lower-latency, cost-effective; good for quick lookups and small analyses.
- claude-sonnet-4.6 — higher-capability model for complex reasoning, long-form synthesis, and deep code analysis.

## When to use Claude vs other models
- Use Claude-sonnet for large, multi-step refactors, architecture summarization, or deep code reviews where higher reasoning quality helps.
- Use Claude-haiku for fast exploratory searches, short summarization tasks, or background data extraction.

## Invocation examples (task tool)
- Run tests with a Claude agent (task agent, sonnet model):

  task: {
    "description": "Run tests with full logs",
    "agent_type": "task",
    "model": "claude-sonnet-4.6",
    "prompt": "Run npm test and return failing tests and stack traces."
  }

- Explore code with a haiku agent (explore agent):

  task: {
    "description": "Find worktree-related code",
    "agent_type": "explore",
    "model": "claude-haiku-4.5",
    "prompt": "Search the repo for functions and files that create, move, or prune git worktrees. List file paths and short summaries."
  }

## Best practices
- Include repository root, file paths, and precise goals in the prompt — agents are stateless.
- Prefer sonnet for high-quality, high-effort tasks; haiku for quick/parallel scans.
- When running potentially disruptive commands, ask for explicit confirmation in the prompt and run in `background` mode if long-running.
- Avoid sending secrets or private keys in prompts. Treat outputs as reviewable developer artifacts.

## Notes
Tailor the model selection based on cost, latency, and task complexity. For critical safety/security reviews, pair Claude-sonnet analysis with human review.