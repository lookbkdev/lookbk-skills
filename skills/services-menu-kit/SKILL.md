---
name: services-menu-kit
description: Build the services section of an agency, studio or consultancy from one services.json, set like a well-made menu instead of six icon cards. Every service says what the client is handed, how long it takes, what it costs ("typically" and "from"), what the client must bring and when not to buy it. Services sit in 2 to 4 courses (start here, the main work, ongoing); common combinations become set menus whose totals and weeks are worked out from their parts, overlap included, and printed as an itemised bill. A "help me choose" form takes a budget and a deadline and marks every service and set as fits, a stretch or not now, with one sentence of why, a polite live tally, a bar that keeps the choice in sight and an address that can be shared. Two layouts (a printed menu and a technical rate card, with a dense option), two type systems, phone layouts, reduced motion, a full no-JavaScript reading, a paste-in embed, a check at four widths that tries every budget and deadline pair, and a frame-by-frame recorder.
license: MIT
---

# Services Menu Kit

The services section a buyer can actually decide from. The governing idea: **a menu, not a brochure.** Every service is priced, timed and bounded on the page; every set is the visible arithmetic of its courses; and the "help me choose" form is a waiter who says, one sentence per dish, why it fits the budget and the week, or why it doesn't.

**What is on the page:**

1. **Masthead**: a kicker, a headline with one `_turned_` phrase, a lede, up to four plain facts ("Prices in USD before tax").
2. **Help me choose**: two real radio groups, *Budget, up to* and *Needed within*, each ending in *Any*. Choosing marks every service and set: **Fits** (a solid bar in the margin), **Stretch** (a dashed bar and a ring) or **Not now** (quieter colours, still readable, still AA, because the reason is the useful half). Each one gets a sentence: "A stretch. Starts at $22,000 but usually runs $28,000, $3,000 over; 8 to 10 weeks against your 8." A tally in a polite live region counts them. The choice goes into the address (`?sm-budget=25000&sm-within=8`), so a link opens on it. Once the form scrolls away, a slim bar at the top keeps the choice and the count in sight, with *Change* to go back.
3. **Courses** (2 to 4), each with a code (I, II, III or `01 / DIAGNOSE`), a title and a note. Each **service**: its name, what the client is handed (2 to 4 concrete outputs), the typical price, the lowest price, how long it takes (or, for ongoing work, the monthly fee, the minimum months and how soon it starts), *You bring* and *Skip it if*.
4. **Set menus** (optional, 1 to 3): a name with its typical total, the parts in order, and a bill: a row per part (weeks, from, typically), a *Planned overlap* row, and *The set* closed by a double rule. You never type a set's price or weeks; the build adds them up.
5. **Foot**: one line of terms and one link.

**The rules behind the marks** (the same function runs in the build, the page and, written again independently, the check):

- Price: *typical* within the cap fits; *from* within it but *typical* above is a stretch; *from* above it is not now. Ongoing work compares the first commitment: the monthly price times the minimum months.
- Time: the longest estimate within the deadline fits; the shortest within it but the longest above is a stretch; the shortest above is not now. Ongoing work compares how soon it can start.
- The worse of the two wins.

**Layouts.** `menu`: a centred masthead and a double rule, a margin column for the verdict, the name on a dotted leader to the price at the right, the outputs as an italic line of ingredients. `ratecard`: a left masthead, a bordered chooser, column heads on every course (Service, Typically, From, Takes), the price right after the name, the outputs as a two-column list, *You bring* and *Skip it if* in their own column. `ratecard` with `"dense": true` puts each fact on one ruled line for long lists. From 1100 px down both reflow; under 700 px everything stacks, the price becomes one line under the name ("$28,000 typically · from $22,000", then "8 to 10 weeks"), and the set bills drop their From column and print the lowest total underneath.

**Motion** is small on purpose. A mark draws in 360 ms and its label rises 4 px in 300 ms (`cubic-bezier(.2,.7,.2,1)`); the underline of a chosen option draws in 320 ms; the choice bar fades in over 240 ms. Prices never animate. With reduced motion every change is instant. Without JavaScript the chooser and the choice bar stay hidden and the menu reads in full with no verdicts.

**Typesetting.** A figure never leaves its word ("40-page guidelines", "2 hours", "$8,000 a month"), a hyphenated word never breaks at its hyphen ("out-of-date"), and a short last word keeps the one before it. Both type systems use a text face whose hyphen is clearly shorter than its en dash; the check measures it.

**What you can change, honestly.** All copy and every figure; 2 to 4 courses and 3 to 14 services; 0 to 3 sets; the budget caps and deadlines; the currency and locale; the layout and density; the type system; four theme colours (contrast enforced at build time and measured again by the check). The spacing, the type scale and the motion are the design.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the check and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.
- From the person: their real services, with what each one hands over, the lowest and the usual price of the last few jobs, how long they take, what the client must provide and when they would tell someone not to buy it.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/menu.css`: the whole design, scoped to `.sm`: both layouts, the dense option, both type systems, the chooser, the marks, the choice bar, the set bills, the tablet and phone rules and the reduced-motion rule.
- `kit/runtime.js`: the browser runtime, inlined into every build: the chooser, the verdicts and their sentences, the live tally, the address, the choice bar and the recording clock (`?sm-record=1`).
- `scripts/build.mjs`: services.json to `out/index.html` (the section on a page) and `out/services-embed.html` (the section to paste in).
- `scripts/kit/schema.mjs`: every field and its limits, the money format, the colour rules, the set arithmetic and the verdict rules; lists every problem at once.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, and with JavaScript off at 390 and 1440.
- `scripts/record.mjs`: the preview video, a still at a moment, a whole-page picture and the page's settled `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/marrow-street/services.json`: a brand and packaging studio, light, `menu`, Caslon.
- `examples/keelson/services.json`: a data engineering consultancy, dark, `ratecard`, Archivo and IBM Plex.

## Steps

### 1. Collect the services

From the person, their proposals or their current page, for each service: the name; what the client is handed, as nouns you could point at ("40-page guidelines", "a branch you can merge", not "strategy" or "peace of mind"); the lowest fee of recent jobs (`from`) and the usual one (`typical`); the shortest and longest it has taken in weeks, or for retainers the monthly fee, the minimum months and how soon it can start; what the client must bring; and the honest line: when they would tell a client not to buy it. If they have no answer for *Skip it if*, ask "who has bought this and regretted it?" The build will not run without one.

Then group them into courses in the order a client meets them, and ask which combinations people usually book together, and how much the parts overlap in time.

### 2. Write services.json

Copy the example closest in spirit and replace every value:

- `examples/marrow-street/services.json`: light printed menu, three courses, a monthly retainer and a guidelines upkeep, two set menus, one with a 3-week overlap.
- `examples/keelson/services.json`: dark rate card, three courses, one retainer, two combinations, one with a 4-week overlap.

Pick budget caps where the answer changes: just above your cheapest starter, around your typical main course, around your biggest set. Pick the two `preview` choices so the second one changes several verdicts.

### 3. Build

```
node <skill>/scripts/build.mjs services.json out
```

It lists every problem at once and writes nothing until they are fixed: a missing field, a line too long for its place, a `from` above its `typical`, a missing *Skip it if*, a set price typed by hand, an overlap that would make a set shorter than its longest part, a budget cap nothing fits, money written in the copy in another format than the section prints ("$8k", "8000 USD"), a colour pair under contrast. Shorten the words rather than asking for smaller type.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440 and with JavaScript off at 390 and 1440, and works it: chooses every budget and deadline pair in turn and compares each mark, sentence and the tally with the rules written again inside the check; checks the address after each choice and opens a page from one; tries Clear, the arrow keys and the choice bar's Change; adds up every set bill; then measures. It fails on script errors, sideways scrolling, copy under 16 px on a phone or 14 px elsewhere (labels: 12 px), text under WCAG AA contrast (also with services dimmed), text cut off, overlapping or off the screen, a figure split from its word or a hyphenated word split at its hyphen, a last line of one short word, a hyphen drawn as wide as a dash, reduced motion that still moves, invisible focus, and, with JavaScript off, a chooser that shows or a service missing its price or *Skip it if*. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Try a few choices, scroll down, use the choice bar, and look at it on a phone width. Open it again with `?sm-budget=…&sm-within=…` to see a shared choice.

### 6. Put it on the site

Paste `out/services-embed.html` where the services go. It brings its own fonts link, styles (all under `.sm`) and script. One section per page: the address keys are `sm-budget` and `sm-within`.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 18 --poster 5.4
node <skill>/scripts/record.mjs out/index.html --still 12.2 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --full 5.4 --size 1440x900 --png whole.png
```

`--moments` prints the stretches where nothing moves (`top`, `chosen`, `main`, `changed`, `sets`); take stills from inside them. The video is stepped frame by frame, so it is the same on any machine.

## services.json, every field

| Field | What it is | Limits, default |
| --- | --- | --- |
| `layout` | `menu` or `ratecard` | default `menu` |
| `dense` | a tighter rate card, one ruled line per fact | `ratecard` only; default `false` |
| `lang` | the page language | default `en` |
| `money.currency`, `money.locale` | how every figure is printed, in whole units | an ISO code (`USD`, `EUR`, `GBP`) and a locale (`en-US`, `de-DE`); required |
| `theme.type` | `caslon` (Libre Caslon and Libre Franklin) or `archivo` (Archivo, IBM Plex Sans and Mono) | required |
| `theme.bg`, `theme.ink` | ground and text | `#rrggbb`; ink at least 7:1 on bg |
| `theme.accent` | fits, codes, the turned phrase, *Skip it if* (menu) | at least 4.5:1 on bg |
| `theme.stretch` | stretch marks, *Skip it if* (rate card) | at least 4.5:1 on bg |
| `intro.kicker` | the line above the headline | 2 to 48 characters |
| `intro.headline` | with exactly one `_turned_` phrase | 4 to 40 characters |
| `intro.lede` | one or two sentences | 20 to 200 characters |
| `intro.facts[]` | short plain facts | 1 to 4, each 2 to 36 characters |
| `chooser.title` | the form's title | 4 to 24 characters |
| `chooser.budgets[]` | caps, rising, the lowest at or above the cheapest first commitment | 2 to 5 whole amounts; *Any* is added |
| `chooser.weeks[]` | deadlines in weeks, rising, the shortest at or above the quickest service | 2 to 5; *Any* is added |
| `courses[]` | in the order a client meets them | 2 to 4, holding 3 to 14 services |
| `courses[].code` | I, II, III or `01 / DIAGNOSE` | 1 to 16 characters |
| `courses[].title`, `.note` | the course and one line about it | 2 to 24; 10 to 110 characters |
| `services[].id` | lowercase id, used by sets and the page | 2 to 32 characters, unique |
| `services[].name` | the service | 3 to 26 characters |
| `services[].gets[]` | what the client is handed | 2 to 4, each 6 to 56 characters |
| `services[].from`, `.typical` | lowest and usual fee (per month for ongoing work) | whole amounts above 0; `from` at most `typical` |
| `services[].weeks` | `[min, max]` for a project | 1 to 104, min at most max |
| `services[].monthly` | `{ "minMonths", "startsWithinWeeks" }` for ongoing work, instead of `weeks` | 1 to 24; 1 to 12 |
| `services[].bring` | what the client must provide | 10 to 110 characters |
| `services[].skip` | when not to buy it | required, 20 to 150 characters |
| `sets.kicker`, `.title`, `.note` | the set menu heading | 2 to 32; 3 to 24; 10 to 110 characters |
| `sets.items[]` | combinations | 1 to 3; omit `sets` for none |
| `sets.items[].name`, `.note` | the set's name, an optional line | 3 to 24; 10 to 90 characters |
| `sets.items[].parts[]` | project service ids, in order | 2 to 4, no repeats, no ongoing services |
| `sets.items[].overlapWeeks` | weeks the parts run side by side | default 0; the set may not come out shorter than its longest part |
| `foot.text`, `foot.cta` | terms and one link (`label`, `href`) | 10 to 120 characters; `https://`, `/`, `#` or `mailto:` |
| `preview.first`, `.second` | the recorder's two choices (`budget`, `weeks`, or `null` for Any) | values from the chooser |
| `text.*` | every printed label (Typically, from, Takes, You bring, Skip it if, Fits, Stretch, Not now, Clear, Change ...) | 1 to 90 characters each; English defaults |

No line in the copy may use an em dash or an exclamation mark. Money typed into the copy must look exactly like the money the section prints.

## Troubleshooting

- **The build says `"from" is above "typical"`.** `from` is the lowest you have charged for it, `typical` what most clients pay. Swap them, or raise `typical`.
- **The build says a set's price "is worked out from the parts".** Remove `from`, `typical` or `weeks` from the set; it adds up its parts. If you discount bundles, say so in the set's `note` with the figure written the way the section prints money.
- **The build says money is written in another format.** "$8k" or "8000 USD" in a sentence next to "$8,000" in the column reads as two price lists. Write it as the section does (the message shows how), or leave the figure to the price column.
- **The build says the lowest budget cap is below every service's starting price.** A button nothing fits is a broken button. Raise the first cap to at least the cheapest starter (for retainers, the monthly fee times the minimum months).
- **The check says a figure "breaks across two lines" or a line "breaks after the hyphen".** Shorten the line or the word before it; the kit keeps numbers with their words, so a very long compound may not fit a phone column.
- **The check says a text face "draws its hyphen at N% of its en dash".** The fonts did load, but the face in use reads hyphens as dashes. Use one of the two type systems as shipped.
- **The check says contrast is too low on a dimmed service.** Darken `theme.ink` (light) or lighten it (dark); the kit derives the quieter colours from it and the ground.
- **Every service fits everything.** Your caps or deadlines are too generous to say anything. Put one cap between your starters and your main course.
- **The fonts look wrong.** The page loads them from Google Fonts when opened; offline, system fonts stand in and the hyphen check is skipped.
