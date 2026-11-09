# Notices

Integrations is a Lookbk skill. The section design, the stylesheet, the
browser runtime, the build, schema, check, server and recorder, the two
examples (Fennick and Bayline, which are invented: their names, copy, apps,
records, minutes, plans and dates are not real, and every app they list,
from Tillwright to Quayside Customs, is invented too) and this documentation
were written for Lookbk.

The wiring diagrams, the app marks (one geometric shape and one cut each,
never a real company's logo), the open switches, the setup bars and the
status shapes are drawn in inline SVG and CSS by the kit. No images, video
or icon sets are shipped.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes, Scroll Cinema and How
  It Works packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own.

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- **Newsreader**, **Public Sans** and **JetBrains Mono** (the `newsreader`
  display)
- **Archivo** and **IBM Plex Mono** (the `archivo` display)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
