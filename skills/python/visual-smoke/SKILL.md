---
name: visual-smoke
description: Reference for what visual smoke covers (and doesn't) when a fix touches client-side UI or styles. The actual smoke runs automatically in CI; this skill documents the manual decision tree for routes CI can't reach (authenticated screens, multi-step flows, post-auth overlays).
source: https://github.com/Ethanon/developer.ai
license: MIT
---

# Visual Smoke for Client Changes

CI-green code that was never rendered can ship a regression: a CSS token rename, a missing asset, an overlay misalignment. Unit tests pass, lint passes, build passes, and the screen is still broken to a human eye.

The cheapest defense is a smoke test in the testing sense: power the thing up and see if it explodes. For UI, that means build or start the app, render the affected screen in a real browser, take a screenshot.

## How visual smoke runs today

**Automatically, in CI.** Configure a workflow (e.g. `.github/workflows/visual-smoke.yml`) to trigger on any PR whose diff touches:

- Templates or views: `src/templates/**`, `templates/**` (Django/Jinja), `app/views/**` (Flask)
- Static assets: `static/**`, `assets/**`, `public/**`
- Frontend source: `frontend/src/**`, `client/src/**` (if you have a bundled SPA)
- Bundler or build config: `vite.config.*`, `webpack.config.*`, `pyproject.toml` build section

The workflow installs dependencies, starts the dev or preview server, drives a headless browser (Playwright Chromium or Puppeteer) against it, captures a full-page screenshot of the landing screen, and posts a PR comment linking the artifact. No agent decision required; no manual step.

This catches:

- Boot breakage (the server crashes on startup or returns a 500 on the landing route).
- Template regressions on the landing screen (the most-touched shared rendering surface).
- Console / runtime errors during page load.
- Missing static assets, broken import paths, failed service-worker registration (if applicable).

## What CI does NOT cover

The auto-smoke loads only the landing screen. It does not exercise:

- **Authenticated screens** (require a live session and a running backend).
- **Multi-step flows** (require state and, often, database fixtures).
- **Settings or save operations** (load fine, but persisting requires backend).
- **Any view reachable only after login or interaction.**

If your change affects one of these and the landing screenshot won't tell the reviewer anything useful, write a short **Manual smoke** section in the PR description naming what to click. Example:

```markdown
## Manual smoke

The auto-smoke covers the landing screen only; this change touches
`templates/dashboard/stats_panel.html` which only renders after login.
Please sign in and confirm the stats panel renders without layout overflow
on a 1280px viewport.
```

The reviewer reads this and clicks. That is the current ceiling for routes the runner cannot reach.

## Setting up the workflow

### Django / Jinja templates

```yaml
visual-smoke:
  if: >
    contains(github.event.pull_request.changed_files_url, 'templates/') ||
    contains(github.event.pull_request.changed_files_url, 'static/')
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: pip install -r requirements.txt
    - run: npx playwright install chromium --with-deps
    - name: Smoke screenshot
      run: |
        python manage.py runserver 8000 &
        sleep 3
        npx playwright screenshot --browser chromium http://localhost:8000 smoke.png
    - uses: actions/upload-artifact@v4
      with:
        name: smoke-screenshot
        path: smoke.png
```

### FastAPI / Flask (uvicorn)

```yaml
visual-smoke:
  if: >
    contains(github.event.pull_request.changed_files_url, 'templates/') ||
    contains(github.event.pull_request.changed_files_url, 'static/')
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: pip install -r requirements.txt
    - run: npx playwright install chromium --with-deps
    - name: Smoke screenshot
      run: |
        uvicorn app.main:app --port 8000 &
        sleep 3
        npx playwright screenshot --browser chromium http://localhost:8000 smoke.png
    - uses: actions/upload-artifact@v4
      with:
        name: smoke-screenshot
        path: smoke.png
```

### Python backend + bundled SPA (Vite/webpack frontend served by the API)

```yaml
visual-smoke:
  if: >
    contains(github.event.pull_request.changed_files_url, 'frontend/src/') ||
    contains(github.event.pull_request.changed_files_url, 'static/')
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
    - uses: actions/setup-python@v5
      with:
        python-version: '3.12'
    - run: npm ci --prefix frontend && npm run build --prefix frontend
    - run: pip install -r requirements.txt
    - run: npx playwright install chromium --with-deps
    - name: Smoke screenshot
      run: |
        uvicorn app.main:app --port 8000 &
        sleep 3
        npx playwright screenshot --browser chromium http://localhost:8000 smoke.png
    - uses: actions/upload-artifact@v4
      with:
        name: smoke-screenshot
        path: smoke.png
```

Adapt the start command (`manage.py runserver`, `uvicorn`, `gunicorn`, `flask run`) and the trigger paths to your project's layout.

## Failure modes

If the auto-smoke job fails, do not skip it or merge anyway. Failure means one of:

1. **Server crashed on startup.** Check logs. Fix the boot error.
2. **Page errored at load.** Open the artifact, read the runtime error, fix the root cause.
3. **Screenshot looks wrong** to the human reviewer. Treat as a regression.

A "wait it'll pass next time" rerun is not a fix. Every smoke failure has a real cause.

## Why this is a CI gate, not an agent decision

An earlier approach had the developer-agent invoke visual smoke before opening the PR. That made the agent the gate, which means a human PR could ship UI changes without smoke. CI is the better gate: every UI PR runs the smoke regardless of who opened it.

The skill remains as **documentation for the not-runnable case**. When the auto-smoke cannot reach the route the change affects, the PR description's `## Manual smoke` section is the substitute. That is the only thing this skill asks of you today.
