# Notices

Proof Band Kit is a Lookbk skill. The three layouts (grid, row and
figures), the two looks (ledger and signal), the optical balance, the
stylesheet, the browser runtime, the build, checks, server and recorder,
the two examples (Quaywise and Gridmere, which are invented: their names,
customers, figures, sources and dates are not real) and this documentation
were written for Lookbk.

The fourteen customer logos in `examples/*/logos/` are invented wordmarks
drawn for these examples. Each is a path-only SVG made by Lookbk from the
outlines of open-licensed typefaces, all under the SIL Open Font License
1.1: Anton, Archivo Black, Big Shoulders Display, Bricolage Grotesque, DM
Serif Display, Fraunces, Geist, IBM Plex Mono, Instrument Serif, Inter
Tight, Manrope, Playfair Display, Space Grotesk and Syne (copyright their
authors). The OFL allows this use; the logos contain no font software.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes, Scroll Cinema and
  Closing CTA packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own.

Fetched when a built page is opened, not shipped here, from jsDelivr
(Fontsource packages, pinned by version with an integrity hash), each under
the SIL Open Font License 1.1 and copyright its authors:

- **Newsreader**, **Geist** and **Geist Mono** (the `ledger` look)
- **Inter Tight** and **JetBrains Mono** (the `signal` look)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
