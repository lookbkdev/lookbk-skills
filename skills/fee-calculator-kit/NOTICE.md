# Notices

Fee Calculator Kit is a Lookbk skill. The section design (the printed sum
with its operators, double rule and comparison column, the exchange margin
shown as money, the per-100 bar with its enlarged strip, the two-zone time
strip, the numbered notes, the phone result bar, the statement and receipt
layouts), its two palettes and type pairings, the kit (engine, browser
runtime, build, check with its independent reference implementation,
recorder), the two examples (Kittiwake and Brightquay, which are invented:
their names, copy, fees, rates, comparison figures, sources, links and
companies are not real) and this documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs` are
  Lookbk's shared helpers from the Motion Sections Kit and Footage Heroes
  packages.

No third-party code is vendored or loaded: the engine and runtime are
Lookbk's own plain JavaScript, inlined in the page, and the page makes no
network requests apart from the fonts. There are no images or videos.

Fetched when a built page is opened, not shipped here:

- **Newsreader** (Production Type), **Public Sans** (USWDS) and **IBM Plex
  Mono** (IBM) for the `ledger` pairing, and **Geist** and **Geist Mono**
  (Vercel) for the `terminal` pairing, from Google Fonts. Each is under the
  SIL Open Font License 1.1 and copyright its authors.

Used on your machine, not shipped: Node.js 18 or newer (MIT and other
licences), Chrome, Chromium or Edge (driven over the DevTools protocol for the
check and the recorder; their own licences), and ffmpeg for the preview video
(LGPL 2.1 or GPL, depending on the build).
