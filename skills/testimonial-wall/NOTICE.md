# Notices

Testimonial Wall is a Lookbk skill. The section design, its two themes
(letters and ledger), the kit (schema, build, browser runtime, checks,
recorder), the two examples (Wrenmoor and Tallyport, which are invented:
their names, people, quotes, ratings, figures, cases and publications are
not real) and this documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Footage Heroes, Scroll Films and
  Motion Sections packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
uses no library.

Fetched when a built page is opened, not shipped here:

- **Newsreader** (Production Type) and **Hanken Grotesk** (Hanken Design
  Co.) for the letters theme, and **Familjen Grotesk** (Familjen STHLM) and
  **Spline Sans Mono** (Spline) for the ledger theme, from Google Fonts,
  each under the SIL Open Font License 1.1 and copyright its authors.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over
the DevTools protocol) and ffmpeg.
