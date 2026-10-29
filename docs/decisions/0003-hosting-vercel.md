# ADR-0003: Hosting provider — Vercel

- **Date:** 2026-10-30
- **Status:** Accepted (chosen by the user, 2026-10-30)

## Context

Section 5.1 required a hosting decision with custom-header support (needed
for the strict CSP). Candidates: Cloudflare Pages, Netlify, Vercel, GitHub
Pages (rejected — no custom headers).

## Decision

**Vercel**, chosen by the user.

## Consequences

- Headers now ship via `vercel.json` (Vercel's mechanism), matching
  `public/_headers` exactly. `public/_headers` can be deleted if the team
  ever moves to Netlify/Cloudflare; it currently serves as the shared spec
  and keeps `vite preview` parity tests possible.
- `connect-src 'self'` must be extended with the pinned model host before
  Phase 7 model downloads work in production.
- COOP/COEP stay unset unless multi-threaded WASM requires them (agent.md
  9.3); if enabled later, add and test them in both `vercel.json` and the
  preview server config.
- Vercel automatically handles immutable asset caching for hashed `dist/`
  files, so no cache headers are configured here.
