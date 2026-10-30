# VISTA

A private photo library and image toolkit that runs entirely in your browser.
No backend, accounts, or photo uploads. Photos, albums, edits, and settings
remain in local browser storage (IndexedDB).

## Privacy promise

- Nothing you put into VISTA is uploaded by the app.
- No analytics, tracking, or third-party scripts run at runtime.
- Data in browser storage is **not encrypted at rest** by VISTA. Anyone with
  access to that browser profile could read it. Browser storage can also be
  cleared, so keep a local backup.

## Current features

- **Library:** import, virtualized browsing, sort, format filter, metadata/name
  search, albums, recoverable trash, and local storage controls.
- **Backup:** export and restore a whole-library ZIP with a manifest and
  checksums.
- **Editor:** non-destructive crop, resize, rotate, flip, and color adjustments;
  save edits as new copies.
- **Tools:** native browser format conversion, quality and target-size controls,
  batch copies, ZIP/folder export where available, and metadata stripping.
- **Health:** exact/near duplicate groups and cached blur, brightness, and
  resolution screening. These are review hints, not quality guarantees.
- **Create:** profile images, social presets, contact sheets, and PDF output.

OCR, receipt extraction, background/object removal, and semantic search are
planned for Phase 7. That phase requires model/license and hosting decisions
first; it has not started.

See `agent.md` for full scope and build status.

## Getting started

```sh
npm install
npm run dev       # http://localhost:5173
```

## Commands

```sh
npm run check     # typecheck, lint, format, cycles, and unit/integration tests
npm run test:e2e  # Playwright: Chromium, Firefox, WebKit
npm run build     # tsc --noEmit and production Vite build
npm run preview   # serve dist/ with production-equivalent security headers
npm run audit     # npm audit (report only)
```

First E2E run needs Playwright browsers: `npx playwright install`.

## Browser support

See [`docs/browser-support.md`](docs/browser-support.md) for tested coverage
and known gaps. Import supports JPEG, PNG, and WebP, up to 50 MB and 100
megapixels per image. HEIC/HEIF and AVIF input are unsupported; use JPEG, PNG, or
WebP instead. Editor, conversion, health analysis, and Create require worker
`OffscreenCanvas`; Playwright WebKit
reports those features as unsupported. Physical Safari and iOS have not been
tested.

## Security

- Strict CSP ships via `public/_headers` and is mirrored on `vite preview`;
  `npm run dev` is intentionally more permissive for HMR.
- No secrets are included in the bundle; user image processing stays on-device.

## Project layout

See `docs/architecture.md` (aligned with `agent.md` Sections 4 and 6).

## License

MIT; see `LICENSE`.
