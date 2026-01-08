# Store Copy Draft (Chrome Web Store)

## Short description
Unlock copy and right-click on sites that block it.

## Detailed description
RightClick Unbound restores right-click and copy on restrictive pages in one click. Use the optional Force Mode for stubborn sites that still block text selection. Everything is controlled per site, so you stay in charge of where it runs.

Key features:
- One-click enable for the current site.
- Force Mode for stricter sites.
- Per-site list management in Settings.
- Clear status and reload prompts.

How it works:
1) Open the extension popup.
2) Toggle "Unlock Copy" for the current site.
3) Use "Force Mode" if needed and reload when prompted.

Tested scenarios:
- News sites (nytimes.com, medium.com).
- Docs apps (docs.google.com, notion.so).
- PDFs (local or web).
- Embedded iframes.

Privacy:
- No data collected. No accounts. No tracking.

Limitations:
- Some sites may not be unlockable due to strict security policies.

Support:
- Email: support@rightclickunbound.app

## Permissions rationale
- tabs, activeTab: detect the active tab and reload when toggles change.
- storage: save your per-site preferences.
- scripting: inject enable scripts on sites you choose.
- host permissions (<all_urls>): allow running on any site you opt into.

## Store assets checklist
- Extension icon: 128x128.
- Screenshots: 1280x800 (or store-required sizes).
  - Popup (disabled state).
  - Popup (enabled).
  - Popup (Force Mode).
  - Settings list with entries.
  - Settings empty state.
- Promo tile: 440x280 (optional).
- Marquee: 1400x560 (optional).
