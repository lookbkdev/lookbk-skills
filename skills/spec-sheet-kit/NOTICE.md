# Notices

Spec Sheet Kit is a Lookbk skill. The design (the drawing sheet and its
schedule, the drafting conventions as set here, the compare and print
layouts), the Spec Sheet Kit core and runtime, the build, schema, checks,
recorder and server, the two examples (Fennick Works and Ampwright, which
are invented: their names, products, drawing numbers, figures and parts are
not real) and this documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes and Scroll Cinema
  packages.

No third-party code is vendored or loaded: the core and runtime are
Lookbk's own and use only the browser (or Node, for the build).

Fetched when a built page is opened, not shipped here:

- **Newsreader**, **IBM Plex Serif**, **Archivo**, **IBM Plex Sans**,
  **IBM Plex Mono** and **JetBrains Mono**, from Google Fonts, each under the
  SIL Open Font License 1.1 and copyright its authors. A page loads only the
  three its theme names.

The standards named in the examples (IEC 60598-1, IEC 62471, IEC 62133-2,
EN 50604-1, UN 38.3, IP ratings, RoHS) are cited by their public numbers
only, as a real datasheet would list them.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
