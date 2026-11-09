---
name: booking-slots-kit
description: "Build the appointment booking section for a local service business (clinic, salon, barber, studio, repair shop) from one booking.json. The visitor picks a service, optionally a person, then a day and start time from real availability, then confirms with a name and a mobile or email. Availability is worked out in the page from the config in the shop's time zone (hours, shifts, away days, service lengths plus buffers, existing bookings, closed days, notice, horizon) and shown in the visitor's zone too, correct across clock changes. The week is drawn on one time scale so busy days look busy. Designed states for a full week, an honest hold countdown, a taken slot, a failed send, an email fallback, and a booked card with an .ics file. Phone layout first. A self-contained page and a paste-in embed, a property test of the availability rules against a minute-by-minute reference, checks at four widths, and a frame-by-frame recorder. Use for appointment booking on a local service business site."
license: MIT
---

# Booking Slots

The booking section of a local service business, built around one idea: **a booking is a block of time of a known length, and the page shows the shop's real day so the visitor can see where their block fits.** Every line of the appointment card can only be filled with something the diary allows, and nothing on the page pressures: the only timer is the hold, and it is only shown when the shop's endpoint really holds the time.

What the section holds:

1. **Head**: an eyebrow, a headline with one `_turn_` in the accent, and the shop: name, address, today's hours, "Times in Edinburgh time, now 13:05". When the visitor is in another zone: "You are in Singapore, 1 h ahead: 13:40. Your time is under each slot."
2. **Service** (step 1): rows with name, one line of description, price and a **length bar**: every service drawn to one scale, so 30 and 60 minutes look like 30 and 60 minutes.
3. **Who** (step 2, optional): "Anyone free" first, then each person with their role and their next free start, worked out. People who do not do the chosen service stay in place, dashed, with the reason.
4. **Day** (step 3): week paging inside the horizon and seven **day columns**. Each column is that day drawn top to bottom on the week's common scale: wide accent runs where this service can start, narrow runs where it is booked, dotted runs under the notice period, faint dotted runs for time already gone. Under each, a plain count ("5 free", "Full"), "Off" when the person is not in, the closed day's name, or "Later" past the horizon.
5. **Time** (step 4): the **day track** (the person's working hours, bookings hatched, the visitor's block in the accent with its clean-up buffer as a dotted tail) and the **slot grid** by morning, afternoon and evening, with "2 of 8 free" per group. Free slots have a solid border; taken ones are struck through on a faint hatch; too-soon ones have a dashed border and a line saying who to call. With two zones, every slot shows both times.
6. **The card** (step 5): the appointment card a clinic hands you. What, With, Day, Time, Where, blank lines dashed until filled; then the hold (or the honest line for the shop's mode), name, mobile or email, an optional note, the button, the policy and an email fallback.

**Three honest modes**, from the config: `endpoint.hold` set: the time is held for `rules.hold` minutes with a draining ring and "Nobody else can take it until 13:15"; an endpoint without `hold`: "Not reserved until you book. We check 12:00 is still free when you press book"; no endpoint: "We confirm by email. The time is not reserved until we reply", the button says "Request this time" and opens the visitor's email app with every field filled in, and the card is stamped "Requested", never "Booked".

**What moves** (all off with reduced motion; nothing loops and nothing moves on scroll): the week's columns draw top to bottom once when the section is 30% on screen (500 ms, 50 ms apart); choosing a service sweeps its length bar (240 ms) and cross-fades the columns' runs (180 ms); choosing a day draws the track left to right (300 ms) and lifts the slot groups in (220 ms, 40 ms apart); choosing a start slides the block along the track from the last start (280 ms) and lifts the card's lines in (200 ms); sending runs a bar along the button; booking drops a stamp onto the card (220 ms). Easing `cubic-bezier(.2,.7,.2,1)`.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the recorder (found automatically; set `CHROME_PATH` otherwise).
- ffmpeg, only for the video (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- From the person: their services (name, length, clean-up time, price, who does them), opening hours, each person's shifts and days away, closed days, how much notice they need, how far ahead they take bookings, their time zone, and where requests go: an https endpoint that books (and, if it can, one that holds a time), or an email address.

Every price, length and hour must come from the person. If they have no endpoint, do not invent one: the kit then asks by email and says so.

## Files

- `scripts/build.mjs`: validates booking.json (every problem listed at once) and writes `index.html` and `booking-embed.html`
- `scripts/test.mjs`: the property test: random shops in 12 time zones, compared minute by minute with an independent reference
- `scripts/check.mjs`: opens the built page at 390, 768, 1024 and 1440 px and with reduced motion, and runs the slot-time, booking-flow, email, diary-failure and no-free-time checks
- `scripts/record.mjs`: records the page's fixed script to `preview.mp4` and `poster.png`, takes single stills (any designed state), and prints the settled stretches
- `scripts/serve.mjs`: serves a built folder on localhost to look at
- `scripts/kit/schema.mjs`: every field, its limits, the hours format, the colour and copy rules
- `kit/engine.js`: the availability rules, shared by the page and the test, no dependencies
- `kit/runtime.js`: the browser runtime (rendering, the hold, the endpoint, the calendar file, the email fallback), no dependencies
- `kit/booking.css`: the section's styles, every class starting with `bk-`
- `examples/linnet/booking.json`: light, a physiotherapy clinic in Edinburgh, three physios, a hold endpoint
- `examples/lantern/booking.json`: dark, a barber in Saigon booked from Singapore, an endpoint without holds, prices in đồng

## Steps

### 1. Collect the diary

From the person or their current booking tool:

- **Brand**, a page **title** and a **description** for search.
- **Colours** as `#rrggbb`: `page`, `surface` (the card, the chosen rows), `ink`, `accent` (free runs, the chosen slot, the button), `onAccent`, `hold` (the hold ring and "today"). The build checks every pair.
- **Hours** per weekday, **closed** days with their names, the shop's **time zone** (`Europe/London`, `Asia/Ho_Chi_Minh`).
- **People** (0 to 8) with their shifts and days away. With none, the shop is one chair and step 2 disappears.
- **Services** (1 to 8): name, one line, minutes, clean-up buffer, price, who does it.
- **Rules**: the step between starts, the notice in minutes, the horizon in days, the hold in minutes.
- **Bookings**: the diary as it stands, or a URL the page reads it from.

### 2. Write booking.json

Copy `examples/linnet/booking.json` or `examples/lantern/booking.json` and replace every value. Every field is listed under "booking.json, every field" below. Keep the copy plain: the build refuses "only 3 left", "hurry", "selling fast", "in high demand", "guaranteed" and exclamation marks, because the page cannot back them up.

### 3. Build

```
node <skill>/scripts/build.mjs booking.json out
```

It lists every problem at once and writes nothing until they are fixed: lengths and colours, contrast pairs, hours that do not parse or overlap, a shift outside the opening hours, a service done by nobody or too long for every shift it is offered in, a booking for a person who does not exist, an unknown time zone or currency, and pressure copy.

### 4. Test and check

```
node <skill>/scripts/test.mjs
node <skill>/scripts/check.mjs out/index.html
```

`test.mjs` makes 160 random shops (seed 7; `--runs` and `--seed` to change), many in a week with a clock change, and compares every start the engine offers or holds back for notice with a separate minute-by-minute reference, for each person and for "anyone", plus every start's label in the visitor's zone. It prints the counts and fails on any difference.

`check.mjs` opens the page at 390×844, 768×1024, 1024×768 and 1440×900, and at 390 and 1440 with reduced motion, with "now" and the visitor pinned to `preview`, and fails on:

- script errors, links without an address, sideways scrolling, text cut off, off the screen or wider than its day cell
- text under 16 px on a phone or 14 px elsewhere (12 px for the mono labels: weekdays, counts, the legend, the ruler, the second time on a slot)
- text under WCAG AA contrast against what is behind it, and parts that carry meaning under 3:1 (slot and field borders, free and booked runs, the chosen day, person, slot and block, the hold ring); controls under 44 px tall on a phone; focus that can't be seen
- an entrance that does not run once and settle, or reduced motion that is not settled from the start
- any slot whose time is not the shop's wall clock at its instant, on its day, or whose second time is not the visitor's wall clock at that instant, over two weeks; and again with the visitor in New York (London for a shop in the Americas) over two weeks that cross a clock change, where it also requires two different offsets
- the booking flow in each mode: hold wording, a hidden tab that stops the countdown and comes back to the real time left or to the expired state, the hold taken again, an empty send, a taken time (the next free one is chosen, the details kept), a failed send (an email with every field), a booked card with a valid calendar file (UTC times, a stable UID, an alarm), and with no endpoint: nothing says "held" and the request email carries every field
- a diary that fails to load and still shows times, and a week with nothing free that does not lead to the next free day

Fix and build again until every line says ✓.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Add `?bk-now=2026-11-10T08:30:00Z&bk-tz=America/New_York` to see the week at another moment from another place. With `preview.pin` set, the page always runs at `preview.now` and says so in a line under the head, and sends nothing: use that for a demo, never on the live site.

### 6. Put it on the site

`out/booking-embed.html` is the whole section: a fonts link, one `<style>`, the `<section class="bk">` and one `<script>`. Paste it where the booking section goes. Every class starts with `bk-`. Without the script, the section lists the services as email requests and the opening hours as text.

The endpoint adapters, set by `endpoint.adapter`:

- `json` (default): `POST endpoint.url` with `Content-Type: application/json` and `{ service, serviceName, minutes, person, start (ISO, UTC), startLocal, timeZone, visitorTimeZone, name, contact, note, hold, ref }`. Answer 2xx when booked, 409 when the time was taken meanwhile (the page marks it taken, selects the next free start and keeps the details), anything else when it failed (the page says nothing was saved and offers the email).
- `form`: the same fields as `application/x-www-form-urlencoded`, for form services.
- `endpoint.hold` (optional): `POST` the same body when a start is chosen; answer `{ "id": "...", "expires": "<ISO time>" }` to hold it, or 409. A `DELETE` to `endpoint.hold?release=<id>` releases it when the visitor chooses another start. Leave it out if your system cannot hold: the page then says the time is not reserved until they book.
- `bookingsUrl` (optional): a `GET` that answers `[{ "person", "start", "minutes", "buffer" }]`. If it fails, the page shows no times at all and says why, rather than offering times that may be taken.

The page sends nothing anywhere else. The calendar file is made in the browser: UTC times, a UID built from the reference so a second download replaces the first, and an alarm 24 hours before.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920×1080, 30 fps, 16.5 s, the script in `preview.script`) and `out/poster.png` from the held stretch. `--moments` prints the settled stretches; take stills only inside them. `--still 7.45 --state expired --clip .bk-c3-in --png hold.png` saves one designed state (`none`, `expired`, `stale`, `failed`, `invalid`, `request`, `diary`); `--size 390x844 --scale 2` shoots the phone layout.

## How it behaves

- **1100 px and wider**: three columns: services and people (340 px), day and time, and the card (340 px), which stays in view while the middle column scrolls.
- **761 to 1099 px**: two columns; the card moves under them, right-aligned, up to 560 px; under 900 px the day counts drop the word "free".
- **760 px and under** (designed first): the headline at 32 px, the shop line only; once a person is chosen, steps 1 and 2 fold into one summary row with Change, so the week, the day track and the first starts share the first screen; 4 starts per row at 48 px (56 with two zones); every sentence at 16 px; a bar fixed to the bottom (safe-area padded) carries the chosen time and the hold until the card is on screen.
- **Time**: every rule is worked out in the shop's zone as real instants; a start that the clock skips is not offered, a repeated one once, and an appointment that would span a clock change is not offered. Statuses move on every 30 seconds without animation; a start that becomes too soon while unheld is let go with a spoken note.
- **The hold**: the countdown runs from the hold's real end time, stops while the tab is hidden and, when the tab comes back, shows what is really left or the expired state ("Your hold on 12:00 ended at 13:15. It may still be free.") with a button to check it again. The book button is off while the hold is expired.
- **Screen readers**: every step is a radio group with arrow keys; slots announce both times and their state; changes are announced politely.

## booking.json, every field

Lengths are characters. Required unless marked optional.

**Page**
- `brand` (1 to 60), `title` (1 to 70), `description` (20 to 170), `lang` (optional, default `en`)
- `eyebrow` (1 to 40), `headline` (8 to 70; one `_turn_` is set in the accent, italic in the `serif` voice)
- `labels` (optional): `service` (default "Service"), `day` ("Day"), `time` ("Time"), `confirm` ("Confirm"); `peopleLabel` (2 to 20, required with people): step 2's heading ("Physio", "Barber"); `anyLabel` (optional, default "Anyone free")

**theme**
- `page`, `surface`, `ink`, `accent`, `onAccent`, `hold`: `#rrggbb`. The build requires ink on page and surface at 7:1, accent on page and surface at 3:1, onAccent on accent at 4.5:1 and hold on surface at 3:1. Text in the accent or hold colour is darkened or lightened by the build until it reaches 4.5:1.
- `voice` (optional, default `serif`): `serif` (Source Serif 4 light with Hanken Grotesk and DM Mono), `signage` (Big Shoulders Display in capitals with Archivo and IBM Plex Mono), `grotesk` (Hanken Grotesk and DM Mono)
- `corners` (optional, default `soft`): `soft` (3 px) or `square`

**shop**
- `name` (optional, 1 to 60, default the brand), `address` (4 to 80), `where` (4 to 60, the card's Where line), `city` (2 to 28, for "Times in … time"), `tz` (an IANA time zone), `phone` (optional; shown for same-day times under the notice)

**hours**: `{ "mon-thu": "08:00-19:00", "fri": "08:00-18:00", "sat": "09:00-13:00" }`. Keys are days or day ranges; values are `HH:MM-HH:MM` on 5-minute steps, a list of them for a break, or `null`. A missing day is closed.

**closed** (optional, up to 30): `{ "from": "2026-11-30", "to": "2026-11-30" (optional), "label": "St Andrew's Day" (2 to 28) }`

**people** (0 to 8)
- `id` (lowercase), `name` (2 to 40), `role` (2 to 32), `initials` (optional, 1 to 3 capitals)
- `shifts`: as `hours`, and inside them
- `away` (optional): `[["2026-12-14", "2026-12-18"]]`, first and last day off

**services** (1 to 8)
- `id`, `name` (2 to 36), `desc` (4 to 70), `minutes` (10 to 480), `buffer` (optional, 0 to 60, default 0: clean-up time after it, which must also be free)
- `price` (a number in the currency, such as 52 or 350000) or `priceText` ("from £40", "free"), `who`: the ids of the people who do it (leave out with no people)

**rules** (optional)
- `step` (5, 10, 15, 20, 30 or 60; default 30): starts fall on the clock every this many minutes from midnight
- `notice` (0 to 10080 minutes, default 120), `horizon` (1 to 180 days, default 28), `hold` (2 to 20 minutes, default 10), `weekStart` (`mon` or `sun`, default `mon`)

**bookings** (optional): `[{ "person": "mairi", "start": "2026-11-10T09:00" (the shop's wall clock) or an ISO time with its offset, "minutes": 40, "buffer": 10 }]`. **bookingsUrl** (optional): an https address answering the same list.

**money**: `currency` (ISO code, such as `GBP`, `VND`) and `locale` (such as `en-GB`, `vi-VN`), as Intl knows them.

**endpoint** (optional): `url` (https), `adapter` (`json` or `form`, default `json`), `hold` (optional https address). **email**: where requests go without an endpoint, and the fallback when sending fails.

**card**: `title` (2 to 28), `cta` (2 to 24, the book button), `policy` (8 to 120), `ref` (2 to 4 capitals, the start of the reference, such as `LP-1011-1200M`). **cancelList** (optional, default false): offer "Join the cancellation list" by email in the no-free-time state.

**preview** (optional; the check and the recorder use it)
- `now` (an ISO time) and `tz` (the visitor's zone for the preview), `pin` (true: the built page always runs at `now`, says so and sends nothing; for demos only)
- `script`: `service`, `person`, `day`, `times` (two `HH:MM` starts to pick in turn; the nearest free start is taken), `draft` (`name`, `contact`)

## Troubleshooting

- **"people[1] (tom).shifts: sat 09:00-14:00 is outside the opening hours"**: a shift must sit inside the shop's hours that day. Change the shift or the hours; the page never offers time the shop is shut.
- **"services[3] (pelvic): 60 minutes does not fit in any shift"**: the service is longer than every shift of the people who do it. Add a person or a longer shift, or shorten the service.
- **"reads as "only N left" pressure"** (or urgency, invented demand): the build refuses copy the page cannot back up. Say what is true: "Every time below is actually free."
- **Every day says "Full"**: check `notice` (in minutes, not hours), the `bookings` dates (the shop's wall clock, not UTC), and that the service's `who` includes someone working that week. `node scripts/test.mjs` passing means the rules are right; the data is what to look at.
- **The visitor's times look one hour off on some days**: that is a clock change in one of the two zones; each slot is converted at its own instant. The check's second run looks at exactly this.
- **"the diary did not load"** on the live page: `bookingsUrl` answered with an error, or not a JSON list, or the browser blocked it (CORS). The page shows no times on purpose; fix the URL or put the bookings inline.
- **The hold says "Reserving…" and never holds**: `endpoint.hold` did not answer 2xx with an `expires` time. Remove `endpoint.hold` if your system cannot hold; the page then says the time is not reserved until they book.
