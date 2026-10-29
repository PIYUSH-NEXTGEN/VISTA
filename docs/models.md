# Models

> One entry per AI model used by VISTA. Nothing may be downloaded or shipped
> before the license is verified in writing and listed here (agent.md 5.1,
> 16.2). This file is intentionally empty: Phase 7's model manager is not
> started and no model has been selected yet.

Expected fields per model:

| Field             | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| Purpose           | What the model does in VISTA (bg removal, OCR, CLIP search, ...) |
| Source            | Exact hosting URL we download from (self-hosted copy preferred)  |
| License           | License of the weights, verified from the model card itself      |
| Size              | Download size on disk                                            |
| SHA-256           | Pinned hash; the loader refuses a mismatched download            |
| Resolution limits | Limits documented honestly in the UI                             |
| Known weaknesses  | Quality limits, measured, not assumed                            |
