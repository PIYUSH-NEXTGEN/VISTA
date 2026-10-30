# ADR-0006: Handle missing worker OffscreenCanvas explicitly

- **Date:** 2026-10-30
- **Status:** Accepted for the current browser support baseline

## Context

Image rendering and analysis must stay off the UI thread. Playwright's WebKit
engine does not expose worker `OffscreenCanvas` for the current edit, convert,
health-analysis, and create operations. Import still needs to produce a
thumbnail there.

## Decision

For import only, the worker decodes the image and transfers a downscaled
`ImageBitmap`; the main thread encodes that bounded thumbnail. For worker-canvas
features, detect the missing API and show an explicit unsupported-browser
message. Do not move full-resolution rendering, conversion, or analysis to the
main thread as a fallback. Keep feature detection capability-based rather than
browser-name-based.

## Consequences

- Chromium and Firefox can use worker-canvas processing; Playwright WebKit
  reports the affected features as unsupported.
- Import remains available through the bounded thumbnail fallback.
- Physical Safari/iOS testing is still required before making product-support
  claims. A future fallback may be considered if it can preserve the worker
  processing and memory limits.
