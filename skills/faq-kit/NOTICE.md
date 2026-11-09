# Notices

FAQ Kit is a Lookbk skill. The design (the short-answer column, the two
layouts, the type sets and their styles), the FAQ Kit runtime, the build,
checks, recorder and server, the two examples (Fernwork and Orrery, which
are invented: their names, prices, people, hours, addresses and policies are
not real, and their links use `.example` addresses) and this documentation
were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes and Scroll Cinema
  packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
uses only the browser.

Fetched when a built page is opened, not shipped here:

- **Newsreader**, **Public Sans** and **JetBrains Mono** (the `book` type
  set), and **Schibsted Grotesk** and **IBM Plex Mono** (the `readout` type
  set), from Google Fonts, each under the SIL Open Font License 1.1 and
  copyright its authors.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
