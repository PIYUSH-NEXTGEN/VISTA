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
and album items, edits, OCR, vectors, and settings in schema version 1.
Adding image rows and deleting an image with its dependent rows are
transactional.

The worker inspects a bounded file header before decoding, rejects unsupported
or unsafe images, extracts selected non-location EXIF data, computes a
SHA-256 content hash, and creates a bounded thumbnail. A concurrency-one
queue reports progress, supports cancellation, and enforces a processing
timeout. JPEG, PNG, and WebP are accepted up to 50 MB and 100 megapixels.
HEIC and AVIF are currently unsupported; see ADR-0004.

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

## Status

- Phase 0 complete: tooling, tests, headers, docs skeleton, base primitives.
- Phase 1 implementation is partial: core storage, image import, worker
  processing, library UI, and offline shell are implemented. HEIC support and
  storage migration tests remain incomplete.
- Model management remains planned for Phase 7.
