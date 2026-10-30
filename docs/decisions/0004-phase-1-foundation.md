# ADR-0004: Phase 1 storage, processing, and offline foundation

- **Date:** 2026-10-30
- **Status:** Accepted for the Phase 1 implementation

## Context

Phase 1 establishes local image storage, safe image import, background
processing, and offline app-shell behavior. The browser set includes
Chromium, Firefox, and WebKit; feature behavior must remain local and should
not require user photos to leave the device.

## Decision

- Use Dexie with a version 1 schema behind the `LibraryStore` interface.
- Use Comlink for worker calls, a concurrency-one queue for full-resolution
  processing, and exifr only for selected non-location metadata.
- Use TanStack Virtual for the thumbnail grid and `vite-plugin-pwa` to
  precache the static app shell.
- Accept JPEG, PNG, and WebP with bounded header inspection, 50 MB file-size
  and 100-megapixel limits. Defer HEIC; the user chose not to add the
  LGPL-3.0 `libheif-js` dependency. AVIF is not supported either.
- On browsers without worker `OffscreenCanvas`, return only a downscaled
  `ImageBitmap` for main-thread thumbnail encoding. If IndexedDB fails on
  Blob serialization with its specific Blob-preparation error, retry the
  image records using `ArrayBuffer` and reconstruct Blobs when reading.
- Cache only the static app shell. Do not cache user files or IndexedDB
  contents; require explicit user confirmation before activating updates.

## Consequences

- Full-resolution image decode, metadata extraction, and hashing remain in
  the worker. The bounded thumbnail-encoding fallback is the only image
  processing moved to the main thread.
- Browser-specific fallback coverage and supported engines are documented
  in `docs/browser-support.md`. Physical Safari/iOS devices remain untested.
- Schema version 1 is covered by persistence and transaction tests. There
  is no prior schema to migrate yet, so migration tests remain outstanding.
- Automated dependency audit currently reports four low-severity findings
  in development dependencies; `npm audit --omit=dev` reports no
  production dependency vulnerabilities. Reassess before updating PWA
  tooling; do not apply force upgrades without review.
