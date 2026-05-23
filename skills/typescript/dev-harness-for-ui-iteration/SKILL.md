---
name: dev-harness-for-ui-iteration
description: Reference for using a "DevHarness" escape hatch to render auth-gated frontend screens against `vite preview` (or your project's local preview equivalent) without booting the full backend. Lets you iterate on mobile-viewport UI polish with a screenshot-driven loop.
---

# DevHarness for UI Iteration

Most visual smoke pipelines catch "did it render at all" on the landing screen. They do **not** let you tune the polish of a screen behind sign-in: wizards, dashboards, settings, overlays. Booting the full backend stack to tweak a CSS gradient is the wrong loop.

A **DevHarness** is the escape hatch. It is a small frontend module that mounts a chosen screen inside a stub `AuthContext` (and any other context the screen depends on), so a local preview build renders the screen with no backend. You drive it with Playwright at any viewport, screenshot, tweak CSS, rebuild, screenshot again. Designer-style iteration loop, no Docker required.

This SKILL is a reference for setting up the pattern in a frontend project that does not have it yet.

## The shape

```
frontend/src/dev-harness/DevHarness.tsx   # the harness component
frontend/src/dev-harness/stubs.ts          # stub AuthContext, DataService, etc.
frontend/src/main.tsx                      # gated mount of harness vs real app
```

The harness:

1. Is **off by default** in production builds. Gate it with a build-time literal (e.g. Vite's `define` setting a `__DEV_HARNESS__` constant) that resolves to `false` unless an env var is set. The bundler tree-shakes the harness out of any bundle where the flag is unset. Verify by grepping the production bundle for harness-specific strings; nothing should match.

2. **Reads a query param** to choose which screen to mount: `?dev=wizard`, `?dev=settings`, `?dev=dashboard`. No `?dev=` param renders the normal sign-in tree (which fails without backend, as expected).

3. **Wraps the chosen screen in stub context providers.** A stub `AuthContext` returns a fake authenticated user; a stub `DataService` returns empty arrays for every read; any other context the screen depends on gets a stub that returns enough to render.

## How to enable it locally

```bash
cd frontend
VITE_ENABLE_DEV_HARNESS=true npm run build
npx vite preview --port 4173
```

Then navigate to `http://localhost:4173/?dev=wizard` (or whichever view you wired up).

## How to screenshot a flow

Drive the preview with Playwright. One small Node script per flow you care about. Each script:

1. Launches a headless browser at the target viewport (e.g. iPhone 12: 390×844).
2. Navigates to `http://localhost:4173/?dev=<view>`.
3. Walks the screen (clicking through wizard steps, opening modals, etc.) using selectors specific to that screen.
4. Dumps PNGs to `<viewname>-screenshots/<NN>-<step>.png` so sorted filenames preserve the flow order.

Example skeleton:

```js
import { chromium } from 'playwright'

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await ctx.newPage()

await page.goto('http://localhost:4173/?dev=wizard')
await page.screenshot({ path: 'wizard-screenshots/01-start.png' })

await page.click('text=Continue')
await page.screenshot({ path: 'wizard-screenshots/02-step-2.png' })

// ...

await browser.close()
```

Loop: tweak CSS, `npm run build` again, restart the preview, rerun the walker, eyeball the new PNGs against the old.

## How to add a new view

Three small changes:

1. **In the harness component**, widen the `view` prop union and add the render branch:

   ```ts
   interface Props {
     view: 'wizard' | 'landing' | 'settings'
   }

   return <AuthContext.Provider value={STUB_AUTH}>
     {view === 'wizard' ? <WizardScreen /> :
      view === 'settings' ? <SettingsScreen /> :
      <LandingScreen />}
   </AuthContext.Provider>
   ```

2. **Verify the screen's data dependencies.** If the screen reads from a `DataService` (or your equivalent), confirm the stub returns shapes that match the read sites' expectations (empty arrays, sensible defaults). If the screen reads from a context that isn't yet stubbed, add a stub.

3. **Write a walker script** if the screen has multiple states worth capturing. Otherwise a single screenshot at landing is enough.

## What this skill is NOT

- **Not a replacement for the visual-smoke CI workflow.** That workflow catches regressions in the *real* sign-in flow on master. The harness catches polish issues during local iteration; ship both.
- **Not a replacement for integration tests.** The harness uses stubbed data; it cannot tell you whether the screen behaves correctly with real backend responses.
- **Not for production.** The harness must be tree-shaken out of production bundles. Verify with a grep of the built JS.

## When to reach for it

- You are tuning CSS or layout on a screen behind sign-in and don't want to wait for the full backend boot every iteration.
- You want to screenshot a screen across multiple viewports without setting up real test data.
- You need to share a "here's what this looks like" image with a teammate without sharing access to your dev environment.

## When NOT to reach for it

- You're changing logic, not pixels. Use a real local environment or a unit test.
- You're chasing a regression that only reproduces with real data. Use a real backend.
- You're verifying the production flow works. Use the visual-smoke CI workflow.
