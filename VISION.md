# RightClick Unbound Vision

## Vision
Make the restricted web feel open again with one click and zero anxiety. The extension should be simple for casual users and powerful for advanced users, while staying transparent, reversible, and privacy-first.

## Audience
- Casual users: want a fast toggle that just works.
- Power users: want per-site control, diagnostics, and clear troubleshooting.

## Product principles
- Transparent: always show what is enabled and where.
- Reversible: one click to disable, no hidden global state.
- Minimal permissions with plain-language explanations.
- Fast and clear: instant toggle and explicit reload prompts.
- Privacy-first: no data collection or tracking.

## V1 definition
- One-click Unlock Copy and Force Mode for the current site.
- Per-site list with mode and last enabled diagnostics.
- Clear status, reload prompts, and "cannot run here" messaging.
- Helpful settings guidance plus privacy, permissions, and limitations copy.
- Support and FAQ documentation.

## 0-to-1 milestones
- 0.2: MV3 stability, all-frames injection, deduped site list.
- 0.4: UI clarity, status and empty-state guidance.
- 0.6: Privacy policy, permissions rationale, and support loop.
- 0.8: QA matrix and release checklist.
- 1.0: Store-ready release with stable core behavior.

## Success metrics
- Install to active ratio above 30%.
- Support tickets per 1k users below 10.
- Review rating at or above 4.2.
- Force Mode usage trend to guide fixes.
- Low disable rate due to breakage.

## Risks and constraints
- Some sites cannot be unlocked due to strict security policies.
- Force Mode may break site interactions.
- MV3 limits background behavior to service workers.

## Next ideas (post 1.0)
- Session-only toggle for temporary enablement.
- "Why it failed" hints when injection is blocked.
- Power-user rules per site (optional custom CSS/JS).
