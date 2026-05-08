---
name: visual-smoke
description: Reference for what visual smoke covers (and doesn't) when a fix touches client-side UI or styles. The actual smoke runs automatically in CI; this skill documents the manual decision tree for routes CI can't reach (authenticated screens, multi-step wizards, post-auth overlays).
source: https://github.com/Ethanon/developer.ai
license: MIT
---

# Visual Smoke for Client Changes

CI-green code that was never rendered can ship a regression: a CSS token rename, a missing asset, an overlay misalignment. Unit tests pass, lint passes, build passes, and the screen is still broken to a human eye.

The cheapest defense is a smoke test in the testing sense: power the thing up and see if it explodes. For UI, that means build the client, render the affected screen in a real browser, take a screenshot.

## How visual smoke runs today

**Automatically, in CI.** Configure a workflow (e.g. `.github/workflows/visual-smoke.yml`) to trigger on any PR whose diff touches:

- `client/src/UI/**` (or your equivalent component path)
- `client/src/styles/**` (or your equivalent styles path)
- `client/index.html`
- `client/vite.config.ts` (or your bundler config)

The workflow builds the client, starts the dev server, drives a headless browser (Playwright Chromium or Puppeteer) against it, captures a full-page screenshot of the landing screen, and posts a PR comment linking the artifact. No agent decision required; no manual step.

This catches:

- Build breakage (the client doesn't compile or the bundle won't serve).
- CSS token regressions on the landing screen (the most-touched shared style surface).
- Console / runtime errors during page load.
- Missing assets, broken imports, blown-up service-worker registration.

## What CI does NOT cover

The auto-smoke loads only the landing screen. It does not exercise:

- **Authenticated screens** (require a live session and a running API backend).
- **Multi-step wizards** (require API + saved state).
- **Settings or save operations** (load fine, but persisting requires backend).
- **Any overlay or sub-screen reachable only after auth or interaction.**

If your change affects one of these and the landing screenshot won't tell the reviewer anything useful, write a short **Manual smoke** section in the PR description naming what to click. Example:

```markdown
## Manual smoke

The auto-smoke covers the landing screen only; this change touches
`Dashboard/StatsPanel.module.css` which only renders after login. Please
sign in and confirm the stats panel renders without layout overflow on a
1280px viewport.
```

The reviewer reads this and clicks. That is the current ceiling for routes the runner cannot reach.

## Setting up the workflow

Example GitHub Actions job using Playwright:

```yaml
visual-smoke:
  if: >
    contains(github.event.pull_request.changed_files_url, 'client/src/UI') ||
    contains(github.event.pull_request.changed_files_url, 'client/src/styles')
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - run: npm ci
    - run: npm run build --workspace=client
    - run: npx playwright install chromium --with-deps
    - name: Smoke screenshot
      run: |
        npx vite preview --port 4173 &
        sleep 3
        npx playwright screenshot --browser chromium http://localhost:4173 smoke.png
    - uses: actions/upload-artifact@v4
      with:
        name: smoke-screenshot
        path: smoke.png
```

Adapt `npm run build --workspace=client` and the preview command to your project's build setup.

## Failure modes

If the auto-smoke job fails, do not skip it or merge anyway. Failure means one of:

1. **Build broke.** Fix the build.
2. **Page errored at load.** Open the artifact, read the runtime error, fix the root cause.
3. **Screenshot looks wrong** to the human reviewer. Treat as a regression.

A "wait it'll pass next time" rerun is not a fix. Every smoke failure has a real cause.

## Why this is a CI gate, not an agent decision

An earlier approach had the developer-agent invoke visual smoke before opening the PR. That made the agent the gate, which means a human PR could ship UI changes without smoke. CI is the better gate: every UI PR runs the smoke regardless of who opened it.

The skill remains as **documentation for the not-runnable case**. When the auto-smoke cannot reach the route the change affects, the PR description's `## Manual smoke` section is the substitute. That is the only thing this skill asks of you today.
