# ADR-0002: Open decisions from agent.md Section 5.1

- **Date:** 2026-10-30
- **Status:** Raised with the user; pending answers.

Section 5.1 requires the agent to raise these decisions, not assume:

1. **Model selection and licensing** (Phase 7 prerequisites) — deferred
   until Phase 7 planning. `docs/models.md` records the required per-model
   fields; no model is selected or downloaded until a license is verified
   in writing.
2. **Model hosting** (own bucket/CDN vs public hub) — deferred with (1);
   the loader design will pin SHA-256 and self-host copies once chosen.
3. **Project license** — answered: MIT (`LICENSE`, copyright
   Piyush Baraskar, 2026). Third-party notices will be added if/when more
   runtime dependencies ship.
4. **Hosting provider** — answered: **Vercel** (2026-10-30). See
   ADR-0003. Production headers ship via `vercel.json`; `public/_headers`
   remains the shared spec for future re-hosting.
