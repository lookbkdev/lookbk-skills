# Notices

Pricing Kit is a Lookbk skill. The section design (the shared price scale with
its leader lines and hatched savings, the recommended plan, the comparison
that opens out of the cards, the usage calculator and the questions strip),
its two palettes and type pairings, the kit (build, browser runtime, check,
recorder), the two examples (Larchmere and Northvane, which are invented:
their names, copy, prices, limits, links and companies are not real) and this
documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs` are
  Lookbk's shared helpers from the Motion Sections Kit and Footage Heroes
  packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own plain
JavaScript, inlined in the page. There are no images or videos.

Fetched when a built page is opened, not shipped here:

- **Newsreader** (Production Type), **Public Sans** (USWDS) and **IBM Plex
  Mono** for the `editorial` pairing, and **IBM Plex Sans Condensed**, **IBM
  Plex Sans** and **IBM Plex Mono** (IBM) for the `technical` pairing, from
  Google Fonts. Each is under the SIL Open Font License 1.1 and copyright its
  authors.

Used on your machine, not shipped: Node.js 18 or newer (MIT and other
licences), Chrome, Chromium or Edge (driven over the DevTools protocol for the
check and the recorder; their own licences), and ffmpeg for the preview video
(LGPL 2.1 or GPL, depending on the build).
