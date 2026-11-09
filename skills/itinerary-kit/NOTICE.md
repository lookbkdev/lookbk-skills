# Notices

Itinerary Kit is a Lookbk skill. The page design and its two styles (paper
and night), the build, the browser runtime (map camera, label placement,
height strip, recorded tour), the checks, the recorder, the route measuring
tool and this documentation were written for Lookbk.

The two examples, Hollin Walking and Drywash Expeditions, are invented: the
companies, trips, places, people, prices and departures are not real. Their
geography is invented too. The coastline, islands, rivers, washes, dry lake,
contours and routes in `examples/*/geo.geojson` and `examples/*/route.geojson`
were generated for Lookbk from noise and hand-placed headlands and stops, and
placed in open ocean so they cannot be mistaken for a real place. You may use
them in pages built with this skill.

Included here:

- `kit/geo/natural-earth-50m.json`: **Natural Earth** land at 1:50m
  (version 4.1.0), public domain. Made with Natural Earth
  (https://www.naturalearthdata.com). It is the TopoJSON redistribution from
  **world-atlas** 2.0.2, ISC License, copyright 2013-2019 Michael Bostock
  (https://github.com/topojson/world-atlas); the licence is in
  `kit/geo/world-atlas-LICENSE.txt`. The build reads it only when trip.json
  says `"geo": "natural-earth"`.
- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Footage Heroes and Scroll Films
  packages.

No third-party code is vendored or loaded: the map projection, line
simplification, clipping and TopoJSON decoding are Lookbk's own, in
`scripts/kit/geo.mjs`.

Fetched when a built page is opened, not shipped here:

- **Newsreader**, **Public Sans** and **IBM Plex Mono** (paper), and
  **Archivo** and **JetBrains Mono** (night), from Google Fonts, each under
  the SIL Open Font License 1.1 and copyright its authors.

Methods named in the page: Naismith's rule for walking times (W. W. Naismith,
1892). The effort rule is Lookbk's own and is printed on every page.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
