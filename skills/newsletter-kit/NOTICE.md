# Notices

Newsletter Kit is a Lookbk skill. The design (the opened issue in a neutral
inbox, the send calendar, the form and its states, both layouts), the
Newsletter Kit runtime, the build, schema, date and key-scan modules, the
self-test, checks, recorder and server, the server-function recipe, the two
examples (Brine & Crumb and Tail Latency, which are invented: their names,
people, addresses, issues, counts and numbers are not real) and this
documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/chrome.mjs` and the file-serving part of
  `scripts/kit/serve.mjs` are Lookbk's shared helpers from the Motion Heroes
  and Scroll Cinema packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own and
uses only the browser, and the scripts use only Node.js.

Fetched when a built page is opened, not shipped here, each from Google Fonts
under the SIL Open Font License 1.1 and copyright its authors:

- **Young Serif**, **Newsreader** and **Geist** (display faces you can choose)
- **Literata**, **Geist** and **IBM Plex Sans** (text faces)
- **IBM Plex Mono** and **Geist Mono** (labels)

The examples use Young Serif, Literata and IBM Plex Mono (Brine & Crumb) and
Geist and Geist Mono (Tail Latency).

Provider names in SKILL.md (Buttondown, Kit, Mailchimp, Ghost, listmonk) are
named only to say which form fields they expect; they are trademarks of
their owners, and nothing of theirs is included.

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
