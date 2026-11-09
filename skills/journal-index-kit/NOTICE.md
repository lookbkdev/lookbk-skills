# Notices

Journal Index Kit is a Lookbk skill. The page design, the stylesheet, the
browser runtime, the build (front matter, Markdown, footnotes, figures,
charts, code colouring, the reading-time model, the feed, the sitemap and the
JSON-LD), the checks, server and recorder, the two examples and this
documentation were written for Lookbk.

The two examples are invented. Coldframe Studio and Tarnline, their writers,
clients, places, projects, numbers and charts are not real, and their
addresses use the reserved `.example` domain.

**The example photographs are AI-generated.** The six pictures in
`examples/coldframe/images/` (bench, glaze-tests, wood-type, cast-stair,
pavilion-models, felt-swatches) were generated with an image model for this
demo and are not photographs of real objects, places or people; no faces
appear in them. Replace them with your own photographs. The Tarnline charts
are drawn by the kit from the invented data in `examples/tarnline/charts/`.

Included here:

- `scripts/kit/cdp.mjs` and `scripts/kit/serve.mjs` are Lookbk's shared
  helpers from the Motion Heroes and Scroll Cinema packages.

No third-party code is vendored or loaded: Markdown, YAML front matter,
syntax colouring and charts are done by the kit's own scripts, and the
runtime is Lookbk's own.

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- **Newsreader** and **Schibsted Grotesk** (the `newsreader` pairing)
- **Geist**, **Geist Mono** and **Source Serif 4** (the `geist` pairing)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
