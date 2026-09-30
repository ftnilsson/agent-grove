# Agent Grove: notes for contributors and coding agents

Agent Grove shows per-worktree AI agent status in VS Code. See [README.md](README.md) for what it does.

## Layout

| Path | What it is |
|---|---|
| `extension/` | The VS Code extension (`extension.js`, `package.json`, `media/` icons). CommonJS, bundled with esbuild into `extension/dist/`. |
| `hooks/hook.mjs` | The hook that Claude Code, Codex CLI and Copilot CLI call. Writes `~/.agent-grove/agents/<agent>-<session>.json`. Must never throw or block. |
| `lib/git.js` | Git helpers the extension uses: resolve a repo and list its worktrees. ESM, inlined into the bundle. |
| `scripts/` | `build-extension.mjs` (bundle + copy hook), `make-icons.mjs` (generate `extension/media/*.svg` from the codicon font). |
| `test/` | `node --test` suites for `lib/git.js` and the hook. |

## Commands

- `npm test` – run all tests (creates temp git repos; they disable commit signing themselves).
- `npm run build:ext` – bundle the extension. `npm run package:ext` – produce `agent-grove.vsix`.
- `npm run icons` – regenerate the SVG icons (needs the dev dependencies).
- **Releases:** `.github/workflows/release.yml` runs on a `vX.Y.Z` tag on `main`, or manually via "Run workflow" (it bumps the latest release and creates the tag). Release names come from `ftnilsson/generate-release-name-action@v3`. The tag is the source of truth: the workflow writes the version into `extension/package.json` at build time, so the committed version may lag. Do not bump it by hand for a release. `ci.yml` runs tests (Linux and Windows) and a package dry run on every push and PR.

## Design rules

- **State model:** each session file holds `state` = `running | waiting | idle` plus `agent`, `root` (worktree path), `updatedAt`. The extension folds sessions per worktree with waiting > running > idle, and hides sessions with no event for `agentGrove.hideAfterMinutes`.
- **Hooks are best effort.** `hook.mjs` swallows every error and exits 0.
- **The extension never edits agent config files.** It copies the hook and offers a snippet; the user pastes it.
- Claude's `Notification` with `notification_type: idle_prompt` means idle, not waiting.
- Copilot CLI sends camelCase events with no event name in the payload, so its hooks pass `--event`.

## Gotchas

- **Local state lives in `~/.agent-grove/`:** `agents/` (status files), and `hook.mjs` (the copy agents call). Override the status folder with `AGENT_GROVE_STATUS_DIR` (used by the tests).
- `extension.js` imports `../lib/git.js` with a literal path so esbuild inlines it. Do not make that path dynamic.
- Animated SVG icons: VS Code only spins built-in codicons and only tints them with theme colours, hence the generated SVGs.
- The global git config may sign commits with a passphrase-protected key; automated commits hang unless signing is disabled for that command.
- Shell heredocs containing backticks or apostrophes can truncate files; prefer editing files directly.
