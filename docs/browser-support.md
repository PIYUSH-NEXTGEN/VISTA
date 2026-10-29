# Browser support

> Recordes verified behavior only. Never claim support that has not been
> tested (agent.md 1.2 honest principle; agent.md 11).

## Current verified state (2026-10-30)

| Feature                               | Chromium | Firefox  | WebKit   |
| ------------------------------------- | -------- | -------- | -------- |
| App shell + home + nav + theme toggle | e2e pass | e2e pass | e2e pass |

Source: `tests/e2e/home.spec.ts` under `npx playwright test`.

## Known / expected gaps (not yet tested)

- File System Access API folder import (`showDirectoryPicker`) — Chromium
  only; Firefox/Safari need download/zip fallbacks.
- Persistent storage quotas on Safari/iOS are stricter; test when storage
  lands (Phase 1) on real devices.
- WebGPU availability for AI features (Phase 7) — feature-detect, never
  browser-sniff.

## How to extend this file

After each phase, add rows for features actually exercised on real
browsers, with the command/test that proves it.
