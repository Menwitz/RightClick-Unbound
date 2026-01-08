# Release Checklist (Chrome)

## Versioning
- [ ] Bump `manifest.json` version.
- [ ] Update version string in `main.html` and `pages/options.html`.
- [ ] Add release notes/changelog.

## QA
- [ ] Run `TEST_MATRIX.md` scenarios and record results.
- [ ] Verify Force Mode on iframe-heavy sites.
- [ ] Confirm reload prompt appears when disabling.

## Store assets
- [ ] 128x128 icon.
- [ ] Screenshots: popup (disabled/enabled/force), Settings (empty/populated).
- [ ] Promo tile (optional).
- [ ] Marquee (optional).

## Store metadata
- [ ] Update short description.
- [ ] Update detailed description and permissions rationale.
- [ ] Link to privacy policy URL.
- [ ] Support email verified.

## Package & submission
- [ ] Package ZIP from the extension root.
- [ ] Smoke test unpacked ZIP in Chrome.
- [ ] Upload to Chrome Web Store.
