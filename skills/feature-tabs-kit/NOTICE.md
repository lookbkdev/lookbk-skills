# Notices

Feature Tabs Kit is a Lookbk skill. The design (the rail, the stage and its
eight view types), the Feature Tabs runtime, the build, checks, recorder and
server, the two examples (Tallowby and Parcelwright, which are invented:
their names, people, addresses, amounts, carriers, tracking numbers and
domains are not real) and this documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes and Scroll Cinema
  packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
uses only the browser (the Web Animations API, IntersectionObserver and
Intl.NumberFormat).

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- Display: **Newsreader**, **Fraunces**, **Schibsted Grotesk**, **Bricolage
  Grotesque**.
- Text: **Public Sans**, **Schibsted Grotesk**, **Hanken Grotesk**.
- Mono: **JetBrains Mono**, **IBM Plex Mono**.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
