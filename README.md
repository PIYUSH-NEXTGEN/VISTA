# VISTA

A private photo library and image toolkit that runs **entirely in your
browser**. No backend, no accounts, no uploads: photos, albums, edits, and
settings live on your own device (IndexedDB), and all processing — import,
editing, compression, OCR, analysis — happens locally.

## Privacy promise

- Nothing you put into VISTA is ever uploaded to a server by us.
- No analytics, tracking, or third-party scripts at runtime.
- Honest limitation: data stored in the browser is **not encrypted at rest**
  by VISTA; anyone with access to that browser profile can read it. Back up
  your library (export) — browser storage can be cleared.

## What it does (MVP target)

1. **One private library** — drag-and-drop import, fast grid, sort, search,
   albums.
2. **Library health** — duplicates, blurry, dark, low-res detection with
   "keep best" cleanup and undo.
3. **Non-destructive editor** — crop, resize, rotate, adjustments; originals
   are never overwritten.
4. **Everyday solvers** — "under 200 KB for an upload form", profile
   pictures, platform presets.
5. **Receipts & screenshots to text** — OCR, structured CSV/JSON export.
6. **Export, back up, share** — zip export, share sheet, whole-library
   backup/restore.

Full scope and build phases: see `agent.md` (single source of truth).

## Getting started

```
npm install
npm run dev       # http://localhost:5173
```

## Commands

```
npm run check     # typecheck + lint + format + cycles + unit tests  (run before every report / commit)
npm run test:e2e  # Playwright: Chromium, Firefox, WebKit against the production preview
npm run build     # tsc --noEmit + vite build -> dist/
npm run preview   # serve dist/ with production-equivalent security headers
npm run audit     # npm audit (report only)
```

First e2e run needs Playwright browsers: `npx playwright install`.

## Browser support

Chromium, Firefox, and WebKit are exercised by the e2e suite (`docs/
browser-support.md` records what is verified — never a claim without a test).

## Security

- Strict CSP shipped via `public/_headers` (and mirrored on `vite preview`);
  `npm run dev` is intentionally more permissive for HMR.
- No secrets in the bundle; all user processing stays on-device.

## Project layout

See `docs/architecture.md` (keeps in sync with agent.md Section 4/6).

## License

MIT — see `LICENSE`.
