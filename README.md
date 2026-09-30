# git-jungle 🌴

Lightweight, zero-dependency UI for managing and visualizing git worktrees.

This repository contains an experimental VS Code extension / toolset used to explore workflows around git worktrees and local development environments.

## Quick usage

```
node bin/git-jungle.js [repo-path] [--port 4173] [--no-open]
```

## Features

- Visual graph of worktrees branching from the base branch (ahead/behind, dirty, locked)
- Create, move, lock/unlock, remove worktrees (optional branch deletion), and prune stale worktrees
- Auto-refresh with recent repos saved to `~/.git-jungle.json`
- Local-only binding (127.0.0.1) and simple request header protection for the UI

## Prerequisites

- Node.js 16+ (Node 20+ recommended)
- Git
- Visual Studio Code (for extension development)

## Setup & Development

1. Install dependencies:

   ```
   npm install
   ```

2. Open the folder in VS Code. Press `F5` to launch an Extension Development Host for testing the extension.

3. If the project includes build scripts, build with:

   ```
   npm run build
   # or
   npm run compile
   ```

## Testing

If tests are present, run:

```
npm test
```

## Security & Privacy

This tool binds to localhost by default and expects a custom header (`X-Git-Jungle`) for UI requests. Do not expose the service on public interfaces unless you add authentication and additional security controls.

## Contributing

Contributions and experiments are welcome. Please open issues or pull requests to discuss changes.

## License

Add a LICENSE file to declare project licensing (e.g., MIT).
