# Browser support

> Record verified behavior only. Never claim support that has not been
> tested (agent.md 1.2 honest principle; agent.md 11).

## Current verified state (2026-10-30)

| Feature                                                    | Chromium | Firefox  | WebKit   |
| ---------------------------------------------------------- | -------- | -------- | -------- |
| App shell, home, navigation, and theme toggle              | e2e pass | e2e pass | e2e pass |
| Empty library and browser storage meter                    | e2e pass | e2e pass | e2e pass |
| Local PNG import, persistence, thumbnail, and image viewer | e2e pass | e2e pass | e2e pass |
| Range selection, viewer pan/zoom, metadata, previous/next  | e2e pass | e2e pass | e2e pass |
| Offline app shell after service-worker control             | e2e pass | e2e pass | e2e pass |

Source: `tests/e2e/home.spec.ts` under `npm run test:e2e`; storage behavior
also has integration coverage in `tests/integration/storage.test.ts`.

The test suite exercises Playwright's Chromium, Firefox, and WebKit engines.
WebKit results are not a claim of testing physical Safari or iOS devices.

## Known gaps (not yet verified or implemented)

- HEIC input is deferred; AVIF is also not accepted. JPEG, PNG, and WebP are
  the supported import formats.
- Real Safari/iOS storage quotas, eviction, persistence prompts, and memory
  behavior have not been tested on devices.
- Persistent-storage request outcomes vary by browser and are not asserted
  as a specific grant/deny result in the e2e suite.
- File System Access API folder import (`showDirectoryPicker`) is not
  implemented.
- WebGPU availability for AI features (Phase 7) — feature-detect, never
  browser-sniff.

## How to extend this file

After each phase, add rows for features actually exercised on real
browsers, with the command/test that proves it.
