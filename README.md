# RightClick Unbound

Restore right-click and copy on restrictive pages with quick toggles and an optional force mode.

## Usage
- Click the extension icon to open the popup.
- Toggle "Unlock Copy" to enable on the current site.
- Toggle "Force Mode" for stricter sites that still block copy.
- Reload the tab when prompted to apply changes.
- Open Settings to manage your site list and remove entries to disable.

## Quick test pass
- News site: nytimes.com or medium.com. Toggle Unlock Copy, verify copy + right-click, then disable and confirm reload prompt.
- Docs app: docs.google.com or notion.so. Verify toggles and list entry behavior.
- PDF: local file or web PDF. Ensure it still works and does not break selection.
- Embedded iframe page: enable and confirm copy inside the iframe.

## Permissions
- `tabs` and `activeTab`: detect the active tab and trigger reloads when toggles change.
- `storage`: save the user list and per-site mode choices.
- `scripting`: inject enable scripts on pages you opt into.
- Host permissions (`<all_urls>`): allow running on any site you choose.

## Privacy
See `PRIVACY.md` for the full privacy policy.

## Support
Email: support@rightclickunbound.app
For troubleshooting tips, see `SUPPORT.md`.

## Store Link
- Chrome: https://chromewebstore.google.com/detail/rightclick-unbound/jdocbkpgdakpekjlhemmfcncgdjeiika
