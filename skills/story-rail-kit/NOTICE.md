# Notices

Story Rail is a Lookbk skill. The rail, its scale and step rule, the
stylesheet, the browser runtime, the build, schema, checks, server and
recorder, the two examples (Kestle Varga Architects and Lantern Larder, which
are invented: their names, buildings, recipes, people, figures and addresses
are not real) and this documentation were written for Lookbk.

Every picture in the examples was drawn in code for Lookbk (SVG in
`kit/drawn.mjs`, inlined into the built page): a house below a sea wall, a
concrete stair, a library facade, a courtyard plan, a broth, a blood orange,
a pot of black beans and a jar of chilli oil. No photographs, stock images or
generated images are used or shipped.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes, Scroll Cinema and Work
  Index packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
the built pages load nothing from other servers.

Fonts shipped in `kit/fonts/` and copied next to every built page, each under
the SIL Open Font License 1.1 (the licence text is beside each font):

- **Geist** (variable, Latin), copyright 2024 The Geist Project Authors
- **Fraunces** (variable roman and italic, Latin), copyright 2020 The
  Fraunces Project Authors
- **IBM Plex Mono** Medium (Latin), copyright 2017 IBM Corp.
- **DM Mono** Medium (Latin), copyright 2020 The DM Mono Project Authors

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
