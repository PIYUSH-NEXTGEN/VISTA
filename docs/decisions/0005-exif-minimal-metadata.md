# ADR-0005: Extract a minimal EXIF metadata allowlist

- **Date:** 2026-10-30
- **Status:** Accepted

## Context

VISTA needs capture date and camera information for browsing while keeping the
privacy promise and minimizing stored personal metadata. EXIF may contain GPS,
owner names, serial numbers, and other identifying fields.

## Decision

Use the existing `exifr` package in the image worker and request only
`DateTimeOriginal`, `CreateDate`, `Orientation`, `Make`, and `Model`. Store the
normalized date, orientation, and combined camera make/model. Do not persist
GPS or the complete EXIF object. Keep export of originals explicit; when a
user selects metadata removal, re-encode the image and report that metadata is
removed.

## Consequences

- Browsing can search/sort by useful capture metadata without retaining the
  full EXIF payload.
- Original exports preserve their original metadata unless the user chooses
  re-encoding. This behavior must remain visible in the export UI.
- EXIF parsing is performed in the worker and should be regression-tested with
  generated EXIF fixtures.
