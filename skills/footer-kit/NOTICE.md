# Notices

Footer Kit is a Lookbk skill. The design (the sheet and the board, the
four layouts and their styles), the Footer Kit runtime, the build, checks,
recorder and server, the two examples (Ferrow and Ostrel, which are
invented: their names, addresses, registration numbers, phone numbers,
hours, people, quotes and streets are not real) and this documentation were
written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes and Scroll Cinema
  packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
uses only the browser. The check decodes its screenshots with Node's own
zlib.

Fetched when a built page is opened, not shipped here:

- **Gloock**, **Instrument Serif** and **Bricolage Grotesque** (display),
  **Hanken Grotesk** (text) and **IBM Plex Mono** (labels), from Google
  Fonts, each under the SIL Open Font License 1.1 and copyright its authors.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
