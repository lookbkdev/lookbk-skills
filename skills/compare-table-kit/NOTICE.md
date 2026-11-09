# Notices

Compare Table Kit (Honest Comparison) is a Lookbk skill. The design (the
fact-checked brief: sourced cells, verdicts in words, the tally, the pair
view and the print layout), the Compare Table Kit runtime and stylesheet,
the build, schema, checks, recorder and server, the two examples (Hearthbook,
Clinicore, Brakewater, Tracewell and Faultline are invented: their names,
products, prices, studies and figures are not real) and this documentation
were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes and Scroll Cinema
  packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
uses only the browser (or Node, for the build).

Fetched when a built page is opened, not shipped here:

- **Instrument Serif**, **Newsreader**, **Bricolage Grotesque**,
  **Source Sans 3**, **IBM Plex Sans**, **IBM Plex Mono** and
  **JetBrains Mono**, from Google Fonts, each under the SIL Open Font
  License 1.1 and copyright its authors. A page loads only the three its
  theme names.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
