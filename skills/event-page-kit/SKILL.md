---
name: event-page-kit
description: "Build the page for a one-day to three-day event (a conference, a festival weekend, a screening series, a meetup) from one event.json, set like a well-made festival programme booklet rather than a SaaS template. The programme is a real multi-room timetable drawn to scale (a session is exactly as tall as its minutes), with breaks as hatched bands across the rooms they cover, printed track marks that read without colour, and a code on every session (A2, 1.4) that the cover, the speakers, the tickets and the calendar files point back to. On the day it knows what time it is: a now line across the grid, every session past, now or next, and a now / next row per room. Before and after the event it counts down or says it has ended. Visitors abroad see their own time beside the venue's, daylight saving included, for events with online sessions. The cover carries the whole programme at a glance, drawn from the real schedule. Speakers are listed with what they will actually say, tickets as a price list with live sales-end countdowns, the venue as access facts and a plan drawn from the config, and every session has its own .ics. On a phone the grid becomes one room (or one track) at a time with a tablist switcher and a sticky time rail; printed, it is one A4 page per day. The build refuses a double-booked room, a session outside opening hours or across a break, a speaker in two places at once, a clock time that does not exist on that date, and a ticket shown on sale after its sales ended. Builds a self-contained page and a paste-in embed, with checks at four widths and a frame-by-frame recorder for the preview video."
license: MIT
---

# Event Page Kit

The page people open the week before an event and keep open on the day. The governing idea: **length on the page is length in time.** The programme is one ruled timetable where every session is exactly as tall as its minutes, and everything else on the page (the cover, the speakers, the tickets, the venue plan, the calendar files) refers back into that grid by session code, the way a printed festival programme does.

**The page, top to bottom:**

1. **Cover.** The event's name set large (one line in the accent), a kicker, and **the programme at a glance**: a strip with one row per room and one band per day, every session a bar at its true times, built from the same data as the grid. Past sessions are toned, running ones are in the accent, and a tick marks now. Then the essentials: when, where, online (or a line of your own), and tickets with the nearest sales end, counting down.
2. **Programme.** Day tabs, the track key, and (when the visitor's clock differs from the venue's and the event has online sessions) a **Venue · Both · Mine** time choice. A **now / next** row with one cell per room. Then the grid: the time rail (venue time, and the visitor's beside it), room columns, hour and quarter-hour rules, breaks as hatched bands, and the sessions: code, times, title, people (or a film's director, year and length), a one-line summary when the block is tall enough, track and access marks, full or cancelled, and **+ .ics**. A block's text is fitted to its height: the summary goes first, then the footer, then the people; a title is cut to one line only in a block too short for it, and the block still carries the whole title for screen readers and on hover.
3. **Who says what.** Featured people with **a sentence they will actually say**, the session it is about (code, day, time, room, + .ics) and their other sessions; everyone else named underneath with their codes. Each code jumps to its block in the grid.
4. **Tickets.** A price list: ticket, what it includes, price, and when sales end, with a live "7 h 20 min left" and stock where you give it. Ended tickets stay listed, struck through, with when they ended.
5. **Venue and access.** Access facts as ruled rows, and a **plan drawn from the config**: each floor as a box, rooms labelled with the same letters as the grid's columns, the entrance in the accent.
6. **Footer.** Your line, and the whole programme as one calendar file.

**Time.** The build turns every venue time into an exact instant in the venue's zone (with Intl, so daylight saving is right on any date) and refuses times that do not exist (the hour skipped when the clocks go forward). Live, the page uses the real clock and the visitor's own zone. For previews and stills, `?ev-clock=preview|before|after` uses the config's preview clock, and `?ev-zone=America/New_York` shows the page as a visitor there would see it.

**Phone (under 760 px).** A sticky bar holds the day tabs, the time choice and a **switcher** for one room at a time (`phoneSwitch: "room"`) or one track at a time (`"track"`, where sessions of one track that overlap sit side by side). The switcher is a tablist: arrow keys, Home and End move it, and a dot marks rooms or tracks with something on now. The hour label pins under the bar as you scroll through that hour, with the visitor's time under it.

**Print.** The programme alone, one A4 portrait page per day, every room, in black on white, scaled to fit.

**Motion.** Quiet and functional. The now line moves once a minute (600 ms, linear); sales countdowns change once a minute; a speaker's code scrolls to its session and outlines it for 900 ms. Nothing loops. **Reduced motion**: the now line jumps, scrolling is instant. **Without JavaScript**: every day's grid, the speakers, tickets and venue are all there in venue time; the now line, the visitor's times and the countdowns are not.

**What you can change, honestly.** Every word, time, room, track, person, ticket and link; the six theme colours (contrast enforced at build time and measured again by the check); `grotesk` or `serif` type; the scale of the grid (`ppm`); the phone switcher. The spacing, the type scale and the motion are the design and stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/event.css`: the whole design, scoped to `.ev`: cover and glance strip, facts, the timetable (positions computed from minutes), now / next, speakers, tickets, venue and plan; tablet, phone, reduced-motion and print rules.
- `kit/runtime.js`: the browser runtime, inlined into every build. The clock (real or preview), now / next / past, the now line, visitor times, the day tabs and phone switcher as tablists, countdowns, fitting each block's text, and the recorder's script.
- `scripts/build.mjs`: event.json to `out/index.html` (the page with a demo nav), `out/event-embed.html` (the sections to paste in), `out/ics/<code>.ics` and `out/programme.ics`.
- `scripts/kit/schema.mjs`: every field, its limits, the colour rules and the schedule rules; lists every problem at once.
- `scripts/kit/tz.mjs`: venue clock times to exact instants and back, with Intl only.
- `scripts/kit/ics.mjs`: writes the calendar files (UTC times) and reads them back strictly for the check.
- `scripts/check.mjs`: the time-zone and schedule-rule tests, the calendar files, then the page at 390, 768, 1024 and 1440 px (and with reduced motion), visitor times against Intl, the before, during and after states, and print.
- `scripts/record.mjs`: the preview video, stills at any preview clock, full-page shots and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `scripts/kit/fixtures/broken.json` and `scripts/kit/fixtures/dst.json`: the check's deliberate faults, and an event across the US clock change.
- `examples/margin-27/event.json` (light, grotesk, rooms on the phone, online sessions) and `examples/low-light/event.json` (dark, serif, tracks on the phone, a day that runs past midnight).

## Steps

### 1. Collect the programme

From the organiser's running order, not from memory:

- **Days**: dates, when doors open and when the building closes (after midnight is fine).
- **Rooms**: name, a short note (seats, step-free, streamed). **Tracks**: 1 to 5, each with a mark.
- **Sessions**: code, day, room, start, end, track, title; who is in it (or, for a film, director, year and length); access marks (BSL, CC); full or cancelled.
- **Breaks**: times, what, where, and which rooms they cover.
- **People**: name and role for everyone in a session. For the people you feature, **one sentence they will actually say** (ask them, or take it from their abstract) and the code of that session.
- **Tickets**: name, what it includes, price with currency, the exact sales end (venue time), the booking link, stock if it matters.
- **Venue**: address, getting there and home, step-free routes, hearing loops and captions, quiet room, ages, doors; a rough floor plan (boxes are enough).

### 2. Write event.json

Copy the example closest in spirit and replace every value:

- `examples/margin-27/event.json`: Margin 27, a two-day conference in Leeds with an online stream. Grotesk on paper and vermilion; three rooms, three tracks, shared breaks; a visitor in New York in the preview.
- `examples/low-light/event.json`: Low Light, a film weekend in Hastings. Serif on near-black and amber; two screens and a bar; four tracks with the phone switching by track; Saturday runs to 00:50.

Set `preview.clock` to a moment during the event that shows it well (something running in most rooms), `preview.before` to a moment before it, `preview.after` to one after it.

### 3. Build

```
node <skill>/scripts/build.mjs event.json out
```

It lists every problem at once and writes nothing until they are fixed. The schedule rules are deliberate: no room double-booked, every session inside its day's opening hours and clear of breaks in its room, nobody in two places at once, every person in a session, every featured quote pointing at a session that person is in, every time real in the venue's zone, ticket sales ending before the event ends, and every ticket either on sale at the preview clock or marked `"ended": true`. Warnings name sessions under 30 minutes (drawn compact) and long gaps in a room with no break (is something missing?).

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It proves the time-zone conversions across the March 2027 clock changes and that `fixtures/broken.json` fails with exactly its six faults; parses every calendar file back; then, at the preview clock, at 390, 768, 1024 and 1440 px and with reduced motion, on every day and every phone switcher tab, it fails on script errors, links without an address, sideways scrolling, copy under 14 px (16 px on a phone) or labels under 12 px, contrast under WCAG AA measured against what is behind the text, text cut off or off screen, a session drawn at the wrong place for its times, a glance bar that does not match its session, the now line away from the clock, a session marked now that is not running, a switcher or day tabs that are not working tablists, a speaker link that leads nowhere, and a focus that can't be seen. Then it compares the visitor's times on the page with Intl (this page from New York and Tokyo, and a fixture across the US clock change), opens the page before, during and after the event and with the real clock, and prints it (one page per day).

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Add `?ev-clock=preview` to see the day itself, `?ev-clock=before` or `?ev-clock=after` for the other states, and `&ev-zone=Asia/Tokyo` to be a visitor there. Try it on a phone, and print it.

### 6. Put it on the site

`out/index.html` is a complete page with a demo nav. To use your site's own, paste `out/event-embed.html` where the page content goes and copy `out/ics/` and `out/programme.ics` beside it. The embed carries its own styles (scoped to `.ev`), runtime, data and font link. Rebuild whenever the programme changes; the checks are cheap.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 18.5 --size 1920x1080 --poster 5.1
node <skill>/scripts/record.mjs out/index.html --still 1.3 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --still 5.1 --clock before --png before.png
```

`--moments` lists the holds (cover, programme, later, speakers, tickets, venue) where nothing on screen moves; take posters and stills from inside one. Between the programme and later holds the preview clock runs fast for up to 200 minutes, so the now line moves and sessions turn past.

## event.json, every field

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `brand` | 1 to 40 characters | required | demo nav, title, calendar name |
| `lang` | language tag | `en` | dates in words |
| `title.lines` | 1 to 3 lines of up to 12 characters | required | the cover's name |
| `title.accent` | a line number, from 0 | none | that line in the accent (italic in `serif`) |
| `kicker` | 1 to 200 | required | under the name |
| `theme.bg`, `surface`, `past`, `ink`, `accent`, `onAccent` | `#rrggbb` | required | ink 7:1 on bg, surface and past; accent 4.5:1 on bg; onAccent 4.5:1 on accent |
| `theme.type` | `grotesk`, `serif` | `grotesk` | Archivo with IBM Plex Mono, or Instrument Serif and Sans with DM Mono |
| `ppm` | 1.6 to 4 | 2.6 | pixels per minute in the grid |
| `phoneSwitch` | `room`, `track` | `room` | what the phone shows one at a time |
| `titles` | `{ programme?, speakers?, tickets?, venue? }`, up to 28 each | Programme, Who says what, Tickets, Venue and access | section titles |
| `venue.name` / `short` / `note` / `city` | up to 50 / 40 / 80 / 30 | required | `city` names the venue clock ("Leeds") |
| `venue.zone` | an IANA zone, as `Europe/London` | required | every time in the file is in it |
| `venue.rows` | 2 to 8 `[label (up to 20), text (up to 140)]` | required | access facts; a row labelled Address goes into the calendar files |
| `venue.plan.floors` | 1 to 3 `{ name (up to 30), w, h, entrance?, rooms }` | none | w:h no wider than 5:1 or taller than 1:2 |
| plan room | `{ label (up to 22), note?, x, y, w, h, room?, open?, solid?, screen? }` | | inside its floor; `room` shows the grid letter; `open` hatches, `solid` fills, `screen` marks a screen edge |
| `rooms` | 1 to 5 `{ id (1 to 3 letters or digits), name (up to 18), note? (up to 32), sparse? }` | required | `sparse: true` stops the gap warning for a room used now and then |
| `tracks` | 1 to 5 `{ id, name (up to 18), mark, accent? }` | required | `mark`: `solid`, `ticks`, `dashes`, `hatch`, `dots`, `hairline`, each used once |
| `days` | 1 to 3 `{ id, date (YYYY-MM-DD), opens, closes (HH:MM), label? }` | required | in date order; `closes` after midnight runs on |
| `breaks` | `{ day, start, end, title (up to 20), where (up to 40), rooms? }` | none | `rooms` next to each other in the rooms list; all rooms if left out |
| `sessions` | 1 to 120 | required | |
| session `code` | 1 to 6 letters, digits or dots, unique | required | start it with the room id |
| session `day`, `room`, `track` | ids from above | required | |
| session `start`, `end` | `HH:MM`, 15 minutes to 6 hours | required | after midnight on a late day is fine |
| session `title` | up to 80 | required | |
| session `people` | up to 4 person ids | `[]` | needs people or `meta` |
| session `meta` | up to 70 | none | a film's director, year and length |
| session `line` | up to 110 | none | one-line summary, shown when the block is tall enough |
| session `access` | up to 3 marks of up to 6 characters | none | "BSL", "CC" |
| session `status` | `full`, `cancelled` | none | cancelled sessions get no calendar file |
| `people` | `{ id, name (up to 40), role (up to 60), says? (up to 180), talk?, featured? }` | required | every person in a session; featured people need `says` and `talk` |
| `online` | `{ rooms, what (up to 30), after? (up to 40) }` | none | turns on the visitor's time and the Online fact |
| `facts.extra` | `{ label (up to 16), value (up to 40), note? (up to 60) }` | sessions and rooms | the third fact when there is no `online` |
| `tickets` | 1 to 6 `{ name (up to 30), includes (up to 90), price (up to 10), salesEnd (YYYY-MM-DDTHH:MM, venue time), url (https), stock?, endsNote? (up to 40), ended? }` | required | |
| `after` | up to 120 | "<brand> has ended." | shown when the programme is over |
| `footer` | text | the brand | |
| `preview.clock`, `before`, `after` | venue times `YYYY-MM-DDTHH:MM` | required | during, before and after the event |
| `preview.visitorZone` | an IANA zone | the venue's | the visitor the previews show |

## Troubleshooting

- **"room A is double-booked"**: two sessions in one room overlap by at least a minute. Move one, or put it in another room. Back-to-back is fine (10:15 to 11:00, then 11:00).
- **"is in two places at once"**: the person is in two overlapping sessions. Often a panel and a workshop; check the running order with them.
- **"does not exist in Europe/London (the clocks go forward then)"**: that clock time is in the hour skipped on the change day. Use the time the venue's clocks will actually show.
- **"is not after the preview clock"**: the preview would show a ticket on sale after its sales ended. Move `preview.clock`, correct `salesEnd`, or mark the ticket `"ended": true` to show it struck through.
- **A session's title is cut to one line**: the block is too short for its text at that width. Raise `ppm`, shorten the title, or accept it: the whole title is still on the block for hover and screen readers.
- **The visitor's time never shows**: it appears only when the event has `online` sessions and the visitor's clock differs from the venue's. Try `?ev-clock=preview&ev-zone=America/New_York`.
- **Every session looks past, or nothing is "now"**: the page uses the real clock unless the address has `?ev-clock=preview`. Before and after the event that is correct.
- **No fonts, or the wrong ones**: the page loads them from Google Fonts. Offline, system fonts stand in and the check's sizes still hold.
