# Notices

How It Works is a Lookbk skill. The section design, the stylesheet, the
browser runtime, the build, schema, deliverable drawings, check, server and
recorder, the two examples (Ashby & Rowe and Northfold, which are invented:
their names, copy, people, addresses, prices, dates, quotes and logs are not
real, and the Kettle & Pike brand in the Northfold example is invented too)
and this documentation were written for Lookbk.

The programme chart, the rail, the desk and every deliverable (plan, sheet,
log, certificate, invite, slides, screen, spread) are drawn in CSS and
inline SVG by the kit. No images, video or icons are shipped.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Footage Heroes, Scroll Cinema and
  Closing CTA packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own.

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- **Newsreader**, **Hanken Grotesk** and **JetBrains Mono** (the
  `newsreader` display; Newsreader is also loaded for serif slide marks)
- **Bricolage Grotesque**, **Geist** and **Geist Mono** (the `bricolage`
  display)
- **Archivo** and **JetBrains Mono** (the `archivo` display)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
