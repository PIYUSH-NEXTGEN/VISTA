# ADR-0001: Phase 0 tooling per agent.md Sections 5 and 12.3

- **Date:** 2026-10-30
- **Status:** Accepted (defaults from agent.md; user approved working on Phase 0)

## Context

agent.md fixes the stack: TypeScript strict, React + Vite, Tailwind + Radix,
Vitest + Testing Library + fake-indexeddb, Playwright, ESLint + Prettier.

## Decision

- ESLint flat config with `typescript-eslint` recommended + react-hooks +
  react-refresh. No import plugin cycles; circularity is checked by madge
  (`npm run cycles`), which is simpler and faster than the eslint import rule.
- Prettier is the single formatter with a repo-level check (`npm run format`).
- Vitest runs unit/integration/component tests from `tests/` with jsdom;
  fake-indexeddb is installed and seeded with a passing round-trip test so
  Phase 1 storage tests can rely on it.
- Playwright is configured for Chromium/Firefox/WebKit against
  `vite preview` (production build, strict CSP) with a passing sample spec.
- Base primitives are Radix wrappers with the app's token styling
  (button, dialog, toast, progress). Toasts keep an owned-list API
  (`useToastQueue` + `ToastViewport`) to avoid provider-context sprawl.

## Consequences

- New runtime dependencies beyond React/DOM: Radix dialog/toast/progress
  (MIT, tree-shakable, listed in package.json). All tooling is devDependencies.
- `npm run check` must stay green before every end-of-task report.
