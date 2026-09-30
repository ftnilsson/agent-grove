# Testing Guide

This document explains how to run, debug, and add tests for the repository (VS Code extension and supporting tools).

## Prerequisites
- Node.js (16+ recommended)
- npm
- Visual Studio Code (for extension test debugging)

## Install dependencies

```bash
npm install
```

## Run unit tests

If the project provides a test script, run:

```bash
npm test
```
```

Common variants:
- `npm run test` — runs the repository's test suite (Mocha/Jest/etc).
- `npm run test:watch` — run tests in watch mode (if configured).

## Extension integration tests (VS Code)

Many VS Code extension projects use the vscode-test or @vscode/test-electron helpers. Typical npm scripts:

- `npm run test` — run extension tests (launches a test Extension Development Host)
- `npm run test:integration` — run longer integration tests against a real workspace

To debug extension tests in VS Code:
1. Open the repository in VS Code.
2. Open the Run and Debug view and choose the "Extension Tests" configuration (or create one).
3. Set breakpoints and start the debug session.

## Running a single test file

Use the test runner CLI for the framework used (e.g., `npx mocha test/suite/my-test.js` or `npx jest test/my.test.js`). Check package.json for exact scripts and test framework.

## Writing tests

- Put unit tests under `test/` or `src/test/` depending on repo conventions.
- For extension tests, use the `vscode` test API and run in a disposable workspace.
- Keep tests deterministic; mock external network and filesystem interactions when possible.

## CI

- Ensure `npm ci` or `npm install` and `npm test` are part of CI steps.
- Cache node_modules between runs according to your CI provider to speed up builds.

## Troubleshooting

- If tests fail locally but pass on CI, check node/npm versions and environment variables.
- For extension tests, ensure the test host is not blocked by antivirus or firewall.

If you'd like, run the test suite now or add CI configuration — which would you prefer?