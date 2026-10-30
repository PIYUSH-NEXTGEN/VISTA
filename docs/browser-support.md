# Browser support

> Record verified behavior only. Never claim support that has not been
> tested (agent.md 1.2 honest principle; agent.md 11).

## Current verified state (2026-10-30)

| Feature                                                    | Chromium               | Firefox                | WebKit                       |
| ---------------------------------------------------------- | ---------------------- | ---------------------- | ---------------------------- |
| App shell, home, navigation, and theme toggle              | e2e pass               | e2e pass               | e2e pass                     |
| Empty library and browser storage meter                    | e2e pass               | e2e pass               | e2e pass                     |
| Local PNG import, persistence, thumbnail, and image viewer | e2e pass               | e2e pass               | e2e pass                     |
| Range selection, viewer pan/zoom, metadata, previous/next  | e2e pass               | e2e pass               | e2e pass                     |
| Offline app shell after service-worker control             | e2e pass               | e2e pass               | e2e pass                     |
| Library sort/search, albums, trash and backup/restore      | unit + e2e backup pass | unit + e2e backup pass | unit + e2e backup pass       |
| Editor rotation and save-as-copy                           | e2e pass               | e2e pass               | explicit unsupported message |
| Tools format conversion                                    | e2e pass               | e2e pass               | explicit unsupported message |
| Health duplicate and cached analysis                       | e2e pass               | e2e pass               | explicit unsupported message |
| Profile image, contact sheet, PDF                          | e2e pass               | e2e pass               | explicit unsupported message |

Source: `tests/e2e/home.spec.ts` under `npm run test:e2e`; storage behavior
also has integration coverage in `tests/integration/storage.test.ts`.

The test suite exercises Playwright's Chromium, Firefox, and WebKit engines.
The table reflects `npm run test:e2e` against a freshly built preview. The
current feature checks expect worker `OffscreenCanvas` on Chromium and Firefox;
WebKit receives a clear unsupported-browser message for those worker-canvas
features. WebKit results are not a claim of testing physical Safari or iOS
devices.

## Known gaps (not yet verified or implemented)

- HEIC/HEIF and AVIF input are unsupported. Import shows an explicit format
  error with JPEG, PNG, and WebP as alternatives.
- Batch folder input uses the `webkitdirectory` file-input feature when
  available. Browser tests exercised directory selection in Chromium and WebKit;
  Firefox used the multiple-file fallback in Playwright because its virtual
  file harness does not supply a populated directory selection.
- Folder export was exercised with a mocked directory handle. A real operating
  system folder picker and write permission have not been manually verified.
- Real Safari/iOS storage quotas, eviction, persistence prompts, and memory
  behavior have not been tested on devices.
- Persistent-storage request outcomes vary by browser and are not asserted
  as a specific grant/deny result in the e2e suite.
- Real Safari/iOS, accessibility with axe or a screen reader, large-library
  performance, and quota-exceeded recovery have not been audited.
- Importing a whole directory directly into the Library is not implemented;
  folder selection is currently a Tools batch source.
- WebGPU availability for AI features (Phase 7) — feature-detect, never
  browser-sniff.

## How to extend this file

After each phase, add rows for features actually exercised on real
browsers, with the command/test that proves it.
