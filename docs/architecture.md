# Architecture

> Living doc; keep in sync with agent.md Sections 4 and 6.

## Stack

Vite + React + TypeScript (strict). Styling: Tailwind v4 with design tokens
defined as CSS custom properties in `src/app/index.css` (light + dark themes).
Base primitives: Radix (`@radix-ui/react-dialog`, `-toast`, `-progress`)
wrapped in small token-styled components in `src/ui/`.

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

## Data flow (target state, agent.md Section 6)

UI -> feature hooks -> `core/storage` (Dexie). Heavy work goes through
`core/workers` (Comlink) into `core/image-ops` / `core/models`. Process one
full-resolution image at a time; analysis and previews use downscaled copies.

## Status

- Phase 0 complete: tooling, tests, headers, docs skeleton, base primitives.
- Not yet present: storage layer, workers, PWA shell, PWA manifest/icons
  (planned Phase 1), model management (Phase 7).
