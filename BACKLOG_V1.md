# V1 Backlog

## Scope
Chrome-only release with clear toggles, per-site control, and strong trust signals.

## Must have (v1)
- Reliable MV3 injection across iframes.
  - Accepts: toggles apply to main frame and iframes where possible.
- Clear status and reload prompts in the popup.
  - Accepts: status always reflects current site; reload prompt appears after disable.
- Per-site list with mode and last-enabled diagnostics.
  - Accepts: no duplicates; entries show mode and timestamp.
- Settings guidance and limitations.
  - Accepts: "How it works" and "Limitations" present and readable.
- Privacy and permissions clarity.
  - Accepts: privacy policy available; permissions listed in Settings and docs.
- Support/FAQ documentation and contact email.
  - Accepts: support email visible in Settings and docs.
- Store-ready copy and asset checklist.
  - Accepts: descriptions, screenshots list, and privacy link prepared.

## Should have (v1.1)
- Session-only toggle (auto disable on tab close).
- Soft failure messaging when injection is blocked.
- Optional advanced rules per site.

## Out of scope (v1)
- Paywall bypass or DRM circumvention.
- Cross-browser support beyond Chrome.
- Automation or scraping features.
