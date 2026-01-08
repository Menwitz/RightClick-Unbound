# RightClick Unbound Roadmap (Chrome)

## Phase 0 - Definition (done)
- Product brief, audience, and positioning.
- Phase 0 checklist and MVP acceptance criteria.

## Phase 1 - Core hardening (2-3 weeks)
- Improve injection reliability (iframes, strict CSP, shadow DOM).
- Clarify site state in the popup and prevent duplicate list entries.
- Add graceful handling for non-http(s) tabs with a clear message.
- Add basic diagnostics in Settings (last enabled time, mode per site).
- Tighten permission explanations in UI copy.

## Phase 2 - UX and visual polish (2-3 weeks)
- Refresh popup layout for casual users (clear labels, short helper text).
- Refine Settings layout and empty-state guidance.
- Align iconography and colors with the brand palette.
- Add a short "How it works" section.

## Phase 3 - Compliance and trust (1-2 weeks)
- Publish a privacy policy (no data collected).
- Add a permissions rationale section and link to support.
- Add a "limitations" section for sites that cannot be unlocked.

## Phase 4 - QA and store readiness (1-2 weeks)
- Build a test matrix for top websites and tricky cases.
- Validate MV3 compatibility across Chrome stable/beta.
- Produce store assets and finalize listing copy.
- Verify versioning, changelog, and release notes.
  - References: `TEST_MATRIX.md` and `RELEASE_CHECKLIST.md`.

## Phase 5 - Growth and feedback (ongoing)
- Add a feedback link and basic support FAQ.
- Triage issues and iterate on Force Mode behavior.
- Monitor reviews and prioritize fixes.

## Release target
- v1.0 after Phase 4 with stable core behavior and store-ready assets.
