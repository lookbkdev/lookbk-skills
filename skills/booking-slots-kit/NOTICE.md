# Notices

Booking Slots is a Lookbk skill. The section's design, its stylesheet, the
availability engine, the browser runtime (rendering, the hold, the
endpoint adapters, the calendar file, the email fallback), the build,
property test, checks, server and recorder, the two examples and this
documentation were written for Lookbk.

Linnet Physio and Lantern Street Barbers are invented. Their names, people,
hours, addresses, prices, bookings and copy are made up for the
demonstration; the email addresses and endpoints use the reserved .example
domain, and the phone numbers are from the ranges Ofcom keeps for drama
(0131 496 0xxx and 07700 900xxx).

The day columns, the day track, the length bars, the hold ring and the
stamp are drawn in HTML, CSS and inline SVG by the kit. No images, video or
icons are shipped.

Included here:

- `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs` and `scripts/chrome.mjs`
  are Lookbk's shared helpers from the Motion Heroes, Scroll Cinema and
  Contact Desk packages.

No third-party code is vendored or loaded: the engine and runtime are
Lookbk's own and have no dependencies. Time zones come from the browser's
and Node's built-in Intl.

Fetched when a built page is opened, not shipped here, each from Google
Fonts under the SIL Open Font License 1.1 and copyright its authors:

- **Source Serif 4**, **Hanken Grotesk** and **DM Mono** (the `serif` voice)
- **Big Shoulders Display**, **Archivo** and **IBM Plex Mono** (the
  `signage` voice)
- **Hanken Grotesk** and **DM Mono** (the `grotesk` voice)

Used on your machine, not shipped: Chrome, Chromium or Edge (driven over the
DevTools protocol) and ffmpeg.
