# git-jungle 🌴

Lightweight, zero-dependency UI to manage and visualize git worktrees. Node 20+ and git are the only requirements.

```
node bin/git-jungle.js [repo-path] [--port 4173] [--no-open]
```

- Graph of every worktree branching off the base branch (ahead/behind, dirty, locked)
- Create (new or existing branch), lock/unlock, move, remove (+ optional branch delete), prune
- Auto-refreshes every 5s; remembers recent repos in `~/.git-jungle.json`
- Binds to 127.0.0.1 only; rejects foreign Host headers and requests without `X-Git-Jungle`

Runs the same on Windows, macOS and Linux (and inside a dev container: forward the port). Tests: `npm test`.

Roadmap: built-in terminal per worktree, dev-container exec adapter.
