---
name: feature-tabs-kit
description: Build the "how it works" features section of a product page from one features.json - 3 to 6 features in a tab rail (numbered lines beside the stage on desktop, a sticky row of chips on phones) and one large stage that shows the product doing each thing. The stage is drawn from the config as real UI, not a screenshot box - a list, a before/after match, a bar chart, an email, a form, a rate picker, a code request or a tracking timeline - and every view is built from the same shared objects. A tab switch keeps what two views share and moves it from where it was to where it goes (the receipts slide across to meet the bank lines, the names become bar labels, the bars grow out of their amounts), so each switch looks caused. The tour advances on a visible clock, pauses off screen, and stops for good on any input; the tabs are a real tablist with Arrow, Home and End keys, swipe on phones, and a stacked page without JavaScript. The build checks the numbers add up across views. Builds a self-contained page and a paste-in embed, with checks at four widths (text size, measured contrast, overflow, empty bands, stage height, keys, swipe, tour) and a frame-by-frame recorder for the preview video.
license: MIT
---

# Feature Tabs Kit

The features section that shows instead of lists. The governing idea: **the stage is one object and every tab is a verb applied to it.** Switching tabs does not swap a picture. It moves the same receipts, the same parcel and the same values into a new arrangement, so the reader watches the product do the work.

- **Shared objects.** `objects` in the config are the things your product handles: a receipt with its amount, a parcel's address, a price. Every view that shows one writes it the same way, and the runtime moves it between views (560 ms, `cubic-bezier(.65,0,.25,1)`, staggered 22 ms in reading order). Whatever is new to a view (a bank line, a total, a link) fades in after the travellers have left their places (300 ms, from 260 ms). The old view leaves in 180 ms. A bar in a chart starts as the box of the amount it came from and grows into the bar.
- **Numbers that agree.** The build works out what the views count and stops if the config disagrees with itself: the chart's total against its objects (Tallowby: in £6,214.35, out £2,645.90, kept £3,568.45), the "4 of 5" matched count against the rows, the selected rate against the price object the code and tracking views show (Parcelwright: €23.60). A proof figure can be taken from the view (`"from": "matched"`) so it can't drift.
- **A stage that never jumps.** The stage is as tall as its tallest view at the current width, measured on load, on resize and when fonts arrive. The rail, caption and phone copy are held at their tallest too, so the page doesn't move when the tab changes. Each view then fills that height: its rows share the spare room, so no view leaves an empty band under it. The check fails any view with an empty stretch over 12% of the stage.
- **The tour.** It advances every `tour.seconds` (default 7). Its clock is a 2 px rule beside the active tab, filling top to bottom (under the chip on phones). It runs only while the stage is at least 35% on screen and the browser tab is visible, and pauses while the mouse is on the rail. Any click, key, focus on a tab or touch on the stage stops it for good, and the label says *Tour stopped · you are driving*.
- **A real tablist.** `role="tablist"` with `aria-orientation` set to vertical beside the stage and horizontal as chips (it follows the layout on resize), roving tabindex, Arrow keys in both axes, Home and End, automatic activation, and one `role="tabpanel"` labelled by the active tab. The panel carries the feature's title and claim for screen readers; the rail's copy of them is hidden from them.
- **Phones.** The rail becomes a sticky row of chips that scrolls sideways (the next chip is cut at the edge so the row reads as more), with the active chip scrolled into view. Each view has a phone layout: the list drops its category column, the match stacks bank line and receipt, the chart puts each bar under its label, the email drops its side timeline, code wraps. Swiping the stage left or right changes the tab. The claim and proof sit under the stage.
- **Reduced motion.** No tour, nothing travels: a switch replaces the view with a 120 ms fade.
- **No JavaScript.** Every feature is shown stacked, each with its own stage and caption.

## What you need

- Node.js 18 or later. Nothing to install from npm.
- Chrome, Chromium or Edge, for `check.mjs` and `record.mjs` (found automatically, or set `CHROME_PATH`).
- ffmpeg, only to record the preview video.
- The features: 3 to 6, each with a short title, a one-sentence claim, a proof number and what the stage should show.
- The objects your product handles in those features, with real-looking values. Invent believable ones; never paste a customer's data.

## Files

- `kit/feature-tabs.css`: the whole design, scoped to `.ftk`. The rail, the stage, the eight view types, the phone and tablet rules, the no-JS stacked layout and reduced motion.
- `kit/runtime.js`: the browser runtime, inlined into every build. The tablist, the shared-object switch, the stage and section heights, the tour, swipe, and the recorder's script.
- `scripts/build.mjs`: features.json to `out/index.html` (the section on its own page) and `out/feature-tabs-embed.html` (to paste in).
- `scripts/kit/schema.mjs`: every field and its limits, colour contrast, and the numbers check; lists every problem at once.
- `scripts/kit/views.mjs`: draws each view type as HTML from the config.
- `scripts/check.mjs`: serves the page and checks every tab at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, and without JavaScript at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills (`--still`, `--full`, `--nojs`) and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/tallowby/features.json`: light; bookkeeping for a bakery. List, match, chart, email.
- `examples/parcelwright/features.json`: dark, rail on the right; a shipping API. Form, rates, code, tracking.

## Steps

### 1. Collect the content
For each feature: the verb (the tab title, 20 characters at most), the claim (one sentence), a proof figure and its label, and a caption that says what the stage shows ("The same five lines, now paired with the bank feed."). Then the objects: what appears in more than one view. The more objects two neighbouring views share, the more the switch moves instead of fading; the build warns when two neighbours share nothing.

### 2. Write features.json
Start from the example closest to your product (Tallowby for money and records, Parcelwright for developer and logistics products). Change the theme, the header, the objects, then each feature's view. Every field is listed below.

### 3. Build
```
node scripts/build.mjs features.json out
```
It prints the numbers it checked (`matched 4 of 5, net £3,568.45, …`) or every problem in the file at once, with its path (`features[2].view.total.expect: says £3,600.00 but the objects add up to £3,568.45`).

### 4. Check
```
node scripts/check.mjs out/index.html
```
It shows every tab at each width and prints `ok` or `FAIL` per run, with the stage height, the largest empty band per tab, how many things travel in each switch and how many bars grow. Fix every FAIL: a long label that wraps the tallest view taller makes the others sparse, so shorten it before you loosen the layout.

### 5. Look at it
```
node scripts/serve.mjs out
```
Open the address it prints. Let the tour run once, then click, use the arrow keys, and on a phone swipe the stage. Look at it with reduced motion on, and with JavaScript off.

### 6. Put it on the site
Paste `out/feature-tabs-embed.html` where the section goes: the font links into `<head>` (or load the same fonts your way), the rest in place. It is one `<section class="ftk">` with its CSS and script; every class starts `ftk-`. Use it once per page.

### 7. Record a preview (optional)
```
node scripts/record.mjs out/index.html --seconds 12 --size 1920x1080 --poster 4.2
node scripts/record.mjs out/index.html --moments
node scripts/record.mjs out/index.html --still 1.2 --size 390x844 --scale 2 --png phone.png
```
The recording is the tour's fixed script: each tab held 2.1 s, then a 0.9 s switch, so 4 tabs take 12 s and loop. `--moments` prints the settled stretches (from 0.15 s into a hold to 0.05 s before its switch) and the switches; take stills from inside a settled stretch, or from a switch on purpose.

## features.json, every field

| Field | What | Range / default |
| --- | --- | --- |
| `lang`, `title` | Page language and title | optional; `en`, the eyebrow |
| `theme.mode` | `light` or `dark` | required |
| `theme.bg`, `ink`, `mute`, `rule` | Page background, text, secondary text, hairlines | `#rrggbb`; ink and mute need 4.5:1 on bg |
| `theme.sheet`, `sheetInk`, `sheetMute`, `sheetRule` | The stage's paper, text, secondary text, rules | `#rrggbb`; 4.5:1 on sheet |
| `theme.accent`, `onAccent` | The turn, the timer, selection, buttons; text on a button | `#rrggbb`; accent 4.5:1 on sheet and 3:1 on bg; onAccent 4.5:1 on accent |
| `theme.accent2`, `ok` | Code strings and the scan line; money in and matched links | `#rrggbb`; ok 4.5:1 on sheet |
| `theme.display` | `newsreader`, `fraunces` (serif, italic turn), `schibsted`, `bricolage` (grotesk, colour turn) | required |
| `theme.text`, `theme.mono` | `public-sans`, `schibsted`, `hanken`; `jetbrains`, `plex` | required |
| `theme.radius` | Corner radius of the stage and boxes | 0 to 14, default 4 |
| `theme.railSide` | Rail beside the stage on the `left` or `right` | default `left` |
| `theme.stage` | `plate` (a sheet on an offset slab) or `shadow` (one long soft shadow) | default `plate` light, `shadow` dark |
| `money.currency`, `money.locale` | How amounts are written | e.g. `GBP`, `en-GB`; an object can override both |
| `header.eyebrow` | Mono line above the headline; also the tablist's name | 1 to 48 characters |
| `header.headline` | `\n` breaks the line, `_one turn_` in the accent | 1 to 72 characters |
| `header.lede` | Beside the headline | 1 to 200 characters |
| `stage.name` | The document in the stage's bar | 1 to 44 characters |
| `stage.states` | One state per feature after the name (`"quoted"`, or `{ "text", "tone": "ok" \| "accent" }`) | optional; as many as features |
| `objects[]` | The shared things: `id` (lowercase), and either `amount` (≥ 0, with `flow` `in`/`out`, `label` ≤ 32, `tag` ≤ 16, `currency`, `locale`) or `text` (≤ 64; keep a value and its unit together, `"2.4 kg"`) | 2 to 12 |
| `features[]` | 3 to 6 features | |
| `.title` | The tab | 1 to 20 characters |
| `.crumb` | The step name in the stage bar | ≤ 12; default the title's first word |
| `.claim` | One sentence | 1 to 150 characters |
| `.proof` | `{ "value" ≤ 10, "label" ≤ 34 }`, or `"from"`: a number the view works out (`matched`, `rows`, `net`, `netWhole`, `in`, `out`, `share`, `options`, `selected`, `events`); a value given with `from` must equal it | required |
| `.caption` | What the stage shows, as a figure caption | 1 to 130 characters |
| `.view` | One of the types below | required |
| `tour.auto` | Run the tour | default `true` |
| `tour.seconds` | Seconds per tab | 4 to 15, default 7 |
| `tour.running`, `paused`, `stopped` | The tour's status line | ≤ 40; defaults `Touring · 7 s each`, `Paused while you point`, `Tour stopped · you are driving` |

### View types

| `type` | Fields |
| --- | --- |
| `list` | `columns` (3 headings), `rows[]`: `{ obj, sub? ≤ 32, live? }` (2 to 7; `live` draws the scan line on that row). Shows label, tag, amount. |
| `compare` | `summary` ≤ 60 (beside the computed "4 of 5"), `left`, `right` ≤ 18, `rows[]`: `{ obj, raw ≤ 22, open? ≤ 20 }`. A row with `open` is unmatched. |
| `chart` | `total`: `{ label ≤ 28, note? ≤ 60 with {in} {out} {net} {share}, expect? }`, `groups[]`: `{ label ≤ 18, objects[] }` (1 to 3 groups, 1 to 6 objects), `net` ≤ 14 (the net row's label). Bars are scaled to the largest amount. |
| `message` | `to` ≤ 48, `subject` ≤ 60, `body` ≤ 200, `lines[]` (object ids), `attachment`: `{ kind ≤ 4, name ≤ 32 }`, `steps[]`: `{ title, meta, done? }` (hidden on phones). |
| `form` | `fields[]`: `{ label ≤ 20, obj, status?, focus?, half? }` (1 to 6), `segment`: `{ label, options (2 to 4), selected }`, `note?`, `button` ≤ 20. |
| `choice` | `route`: `{ chip? (a text object), from, to }`, `scale`: `{ steps 2 to 10, min, max }`, `options[]`: `{ label or obj, sub ≤ 34, days, price, selected?, priceObj }` (exactly one selected; its `price` must equal its `priceObj`), `note?`, `button`. |
| `code` | `tabs?` (≤ 5 language names), `request`: `{ method, path, fields[]: { key, obj or value } }`, `response`: `{ status, fields[]: { key, obj or value, phone?: false } }`. |
| `timeline` | `head`: `{ label, obj, sub?, asideLabel, aside, paid? }`, `events[]`: `{ event (a_name), place or obj, time?, state: done/now/next }` (2 to 7, at most one `now`). |

## Troubleshooting

- **"an empty band of …px (…% of the stage)"**: one view is much shorter than the tallest at that width. Trim the tallest (fewer rows, a shorter body, `phone: false` on a long code line) or add a row to the short one. Spreading rows further only moves the empty space between them.
- **"the stage is …px tall on tab 2"**: something in a view changed size after the stage was measured, usually a web font that failed to load. Check the font link and that the page is served, not opened from a different folder.
- **"switch 1→2: 5 shared items but only 3 travel"**: two atoms with the same key are drawn in one view; each object part may appear once per view.
- **A switch fades instead of moving**: the two views share no object. The build warns about it; let the views show some of the same objects.
- **"says £3,600.00 but the objects add up to £3,568.45"**: fix the amounts or the expected total; the build will not write a page that disagrees with itself.
- **Text under 16 px on a phone**: shorten labels rather than shrinking them; chips, mono labels and code may go to 12 px.
- **The tour never starts**: it waits until the stage is 35% on screen, and never runs with reduced motion or after the reader has touched the section.
- **No Chrome found**: set `CHROME_PATH` to Chrome, Chromium or Edge.
