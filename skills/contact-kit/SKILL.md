---
name: contact-kit
description: Build the contact section or contact page for a studio, practice or small company from one contact.json, designed like a good front desk. The visitor first says what it is about (3 to 5 reasons, each naming who answers and how fast), and the form then shapes itself to that reason, keeping the fields two reasons share and bringing in the rest. Each reason promises a reply time worked out from the real working hours of the people on it, in their own time zones, and shown in the visitor's own time. Underneath, a 24-hour rota shows who is at their desk now against an even 3-hour ruler, and each office gets a drawn plan of the last hundred metres to its door (blocks, your building, the door swing, stairs, gate or loading bay, a dotted route and numbered marks that match the written arrival steps), cropped for phones. Every form state is designed (empty, typing, invalid, sending, sent with a reference and a timeline, offline, failed), with a spam trap instead of a CAPTCHA, errors that are announced, and an email fallback. One JSON in, one self-contained page and a paste-in embed out, with checks at four widths (text size, contrast for text and for the parts that carry meaning, overflow, the rota's ruler, plan labels, every reason's fields, the send flow, focus) and a frame-by-frame recorder. Use whenever someone wants a contact page, contact section, support page, "get in touch" form, office or studio locations with hours, or "who to contact" routing.
license: MIT
---

# Contact Desk

The contact section of a site, built as a front desk instead of a box with three fields. It answers the four things a visitor wants to know before they write: **who will read this, when will they answer, are they in today, and how do I find the door.**

- **Step 1, what is it about**: 3 to 5 reasons as a real radio group. Each row says who answers ("Inês Moura · Partner", or "Support desk · Rotterdam, Austin, Taipei"), whether anyone on it is in right now, and the reply promise ("replies within two working days").
- **Step 2, the note**: a slip addressed to that person (To, Re), a reply-by line with a small clock ("Expect a reply by Thu at 18:30, your time."), then only the fields that reason needs. Choosing another reason morphs the slip: fields both reasons share stay where they are, keeping what was typed, and glide if they move; the others fade out where they were, and the new ones rise in after them. The To line, the reply time, the clock hands and the send button change with it.
- **Who is at the desk**: one row per person on a 24-hour ruler in the visitor's time (6 hours back, 18 ahead, ticks every 3 hours starting at the left edge of the boxes). Boxes are working hours; the one that is live now is in the open colour; one accent line is now, with its chip above the ruler. A person with no hours in view gets a "next: Fri 08:00 →" marker. On the right: "At the desk, until 18:30, 2 h 50 min left" or "Back at 07:00 tomorrow, in 15 h 20 min", and their own local time.
- **Come and see us**: an office card per office, with its live status, a doorstep plan in architectural drawing style, and numbered arrival steps that match the plan's marks.

**What moves** (all on one clock, all off with reduced motion): the desk rises in once, then the selected reason's rule slides between rows and the slip morphs (360 ms, ease in-out); the rota's boxes draw left to right and the now line drops in; each plan's route draws along its dots and the marks pop in order; sending runs a bar along the button, then the slip folds into the receipt. Nothing loops and nothing moves on scroll.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the video (found automatically; set `CHROME_PATH` otherwise).
- ffmpeg, only for the video (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Somewhere for the notes to go: an https address that accepts a JSON POST (your form service or your own endpoint), or nothing, in which case each reason's note opens in the visitor's email app addressed to that reason's email.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `scripts/build.mjs`: validates contact.json (every problem listed at once) and writes `index.html` and `contact-embed.html`
- `scripts/check.mjs`: opens the built page at 390, 768, 1024 and 1440 px and with reduced motion, and fails on anything listed under Check
- `scripts/record.mjs`: records the page's fixed script to `preview.mp4` and `poster.png`, takes single stills (any state, any reason), and prints the settled stretches
- `scripts/serve.mjs`: serves a built folder on localhost to look at
- `scripts/kit/schema.mjs`: every field, its limits, the hours and plan formats, and the copy rules
- `kit/contact.css`: the section's styles, every class starting with `ck-`
- `kit/runtime.js`: the browser runtime (time zones, reply times, rota, plans, the form and its states), no dependencies
- `examples/brask-moura/contact.json`: light, an architecture practice in Lisbon and Copenhagen
- `examples/orrin/contact.json`: dark, a hardware startup's support desk across three time zones

## Steps

### 1. Collect the desk

From the person or their current site:

- **Brand**, a page **title** and a **description** for search.
- **Colours** as `#rrggbb`: `page`, `surface` (cards and the slip), `ink`, `accent`, `onAccent`, `open` (the "in now" colour). The build checks every pair below.
- **People** who answer: name, role, city, IANA time zone (`Europe/Lisbon`, `America/Chicago`) and their real working hours. Add holidays as `away` date ranges.
- **Reasons** people write (3 to 5): a short title, who answers, the honest reply promise, the address the note goes to, and the 2 to 7 fields that reason needs.
- **Offices** (0 to 3): address, hours, the 2 to 4 arrival steps you would tell someone on the phone, and a plan of the last hundred metres.

Do not invent reply times you do not keep. The page turns them into dates, and the sent state repeats them.

### 2. Write contact.json

Copy `examples/brask-moura/contact.json` or `examples/orrin/contact.json` and replace every value. Every field is listed under "contact.json, every field" below.

**Choosing reasons.** Name them the way visitors think ("My Orrin is not working", not "Technical support"). Give each one the fields its person needs to answer in one go, and nothing more: a commission asks for the kind of project, the site and the budget band; a fault report asks for the serial number and what the light is doing; a job application asks for a portfolio link. Use the same key for the same field across reasons (`name`, `email`, `msg`), so it keeps its value when the visitor changes their mind. The label can differ per reason.

**Drawing the plan.** Work on a 600 by 340 grid with the street running across. Draw the neighbouring buildings as `blocks`, your building as `us`, the `door` as two points on your building's outline, then the `route` from where people arrive (the tram stop, the bike racks, the yard gate) to the door and inside it, and put one `mark` on the route for each arrival step. Add `stairs`, a `gate`, a loading `bay` or `water` where they help. Label the street and the two or three things people look for ("BAKERY", "HALL C"). Then set a `crop`: the squarer part of the plan a phone shows, holding the whole route and every mark.

### 3. Build

```
node <skill>/scripts/build.mjs contact.json out
```

It lists every problem at once and writes nothing until they are fixed: lengths, colours and their contrast, hours that do not parse, a reason whose person does not exist, a field key used as two different kinds of field, a door that is not on your building, marks that do not match the steps or sit off the route, a crop that cuts off a mark. It also refuses copy that contradicts the page: "no forms" on a form, "24/7" when nobody works round the clock, "instant replies", "chat with us", "call us" without a phone number, "visit us" without an office.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390×844, 768×1024, 1024×768 and 1440×900, and at 390 and 1440 with reduced motion, with "now" pinned to `preview.now`, and fails on:

- script errors, links without an address, sideways scrolling, text cut off or off the screen
- text under 16 px on a phone or 14 px elsewhere (12 px for the mono labels, the ruler and the plan labels, measured on screen)
- text under WCAG AA contrast against what is actually behind it, and parts that carry meaning (field and choice borders, the rota's boxes, the now line, open dots, the plan route) under 3:1
- the ruler not even, not starting at the left edge of the boxes, labels overlapping each other or the now chip, the now line off its time, a rota row with nothing in it
- a plan label over another label or a mark, anything outside the drawing, the north point or scale bar covering a label
- an entrance that does not run once and settle, or reduced motion that is not settled from the start; focus that can't be seen; the spam trap reachable by Tab
- at 1440: any reason showing the wrong fields or labels, a typed email lost on switching, an empty send that does not mark every required field, summarise and move focus, or a good note that does not reach the sent state with a reference, where the copy went and when the reply comes

Fix and build again until every line says ✓.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Add `?ck-now=2026-11-10T22:10:00Z&ck-tz=America/New_York` to see the desk at another moment from another place.

### 6. Put it on the site

`out/contact-embed.html` is the whole section: a fonts link, one `<style>`, the `<section class="ck">` and one `<script>`. Paste it where the contact section goes. Every class starts with `ck-`, so it does not collide with the page around it. Without the script, the form still posts (every reason's fields show, and the hours show as text).

If `form.endpoint` is set, the note is sent as JSON: `reason`, `to`, `ref`, `sentAt`, `visitorTimeZone` and one key per field. Answer with any 2xx status. The honeypot field arrives empty from people; if it has a value, the page shows the sent state and sends nothing.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920×1080, 30 fps, 18.5 s: the desk arrives, the slip morphs to `preview.switchTo` and back, the page moves to the rota and the plans, back up, and the note is sent) and `out/poster.png` from the first settled stretch. `--moments` prints the settled stretches; take stills only inside them. `--still 2.5 --form invalid --clip .ck-slip --png invalid.png` saves one state; `--size 390x844 --scale 2` records the phone layout.

## How it behaves

- **1100 px and wider**: reasons on the left (440 px), the slip on the right; the rota with names, the 24-hour track and statuses in three columns; offices two up.
- **900 to 1100 px**: narrower columns; the ruler labels every 6 hours if the track is under 520 px.
- **Under 900 px**: reasons, then the slip, then the "not sure" note; rota rows stack (name and status, then the track), the now line becomes a short tick through each track; offices one per row.
- **Under 760 px**: text at 16 px, full-width send button; plans switch to their `crop`, labels and marks scale up to stay at 12 px or more, labels slide inside the drawing, and the north point and scale bar move to a corner where they cover nothing.
- **Time**: everything is worked out in the browser from the hours and time zones, and updated every minute. Reply times are shown in the visitor's own time zone.

## contact.json, every field

Lengths are characters. Required unless marked optional.

**Page**
- `brand` (1 to 60), `title` (1 to 70), `description` (20 to 170), `lang` (optional, default `en`)
- `eyebrow` (1 to 40): the small line above the headline
- `headline` (8 to 90): one `_turn_` between underscores is set in the accent (italic in the `spectral` voice)
- `labels` (optional): `routes` (default "What is it about?"), `note` ("Your note"), `rota` ("Who is at the desk"), `visit` ("Come and see us"), `visitNote` ("Appointments only, so someone is there to meet you.")

**theme**
- `page`, `surface`, `ink`, `accent`, `onAccent`, `open`: `#rrggbb`. The build requires ink on page and on surface at 7:1, accent on page at 3:1 and on surface at 4.5:1 (it is also the error colour), onAccent on accent at 4.5:1, open on page and surface at 3:1
- `error` (optional): its own error colour, 4.5:1 on surface
- `voice` (optional, default `spectral`): `spectral` (Spectral light with Albert Sans and Fragment Mono), `geist` (Geist and Geist Mono), `hanken` (Hanken Grotesk and JetBrains Mono)
- `corners` (optional, default `square`): `square` (2 px) or `round` (10 px cards, pill buttons and chips)
- On a dark page the send button takes the accent; on a light page it is ink.

**people**: an object of 1 to 8 people keyed by a short id (lowercase letters, digits, `_`)
- `name` (2 to 40), `role` (2 to 40; the part before a comma shows on the reason rows), `city` (2 to 24)
- `tz`: an IANA time zone
- `hours`: `{ "mon-fri": "09:30-18:30", "sat": "10:00-13:00" }`. Keys are days or day ranges (`mon` to `sun`); values are `HH:MM-HH:MM` on 5-minute steps, a list of them for split shifts, or `null` for a day off. A night shift is split at midnight over two days.
- `away` (optional, up to 12): `[["2026-12-21", "2027-01-03"]]`, first and last day off, in the person's own calendar

**routes**: 3 to 5 reasons
- `id` (lowercase), `title` (3 to 44)
- `to`: 1 to 4 people ids. With more than one, the reason is a desk: anyone on it who is in counts, and `desk` (2 to 24, such as "Support desk") names it
- `reply`: `{ "within": 1 to 10, "unit": "working-hours" | "working-days" }`, optional `say` (3 to 30) to word it yourself ("two Fridays"). Working hours are counted through whoever on the reason is in, minute by minute. A working day is a day on which someone on the reason works; the reply comes by the close of the nth one after today (today counts if it has not started yet). The time is rounded up to the half hour.
- `email`: where this reason's notes go when there is no endpoint, and the "Rather use email?" link
- `ref`: 2 to 4 capital letters, the start of the reference number (`BMA-1110-027`)
- `note` (optional, 4 to 90): the line under the reply time. Without it, a desk says who is in now; one person says they reply within the promise
- `button` (optional, 3 to 28): the send button. Default "Send to Inês" or "Send to the support desk"
- `sent`: `headline` (4 to 60), `read` (4 to 60) and `reply` (4 to 60), with `{name}` (the visitor's first name, if there is a `name` field), `{first}` (who picks it up) and `{city}`
- `fields`: 2 to 7, and one of them a required `email`
  - `k`: the key (lowercase); the same key in two reasons is the same field on the page, so it must be the same kind with the same options
  - `type` (default `text`): `text`, `email`, `tel`, `url`, `date`, `select` (2 to 8 `options`), `choice` (2 to 8 `options` as chips), `swatch` (2 to 6 `options` of `{ "label", "color": "#rrggbb" or "none" }`, chips with a colour dot), `textarea`
  - `label` (2 to 40), `hint` (optional, 2 to 60), `placeholder` (optional, 1 to 60), `required` (default false), `half` (default false: two half fields share a row on wide screens), `mono` (default false: set in the mono face, for codes), `autocomplete` (optional)
  - `pattern` (optional, a regular expression the whole value must match, checked in capitals) with `patternMessage` (6 to 90), the sentence shown when it does not

**aside** (optional): `lead` (2 to 40, bold), `body` (10 to 200), and optionally `phone` (international, such as +351 21 000 4810) with `phoneLabel` (2 to 24) and `phoneHours` (4 to 60). It sits under the reasons on wide screens and under the slip on narrow ones.

**offices** (0 to 3)
- `city` (2 to 28; its first word shows on the board), `address` (1 to 4 lines of up to 48), `tz`, `hours` (as for people), `note` (optional, 4 to 80), `directions` (optional https link)
- `steps`: 2 to 4 arrival steps of 8 to 140, `*bold*` allowed
- `plan`:
  - `size` (default `[600, 340]`, from 300 by 200 to 1200 by 900): the grid every point is on
  - `blocks` (1 to 40 shapes): neighbouring buildings, hatched. A shape is a list of 3 or more `[x, y]` points
  - `us`: your building's outline; `door`: two points on that outline (the swing opens inward from the first)
  - `water`, `green`, `courts` (optional shapes): water hatched in waves, planted ground, open courtyards drawn dashed
  - `stairs` (optional): `{ "at": [[x, y], [x, y]], "width": 8 to 80, "treads": 3 to 30 }`
  - `gate` (optional): two points, drawn dashed; `bay` (optional): `{ "at": [two points], "label": up to 10 }`
  - `route`: 2 to 12 points from where people arrive to the door and inside; drawn dotted in the accent
  - `marks`: one point per step, each within 40 units of the route
  - `labels` (optional, up to 8): `{ "text": 1 to 24, "at": [x, y], "angle": -90 to 90 }`, set in the mono face
  - `north` (optional, default 0): degrees from straight up; `scale` (optional, default `{ "metres": 20, "units": 80 }`)
  - `crop` (optional, default the whole plan): `[x, y, width, height]` for phones, at least 200 by 160, between 4:5 and 8:5, holding the whole route, the door and every mark at least 24 units from its edge

**form** (optional)
- `endpoint` (default `null`): an https address that takes a JSON POST, or `null` to hand the note to the visitor's email app
- `honeypot` (default `company_website`): the spam trap's field name
- `alt` (6 to 80, default "A person reads every note."): the line under the email link

**preview** (optional; used by the check and the recorder, never on the live page)
- `now` (an ISO time) and `tz` (the visitor's zone for the preview)
- `switchTo`: the reason the video morphs to; `ref`: the three digits of the preview's reference number
- `draft`: `{ "key": "value" }`, what the preview's fields hold

## Troubleshooting

- **"theme: the accent … is 2.6:1, needs 3:1"**: the accent carries the now line, the selected rule and the plan route. Darken it on a light page, lighten it on a dark one, and keep `onAccent` readable on it.
- **"says there is no form, but this section is a form"** (or "24/7", "instant", "chat with us"): the build refuses copy the page cannot keep. Say what it does instead: "No chat window, no bots. A person reads every note."
- **"mark 3 is 56 units from the route"**: extend the route into the building to where that step happens (the floor, the counter), then put the mark on it.
- **"the crop: mark 1 … falls outside the phone crop"**: widen the crop or move it, keeping it between 4:5 and 8:5. A route that runs the whole width of the plan needs a shorter approach on the phone: start the route closer to the door.
- **"a plan label covers a mark"** from the check: move the label along its street, away from the mark. On phones labels grow to stay at 12 px, so leave room.
- **"two ruler labels overlap"**: the rota's track is narrower than the labels; this should not happen with the kit's widths, so look for CSS from the page around it squeezing `.ck-rota`.
- **The reply time looks too late**: check the people's hours and `away` ranges, and remember a reason waits for whoever is on it. A desk across three time zones answers overnight; one person on Fridays only answers on Fridays (say so with `reply.say`).
- **The note does not arrive**: with an endpoint, the page shows "This did not go through" and an email link when the POST fails or takes over 20 seconds; check the endpoint accepts JSON from your domain. Without one, notes go through the visitor's email app, so they arrive only when the visitor presses send there.
