# Notices

Event Page Kit is a Lookbk skill. The page design (the cover with the
programme at a glance, the essentials, the timetable drawn to scale with its
now line and now / next row, the speakers in their own words, the tickets as
a price list, the venue facts and plan), the stylesheet, the browser runtime,
the build, schema, time-zone and calendar code, checks, fixtures, server and
recorder, the two examples (Margin 27 and Low Light, which are invented:
their names, people, films, venues, addresses, prices, dates and copy are not
real) and this documentation were written for Lookbk.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes, Scroll Cinema and About
  Story Kit packages.

No third-party code is vendored or loaded: the runtime is Lookbk's own, and
time zones come from the browser's and Node's built-in Intl. The calendar
files follow RFC 5545 (iCalendar); no library is used to write or read them.
No photography, video or icons are shipped; the track marks and the venue
plan are drawn with CSS.

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- **Archivo** and **IBM Plex Mono** (the `grotesk` type)
- **Instrument Serif**, **Instrument Sans** and **DM Mono** (the `serif` type)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
