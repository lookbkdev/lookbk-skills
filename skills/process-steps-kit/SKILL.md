---
name: process-steps-kit
description: "Build the \"how it works / our process\" section of a service or product from one process.json - the schedule page of a signed proposal rather than numbered circles. Three to seven steps, each saying who does it, how long it really takes, what the buyer gives, gets and pays. A programme chart draws every step to scale on one calendar of working weeks, with a lane that adds up the hours the buyer is needed. As you scroll, the project day moves a cursor through the programme and changes the deliverable on a sticky desk. The build checks the arithmetic (no gaps or overlaps unless marked parallel, steps add up to the stated weeks, buyer hours match the rounding rule, payments add up to 100 % or the fixed fee). Self-contained page and paste-in embed, a check at four widths (text size and contrast, chart labels that never collide, bars to scale, reduced motion, no JavaScript) and a frame-by-frame recorder. Use for a \"how it works\" or \"our process\" section."
license: MIT
---

# How It Works

The section that answers the questions a buyer asks before they sign. The governing idea: **the process is a schedule, not a promise.** Every step is drawn to its real length on one calendar, the buyer's own hours are counted on their own line, and each stretch of time ends with a document they are handed. Nothing is equal-width: the bars, the rail and the scroll follow the days.

**What is on the page:**

1. **Intro**: eyebrow, a headline with one turn in the accent, a lede, and three ruled facts: *Start to finish* (worked out from the calendar), *Your time, in total* (added up from the steps, in the buyer's colour) and the price.
2. **The programme**: a week axis, one row per step with its bar drawn strictly to scale (upcoming bars are outlines, done bars are solid, the current bar is the accent), and a *Your time* lane with a diamond and the hours at every day the buyer is needed. The cursor is a 2 px accent line drawn in each lane, so it never runs through a name, the axis or the hours; its flag ("Week 5 · day 21") sits in the axis row and stands in for the week labels it covers. Hour labels are centred under their diamonds, nudged inside the chart, moved to a second line when they would touch, and only then dropped, in which case a plain list under the chart shows every one.
3. **The steps**, a real ordered list. On the left a rail: on two columns each step is `floor + K px × days` tall (K is up to 9 px a day, smaller for long projects), so six weeks take visibly longer to scroll past than a site visit, and week ticks (W4, W5 ...) sit exactly where the reading line will meet those weeks. Each step: "Weeks 3–8 · 6 weeks", `03 / 05 · who`, the title, one sentence, *How long*, *You give* (buyer's colour), *You get*, and a payment chip ("Deposit 40%").
4. **The desk** (two columns, sticky): a small copy of the programme with its own cursor, "03 · Made in our workshop" and "Week 5 of 12", the deliverable on a gridded desk, then "You get ..." and "In hand: 3 of 5". Earlier papers stay under the current one as blank sheets, offset and turned, two deep. A log prints a dated line only once the cursor has passed that day.
5. **The deliverables** are drawn in HTML and SVG, not stock images: a measured plan with dimension lines and a title block, a sheet (a quote whose lines must add up to its total, or label and value pairs), a dated log, a certificate with a seal, a calendar invite, one or two presentation slides, a site in a browser frame, a guidelines spread, or your own photo. They are pictures: hidden from screen readers, each with a written `alt` read out beside it.

**Layouts.** From 980 px: two columns, the sticky desk and the proportional rail. 700 to 979 px: one column with the rail and its week labels on the left, and each deliverable on its own desk right after the step's sentence. Under 700 px: a vertical timeline in a 40 px gutter, "Weeks 3–8" above each step, the details stacked and the deliverable inline, scaled to the column. Without JavaScript, every step and deliverable shows in that single-column form.

**Motion.** One number drives it, so it is a measurement rather than a show. The cursor, flag, mini cursor, ticker and rail follow the scroll directly. Bars and titles change colour over 350 ms. A new paper fades in over 450 ms and rises 14 px over 600 ms (`cubic-bezier` ease-out); the one before slides to the pile (−26 px, −20 px, −2.2°, scale 0.94 per level) in the same 600 ms while its print fades. The page sets `data-settled` when nothing is moving. **Reduced motion**: every change is instant.

**What you can change, honestly.** All copy, the number of steps (3 to 7), the calendar (days, 5 to 7 working days a week), the steps' start and length, parallel steps, the buyer's touchpoints, payments, the price, every deliverable's content, six theme colours (contrast enforced at build time and measured again in the check) and the display face (Newsreader, Bricolage Grotesque or Archivo, each with its own text and mono faces). The spacing, the type scale and the motion are the design.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the check and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/process.css`: the whole design, scoped to `.ps`: the intro, the programme, the rail, the desk, the nine kinds of deliverable, the tablet and phone rules and the reduced-motion rule.
- `kit/runtime.js`: the browser runtime, inlined into every build. The project day under the reading line, the cursor and its flag, the rail's proportional heights and week ticks, the hour labels' placement, the desk and its pile, the logs, and the recording clock (`?ps-record=1`).
- `scripts/build.mjs`: process.json to `out/index.html` (a short demo page around the section) and `out/process-embed.html` (the section to paste in).
- `scripts/kit/schema.mjs`: every field, its limits, the colour rules and the arithmetic; lists every problem at once.
- `scripts/kit/artifacts.mjs`: draws each kind of deliverable.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, and with JavaScript off at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/ashby/process.json` (a kitchen renovation firm, light) and `examples/northfold/process.json` (a brand identity studio, dark).

## Steps

### 1. Collect the schedule

From the person, or from their proposal or their current page, for each stage of the work:

- **What it is called and who does it** (a name and a role is better than "our team").
- **When it starts and how long it takes**, in working days from the start of the project. Ask for the real figures; a one-day survey and a six-week build must look different.
- **What the buyer gives**: their time (when, and how long), access, decisions, money.
- **What the buyer gets at the end**: a named document, call, drawing, prototype or report. Every step needs one; if a stage hands over nothing, it is part of another stage.
- **What they pay and when**: percentages that add up to 100, or amounts that add up to the fixed fee, or free.
- For each deliverable, enough real content to draw it (the quote's lines and total, the log's dated lines, the plan's sizes) and one sentence describing it for screen readers.

### 2. Write process.json

Copy the example closest in spirit and replace every value:

- `examples/ashby/process.json`: Ashby & Rowe, kitchens. 60 working days (12 weeks), five steps from a measured survey to a ten-year guarantee, payments 40 / 50 / 10 %, about 6 hours of the buyer's time. Newsreader on oat with enamel green and ochre.
- `examples/northfold/process.json`: Northfold, brand identity. 40 working days (8 weeks), five phases from an intro call to guidelines, a fixed fee of £21,000 in four amounts, about 9 hours. Bricolage Grotesque on near-black with vermilion and lilac.

### 3. Build

```
node <skill>/scripts/build.mjs process.json out
```

It lists every problem at once and writes nothing until they are fixed: a gap or an overlap in the schedule (mark a step `"parallel": true` if it really runs alongside), steps that do not add up to `calendar.total`, a stated `yourTime.hours` that the touchpoints do not round to, percentages that do not make 100 or amounts that do not make the fixed fee, a quote whose lines do not add up, a touchpoint or log line outside its step, a step without `get`, a line too long for its place, a colour pair under its minimum, an exclamation mark or an em dash.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440 and with JavaScript off at 390 and 1440. At each size it scrolls to the top, to every step and to the end, and fails on:

- script errors and sideways scrolling
- text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
- text under WCAG AA contrast against the colour actually behind it
- bars, diamonds, the rail and the cursor under 3:1 against the page
- text cut off or off the screen
- any programme label (week, step, hours, the flag) touching another, crossing the cursor, or leaving the chart; an hour label dropped without the list showing
- bars not to scale (within 1 px of the days), rail heights that do not follow `floor + K × days`
- the hours fact not matching the touchpoints and the rounding rule; aria-current not on exactly one step; a list that is not one item per step
- the desk not settling within 900 ms of a move (at once under reduced motion), or the wrong step's paper on the desk
- with JavaScript off, a step or its deliverable not showing

Each line reports the text pairs measured and the lowest contrast as a multiple of its minimum, the marks measured and the lowest of them, the chart labels checked and at how many positions, and the buyer's minutes. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints and scroll through on a laptop and a phone.

### 6. Put it on the site

Paste `out/process-embed.html` where the section belongs. It brings its own fonts, styles and script, and every class starts with `ps-`. Use one per page.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 15.7 --poster 8.95
node <skill>/scripts/record.mjs out/index.html --still 8.95 --size 390x844 --scale 2 --png phone.png
```

The video follows a fixed script: 1.6 s on the intro and the programme, then for each step a 1.1 s move and a 1.6 s dwell, and 0.6 s more at the end (15.7 s for five steps). `--moments` prints when each dwell has settled; take stills and posters between a dwell's `settled` and `to`.

## process.json, every field

Top level:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `brand` | 1 to 40 characters | required | the demo page's name |
| `studio` | up to 32 | required | the legend: "`studio` does the work" |
| `lang` | language tag | `en` | |
| `eyebrow` | up to 56 | required | |
| `headline` | up to 80, one `_turn_` | required | the turn takes the accent |
| `lede` | up to 200 | none | |
| `theme` | see below | required | |
| `calendar` | `{ total, week, note?, endLabel? }` | required | `total` in working days (1 to 520, whole weeks); `week` 5 to 7 (default 5); `note` up to 64 replaces "Bars drawn to scale · 1 week = 5 working days"; `endLabel` is the flag at the very end (default "Handed over") |
| `price` | `{ kind: "from" or "fixed", label (up to 24), value, currency (up to 3) }` | none | `fixed` makes step amounts add up to `value` |
| `yourTime` | `{ hours }` | none | optional: a figure you want checked against the touchpoints |
| `steps` | 3 to 7 | required | in the order they start |
| `demo` | `{ title, nav: [left, right], footer }` | none | the demo page around the section |

Each step:

| Field | Range | Notes |
| --- | --- | --- |
| `title` | up to 32 | |
| `who` | up to 48 | a name and a role |
| `start` | day 0 to `total` − 1 | 0 is the first working day |
| `length` | 1 or more days | must not run past `total` |
| `parallel` | true or false (default false) | a step that runs alongside another; it is drawn but left out of the sum |
| `summary` | up to 140 | one sentence |
| `give` | up to 90 | what the buyer gives |
| `get` | up to 90, required | what they are handed |
| `pay` | `{ label (up to 16), percent or amount or free: true, credited?: true }` | `credited` amounts are paid and later taken off, so they are not counted |
| `you` | up to 4 `{ day, minutes (5 to 600) }` | when the buyer is needed, inside the step |
| `artifact` | see below | required |

The arithmetic: the steps not marked parallel must start at day 0, follow each other with no gap or overlap, and add up to `calendar.total`. **Your time** is the sum of every `you.minutes`, said as minutes under an hour, otherwise rounded to the nearest whole hour with halves rounding up, with "about" unless it is a whole number of hours (345 minutes is "about 6 hours").

`artifact` by `kind` (every kind needs `alt`, up to 160, read out instead of the picture):

| kind | Fields |
| --- | --- |
| `plan` | `meta` (48), `size` [width, depth] mm, `window?` [from, to] mm on the top wall, `door?` { at, width } mm on the bottom wall, `units?` up to 12 [x, y, w, h] mm, `marks?` [{ x, y, label (10) }], `block` 1 to 3 [label, value] |
| `sheet` | `meta` (40), `title` (44), `style` `table` or `pairs`, `rows` 2 to 8 [label (40), value (44)], `total?` [label, value], `stamp?` (16), `sum?` true checks that the rows add up to the total |
| `log` | `meta`, `title` (32), `entries` 2 to 7 { day (inside the step), label (8), text (60) } |
| `certificate` | `meta`, `title` (28), `body` (140), `foot?` (48), `seal` { big (3), small (8) } |
| `invite` | `label` (16), `duration` (12), `title` (40), `when` (32), `people` 1 to 4 initials, `agenda` 1 to 4 [time, text], `accept` (12) |
| `slides` | `slides` 1 or 2 { meta (28), mark (18), style `serif` or `sans`, swatches 1 to 4 colours, dark? } |
| `screen` | `url` (use your own domain or `https://<brand>.example`), `headline` (28), `button` (16), `tile` { color, letter (2) } |
| `spread` | `meta` (24), `title` (48), `body` (90), `swatches` 2 to 4 [name, colour], `pages` [left, right] |
| `image` | `src`: https or a path next to the page; your own photo of the deliverable |

`theme`, colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `page` | | the ground |
| `ink` | 7:1 on `page` | muted text is derived at 5.2:1, bar outlines at 3.3:1, done bars at 5.6:1 |
| `accent` | 4.5:1 on `page` | now: the cursor, the current step, the turn |
| `onAccent` | 4.5:1 on `accent` | the flag's text |
| `you` | 4.5:1 on `page`, and clearly unlike `accent` | the buyer: your time, You give, In hand |
| `stage` | must differ from `page` | the desk |
| `paper`, `paperInk`, `paperDark` | optional | the deliverables' stock |
| `display` | `newsreader`, `bricolage`, `archivo` | default `newsreader` |

## Troubleshooting

- **The build lists problems and writes nothing.** Fix them all and build again; it reports everything at once.
- **"a 2-day gap before steps[2]".** The schedule must add up. Add the waiting as its own step (with what the buyer gets while they wait), or move the start.
- **"overlaps by 2 days".** If the two really run together, add `"parallel": true` to the later one; otherwise move its start.
- **"yourTime.hours says 7".** The touchpoints round to another figure. Change the touchpoints or the figure; the page always shows the rounded sum.
- **The ochre or lilac fails contrast.** The buyer's colour is also 12 px text, so it needs 4.5:1. Darken it on a light page, lighten it on a dark one.
- **An hour label shows in the list under the chart instead of on it.** Two touchpoints are too close together at that width. That is expected on a phone; on a wide screen, merge them into one touchpoint.
- **A deliverable looks small on the desk.** It is scaled to fit the desk. Shorten its longest line, or use the `sheet` kind for long text.
- **No video.** Install ffmpeg or set `FFMPEG_PATH`. The check and stills don't need it.
