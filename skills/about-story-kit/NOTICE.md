# Notices

About Story Kit is a Lookbk skill. The page design (the founding sentence and
record card, the record on a spine or a time-scale rail, the people as a
contact sheet or an index with a viewer, practices, sourced numbers and the
close), the stylesheet, the browser runtime, the build, schema, checks,
server and recorder, the two examples (Hollin Workshop and Halyard, which are
invented: their names, people, dates, numbers, addresses and copy are not
real) and this documentation were written for Lookbk.

The fallback portrait tiles (growth rings and hatching) are drawn as inline
SVG by the build. The portraits in `examples/hollin/people/` are cut-paper
stand-ins drawn in code by `scripts/kit/paper-portraits.mjs`: flat shapes with
no faces, not photographs of anyone. No stock photography, video or icons
are shipped.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Footage Heroes, Scroll Cinema and
  Closing CTA Kit packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own.

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- **Source Serif 4** and **IBM Plex Mono** (the `serif` type)
- **Familjen Grotesk** and **Martian Mono** (the `grotesk` type)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
