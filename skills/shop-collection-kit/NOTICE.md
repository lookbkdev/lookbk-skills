# Notices

Shop Collection Kit is a Lookbk skill. The page design (the numbered plates
that turn over to show the reverse of each piece, the FLIP filter, the
editorial band and end note, the quick view and the bag slip), its two
palettes and type pairings, the kit (build, browser runtime, check,
recorder), the still-life models (thrown ceramics with their glazes and
stamps, rings, hinged hoops, pearl studs, a pendant on a cable chain) and
the two examples (Wrenfold and SORNE, which are invented: their names,
people, copy, prices, stock, links and products are not real) and this
documentation were written for Lookbk. The product photographs in
`examples/*/photos/` were rendered with `scripts/stills.mjs` from the
examples' own page.json; they are not photographs of real products.

## Included

- **three.js** r186 (0.186.1), in `vendor/three.min.js`: MIT
  License, Copyright © 2010-2026 three.js authors. It is the same partial
  bundle Lookbk ships with Studio Product Shot (only the parts the renderer
  uses). The full licence is in `vendor/LICENSE-three.txt`.
- `scripts/stills/studio.js` and `scripts/stills/shapes.js` are Lookbk's own
  studio and profile code from Studio Product Shot, extended here with a
  true-scale camera; `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and
  `scripts/chrome.mjs` are Lookbk's shared helpers.

The page itself loads no library: its runtime is Lookbk's own plain
JavaScript, inlined in the page.

## Fetched when a built page is opened, not shipped here

- **Source Serif 4** (Adobe), **Instrument Sans** (Instrument) and **Spline
  Sans Mono** (Spline) for the `editorial` pairing, and **Bodoni Moda**
  (Owen Earl), **Albert Sans** (Albert-Jan Pool) and **IBM Plex Mono** (IBM)
  for the `didone` pairing, from Google Fonts. Each is under the SIL Open
  Font License 1.1 and copyright its authors.

## Used on your machine, not shipped

Node.js 18 or newer (MIT and other licences), Chrome, Chromium or Edge
(driven over the DevTools protocol for the check, the recorder and the still
renderer, which draws with WebGL; their own licences), and ffmpeg for the
preview video (LGPL or GPL, depending on the build).
