# Architecture

> Living doc; keep in sync with agent.md Sections 4 and 6.

## Stack

Vite + React + TypeScript (strict). Styling: Tailwind v4 with design tokens
defined as CSS custom properties in `src/app/index.css` (light + dark themes).
Base primitives: Radix (`@radix-ui/react-dialog`, `-toast`, `-progress`)
wrapped in small token-styled components in `src/ui/`.

Phase 1 adds Dexie for IndexedDB, Comlink for the image worker, exifr for
selected EXIF fields, TanStack Virtual for the thumbnail grid, and
`vite-plugin-pwa` for the offline app shell. Exact dependency versions are
recorded in `package.json`.

## Layering rules (agent.md Section 4)

- `core/*` never imports from `features/*` or `ui/*`.
- `features/*` may import from `core/*` and `ui/*`; features never import
  other features directly — share through `core/`.
- `core/image-ops` stays pure (no React, no storage access).
- All storage goes through the `core/storage` interface. Nothing else touches
  IndexedDB directly.
- Enforced mechanically: `npm run cycles` (madge circular check).

## Commands (agent.md Section 12.3)

```
npm run dev | build | preview | typecheck | lint | format |
test | test:e2e | cycles | audit | check
```

`npm run check` = typecheck + lint + format + cycles + tests. Run before
every end-of-task report.

## Security headers and CSP

- `public/_headers` holds the production headers in a
  Netlify/Cloudflare-compatible format and is the shared spec. The chosen
  host is **Vercel** (ADR-0003), which reads the equivalent configuration
  from `vercel.json`. Keep both files in sync.
- `vite preview` applies the same strict CSP, so e2e tests run under
  production-equivalent headers. `npm run dev` is intentionally more
  permissive because HMR needs inline scripts and eval.
- Production CSP: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval';
style-src 'self'; img-src 'self' blob: data:; font-src 'self';
connect-src 'self'; worker-src 'self' blob:; object-src 'none';
base-uri 'self'; frame-ancestors 'none'`.
- The theme-boot snippet lives in `public/theme-boot.js` (external file) so
  the app shell needs no inline script — verified by the e2e suite, which
  runs against the strict CSP via `vite preview`.
- `connect-src` must be extended in Phase 7 with the pinned model host.
- COOP/COEP are not set; add them only if multi-threaded WASM requires it
  (agent.md 9.3), and retest all features afterwards.

## Phase 1 data flow

The library UI calls a feature hook, which validates and processes files via
the Comlink worker and then writes through the `LibraryStore` interface.
`DexieLibraryStore` stores image metadata and originals, thumbnails, albums
and album items, edits, OCR, vectors, and settings. The current schema is
version 3: v2 added recoverable trash and v3 added indexed perceptual hashes.
Version 1 and 2 migration tests exercise upgrades to v3. Adding image rows and
permanently deleting an image with its dependent rows are transactional.

The worker inspects a bounded file header before decoding, rejects unsupported
or unsafe images, extracts selected non-location EXIF data, computes a
SHA-256 content hash, and creates a bounded thumbnail. A concurrency-one
queue reports progress, supports cancellation, and enforces a processing
timeout. JPEG, PNG, and WebP are accepted up to 50 MB and 100 megapixels.
HEIC/HEIF and AVIF are unsupported; import points users to JPEG, PNG, or WebP.
See ADR-0004.

On browsers without worker `OffscreenCanvas`, the worker transfers a
downscaled `ImageBitmap` for thumbnail encoding on the main thread. If a
browser rejects IndexedDB Blob serialization with its specific Blob
preparation error, storage retries with `ArrayBuffer` records and recreates
Blobs when reading. These compatibility paths do not move full-resolution
decoding or hashing onto the main thread.

The thumbnail grid is virtualized. Selection and the image viewer operate on
the locally stored library. The storage meter reports browser estimates and
offers an explicit persistent-storage request. The service worker precaches
the static app shell only; user photos and IndexedDB data are never cached by
the service worker. Updates are activated only after user confirmation.

The Library includes sort, format filter, metadata/name search, album
management, trash with undo and permanent cleanup, whole-library ZIP backup
and restore, and a backup reminder. Restore validates the archive and manifest
and reports merged/skipped rows. The Editor stores versioned edit steps and
exports a new copy. Tools use browser-native encoders for format/quality
conversion, target-size search, batch copies, ZIP export, and metadata
stripping. Browser-native encoders do not provide the codec coverage of the
planned WASM codecs. Health groups exact and perceptual duplicates and caches
brightness/focus analysis. Create makes profile images, platform presets, JPEG
contact sheets, and single-page PDFs.

The generated-library smoke test grouped exact and near duplicates in 5,000
records in 7.1 ms in one local Vitest run (2026-10-30). This is a single-run
measurement of grouping only, not import throughput, rendering, or mobile
performance.

Worker rendering and analysis paths report an unsupported-browser error when
worker `OffscreenCanvas` is unavailable. This affects editing, conversion,
Health analysis, and Create in the Playwright WebKit engine. Import has a
separate thumbnail fallback described above.

## Status

- Phase 0 complete: tooling, tests, headers, docs skeleton, base primitives.
- Phase 1 is partial: HEIC input is unsupported. Migration tests cover v1/v2
  upgrades.
- Phases 2 through 6 are implemented to varying levels; verification and
  browser limitations are recorded in `agent.md` Section 14 and
  `docs/browser-support.md`.
- Phase 7 is not started because model license and hosting decisions remain
  open. No model or OCR dependency has been selected.
