---
name: itinerary-kit
description: "Build the itinerary page for a guided trip, tour or retreat that a travel company sells, from one trip.json, a route file and a map file. The page is drawn like a surveyor's sheet - one route shown three ways that move together: a map drawn in the page's own type and colours from coordinates (no map tiles, no map service), a whole-trip height strip, and a day-by-day ledger with measured distance, climb, where you sleep, meals, an effort grade by a stated rule and a note. Scrolling through the days moves the map and strip; tapping the strip jumps to a day. Then what is included, departures with places left, and the price. On a phone the map becomes a sticky strip. Every figure is measured or counted by the build, never typed; a stated distance that disagrees with the track stops it. One self-contained page plus a paste-in embed, a check at four widths, and a frame-exact video. Use for walking holidays, cycling or driving tours, photography trips, retreats and expeditions."
license: MIT
---

# Trip Itinerary (Itinerary Kit)

The page a travel company sells a trip from. **One route, shown three ways at once: the plan (a map), the section (the height of the whole trip) and the schedule (the days). They stay on the same day as the reader scrolls, so a buyer can judge how hard each day is before they judge the scenery.**

- **The hero.** A kicker (kind of trip, days and nights, one more fact), a headline with one `_turn_`, a lede, and four figures the build works out: total distance, total climb (or the highest point, for a driving tour), the range of effort ("Gentle to Hard"), and the lowest price of any departure with the group size.
- **The chart panel** sits beside the days on a desktop and stays in view. The **map** is drawn from your route and map files: land and sea (or open ground), the coastline, rivers or dry washes, lakes, contours if your file has them, the route one line per day, the overnight stops with their names placed clear of the line (a name that cannot sit beside its stop is set further out on a leader line), a scale bar with a round length and a north arrow. The **height strip** under it is the whole trip at one vertical scale, one band per day, numbered; tap a band to go to that day.
- **The days.** "Day 03 of 07", the effort as five cells and a word, "Ostrel *to* Vennick Cove", why it has that grade ("Steady: 14.9 km and 317 m of climb on a good path"), two or three lines of copy, the distance, climb, descent and walking time (or driving distance, climb, highest point and time at the wheel), the day's height profile at the same scale as the strip, then where you sleep, the meals (filled dot included, open dot not, with a line on what to do instead), what is optional with its price, and one boxed note.
- **As you scroll**, the day whose top passes the reading line becomes the day: its route turns to the accent with a paper casing, earlier days go to ink, later days to a dotted line, the map eases to that day's ground in 0.7 s, its band fills on the strip and an accent rule draws down the left of its entry. Back above the first day, the map shows the whole route again.
- **After the days.** What the price includes and does not (with "6 breakfasts, 7 lunches, 4 dinners" counted from the days and the nights counted from where you sleep), a table of departures (dates, a row of seat cells at the group size, "3 of 12 places left" or "Full", the price, "Hold a place" or "Join the waiting list") with "Places as of 3 November 2026" under it, and the price set large with what it covers, the terms and the button.

**The two styles** (`"style"`): `paper` (warm paper, Newsreader with italic turns, Public Sans, IBM Plex Mono, an engraved hatched sea, a rust route) and `night` (near black, Archivo set narrow in capitals, JetBrains Mono map labels, contours in dark bronze, a lamp-amber route). The accent can be changed (`"accent"`).

**What the build will not let a page say.** Distance, climb, descent, high points, walking times, totals, effort grades, meal counts and the "from" price are measured or counted; a distance you state for a day that differs from the measured track by more than 5% stops the build, and so does an `effort` you type. A "covers" line that claims every meal when a day lacks one is refused. Departures need the date the places were counted, and the page has no countdowns, no "only N left" and no red.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- The route: one line per day with elevation on every point, as GeoJSON or as GPX files (one per day; `scripts/measure.mjs` turns them into GeoJSON). Draw it in any route planner that exports GPX with elevation.
- A map file, or the bundled coastline: see step 3.
- Internet access when the page is opened, for the Google Fonts of the style. Without them system fonts stand in; the map and figures do not change.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Steps

### 1. Collect the trip

From the person, or from their current trip page:

- **The company** (name up to 28 characters, an optional mark: `wave`, `mesa`, `peak` or `none`), up to four links for the bar and the booking button's label and address.
- **The trip**: the kicker (1 to 3 short items), a headline (up to 60 characters, one `_turn_`), a lede (60 to 280), whether the days are on foot (`"mode": "walk"`) or by vehicle (`"drive"`), and the group size.
- **Each day**: where it starts and ends (each day starts where the last one ended), two or three lines of copy, where everyone sleeps, which meals are included, what is optional and what it costs, and at most one note.
- **What is and is not included**, every **departure** (start and end date, places left, price) with the date the places were counted, and the **price** with what it covers.

Every price, place count and claim must come from the person. If they have no departures yet, ask; never invent dates or places.

### 2. Get the route and measure it

Put the route next to trip.json. From GPX files, one per day in order:

```
node <skill>/scripts/measure.mjs --gpx day1.gpx day2.gpx day3.gpx --out route.geojson
```

Then measure it the way the build will:

```
node <skill>/scripts/measure.mjs route.geojson
```

It prints each day's distance, climb, descent, low and high point, walking time and effort on a good path. Write each day's distance into trip.json as `km`; the build compares the two.

The route file is a GeoJSON FeatureCollection with one `LineString` per day, `properties.day` 1, 2, 3 and so on, and every coordinate as `[longitude, latitude, metres]`.

### 3. Choose the map

- **Your own map file** (`"geo": "geo.geojson"`): a FeatureCollection whose features each have `properties.kind`: `land` (Polygon, filled), `coast` (LineString, drawn as the coastline; without any, the outline of the land is drawn), `river` (LineString), `wash` (LineString, dashed, for dry channels), `lake` (Polygon; `"dry": true` dashes its shore) and `contour` (LineString with `ele` in metres; every 100 m is drawn heavier). Simplified data is best: a few hundred kilobytes at most. Free public data (national survey open data, OpenStreetMap extracts under its licence) or a drawing of your own both work.
- **The bundled coastline** (`"geo": "natural-earth"`): land and coastline from Natural Earth at 1:50m, public domain, cropped to your route. No rivers or contours; good for sea crossings and long coasts, too coarse for a walk along one cliff.

The build crops the map to what the page can show and simplifies every line, and the check fails a page over 400 KB.

### 4. Write trip.json

Copy the example closest in spirit and replace every value:

- `examples/hollin-walking/trip.json`: Hollin Walking, seven days on an invented coast, `paper`, on foot.
- `examples/drywash-expeditions/trip.json`: Drywash Expeditions, a six day photography tour in an invented high desert, `night`, by vehicle with walks.

Every field, its range and default:

| Field | What it is | Range, default |
| --- | --- | --- |
| `style` | `paper` (light) or `night` (dark) | default `paper` |
| `accent` | the accent colour, `#rrggbb`; it is used for text too, so the check tests its contrast | default per style |
| `dates` | how dates read: `dmy` (18 to 24 April 2027) or `mdy` (April 18 to 24, 2027) | default `dmy` |
| `brand.name` | the company | 1 to 28 characters |
| `brand.mark` | a small line mark beside the name | `wave`, `mesa`, `peak`, `none`; default `none` |
| `brand.links` | links in the bar (`label`, `href`) | 0 to 4; labels up to 14 characters |
| `brand.cta` | the booking button (`label`, `href`) | label up to 18 characters |
| `trip.kicker` | short items above the headline | 1 to 3, each up to 28 characters; the third is hidden on phones |
| `trip.title` | the headline; one `_turn_` in italics or the accent | up to 60 characters |
| `trip.lede` | the paragraph under it | 60 to 280 characters |
| `trip.mode` | `walk` (days measured on foot) or `drive` (days by vehicle) | required |
| `trip.group` | the most people on one departure | 1 to 40; equals `departures.capacity` |
| `map.route` | the route file | required |
| `map.geo` | your map file, or `natural-earth` | required |
| `days[]` | the days, in order | 2 to 14 |
| `days[].from`, `.to` | where the day starts and ends | up to 24 characters each; `from` equals the day before's `to` |
| `days[].text` | the day's copy | 40 to 260 characters |
| `days[].km` | the distance you state; the build measures the track and stops if they differ by more than 5% | 0.1 to 1,500 |
| `days[].terrain` | the ground on foot: `path`, `rough`, `exposed`, `scramble` | default `path` |
| `days[].drive` | time at the wheel (drive only) | up to 16 characters, like `1 h 30` |
| `days[].onFoot` | walking on a driving day: `km`, `up` (metres of climb), `terrain` | km 0 to 60, up 0 to 3,000; optional |
| `days[].sleep` | `name` and `detail`, or `none: true` and `detail` for a day with no night | name up to 40, detail up to 60 |
| `days[].meals` | `breakfast`, `lunch`, `dinner`, each true or false | required |
| `days[].mealNote` | what to do about a meal that is not included | up to 70 characters, optional |
| `days[].optional` | extras: `label` and `price` (`+£18`, `£6`, `free`) | 0 to 3; label up to 60 |
| `days[].note` | one boxed note: `label` and `text` | label up to 12, text up to 120, optional |
| `included`, `notIncluded` | lines for the two lists (the nights and the meal count are added for you) | 1 to 6 each, up to 80 characters |
| `departures.asOf` | the date the places were counted, printed under the table | `YYYY-MM-DD` |
| `departures.capacity` | places on each departure | 1 to 40 |
| `departures.list[]` | `start`, `end` (as many days apart as the itinerary), `left`, `price` | 1 to 8; left 0 to capacity |
| `price.currency`, `.amount`, `.per` | the headline price (the price of one of the departures) and who it is for | `£`, `$` or `€`; per up to 60 |
| `price.covers` | what the price covers | 2 to 6, up to 50 characters |
| `price.terms` | `label` and `text`: single room, deposit, balance | 0 to 3 |

**Effort** is never typed. It is worked out from each day's distance and climb on foot: every 100 m of climb counts as 1 km, then the total is multiplied by 1.15 on rough ground, 1.25 on an exposed path and 1.4 with scrambling. Under 8 is Easy, 8 to 14 Gentle, 14 to 20 Steady, 20 to 26 Hard, 26 and over Very hard. A day that feels harder than its numbers says why through `terrain`, and the card prints the reason. Walking times use Naismith's rule (5 km an hour plus an hour for every 600 m of climb), without stops.

### 5. Build

```
node <skill>/scripts/build.mjs trip.json out
```

It lists every problem at once (a missing field, text too long, a stated distance the track does not support, days that do not join up, a typed effort, a covers line that over-claims, a departure whose length does not match the itinerary) and writes nothing until they are fixed. Then it writes `out/index.html` (the page with the bar) and `out/embed.html` (the itinerary alone, with the font link, to paste into a page you have), and prints each day's measured figures and grade.

### 6. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390, 768, 1024 and 1440 px wide and with reduced motion at 390 and 1440 and fails on: script errors, sideways scrolling, a page over 400 KB, text under 16 px on a phone or 14 px elsewhere (12 px labels), text under AA contrast (map labels too), text cut off or near a phone's edge; any day's slice of the height strip that is not that day's profile at the one shared scale, a drawn route that does not measure its card's distance within 2%, an effort grade the rule does not give, totals or meal counts that do not add up, seat cells that do not match the places left, a missing "Places as of" date or urgency wording; a day that does not become the day on the map, strip, ledger and panel head when scrolled to or tapped on the strip, a map that does not show all of the day's route, map names that overlap or sit on the route; a panel that does not stick, or on a phone takes more than 45% of the screen; keyboard focus that can't be seen; reduced motion that still animates. Fix and build again until it prints `all checks passed`.

### 7. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints, scroll slowly through the days, and tap a band on the height strip.

### 8. Record the video (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920×1080, 30 fps, about 20 seconds: a rest on the whole route beside the headline, then each of the first four days with the map moving to it, then the dates and the price) and `out/poster.png`. `--still 10.4 --png day3.png` saves one moment; add `--size 390x844 --scale 2` for a phone.

### Capturing stills

A still taken while the map is easing between days shows two days half-lit. Ask the page when it is at rest:

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --moments --size 390x844
```

It prints the stretches where the scroll rests and the map has stopped: `["day-3", 9.47, 11.05]` means any `--still` between 9.47 and 11.05 shows day 3 settled. Take stills a little past the middle of a stretch. For the two examples as shipped at 1920×1080: top 0.05 to 2.35, day 1 3.7 to 5.25, day 2 6.6 to 8.15, day 3 9.5 to 11.05, day 4 12.42 to 13.95, dates 15.3 to 16.85, price 17.95 to 20.05. If you change the copy or the days, run `--moments` again: the times move.

### 9. Hand it over

Use `out/index.html` as the page, or paste `out/embed.html` into an existing page (it brings its own styles and script; the panel then sticks 16 px from the top). Tell the person which figures are measured, that effort follows the stated rule, and that places left are only as current as `departures.asOf`: update and rebuild whenever the count changes.

## How it behaves

- **Phones and narrow tablets (860 px and under)**: the bar keeps the name and the button; the hero figures go two by two; the chart panel becomes a sticky strip at the top of the screen (the map 178 px high, the height strip 56 px, under 45% of the screen) with the days scrolling under it; on the whole-route view the stops are numbered so their names do not collide; departures become stacked rows.
- **Reduced motion**: the map jumps to each day instead of easing, and the rules on the days appear without drawing. Everything else is the same.
- **Screen readers**: the panel head announces the day; each band is a button named for its day; meals say "included" or "not included"; the map and profiles have text alternatives.
- **No JavaScript**: the map shows the whole route without names, and every day, figure and departure is in the page.

## Files

- `SKILL.md`: these instructions.
- `scripts/build.mjs`: builds trip.json into `out/index.html` and `out/embed.html`.
- `scripts/check.mjs`: checks a built page at four widths and with reduced motion.
- `scripts/record.mjs`: records the tour video, single stills and the settled moments.
- `scripts/serve.mjs`: serves a built page to look at.
- `scripts/measure.mjs`: measures a route and turns GPX files into the route GeoJSON.
- `scripts/kit/schema.mjs`: every trip.json field and limit, the effort rule and Naismith's rule.
- `scripts/kit/geo.mjs`: distance, climb, the projection, line simplification, cropping and the Natural Earth decoder.
- `scripts/kit/build.mjs`, `scripts/kit/check.mjs`, `scripts/kit/record.mjs`: the work behind the entry points.
- `kit/itinerary.css`: the layout and both styles. `kit/runtime.js`: the map camera, labels, strip and the recorded tour.
- `kit/geo/natural-earth-50m.json`: the bundled land and coastline (Natural Earth, public domain, via world-atlas).
- `examples/hollin-walking/`, `examples/drywash-expeditions/`: the two examples, each with trip.json, route.geojson and geo.geojson.

## Troubleshooting

- **The build says a day's km differs from the track**: the track may include a detour or miss a section, or the figure is from an old brochure. Run `scripts/measure.mjs` and fix whichever is wrong; never stretch the figure to fit.
- **A day is graded harder or easier than it feels**: set `terrain` (`rough`, `exposed`, `scramble`) for the ground; the grade and its printed reason follow. Typing `effort` is refused so grades stay comparable across days.
- **The build says days do not join up**: each day's track must start within 0.5 km of where the last one ended, and `from` must match the day before's `to`.
- **The check says the page is over 400 KB**: your map file has too much detail. Drop contour levels (every 50 m instead of 10 m) or simplify it before building.
- **The map shows no sea**: your map file has no `land` features, so everything is open ground. Add land polygons, or use `"geo": "natural-earth"` near a coast.
- **A stop name is missing on a day's map**: names of stops other than the day's two ends are left off when they cannot be placed clear of the line; the ends are always named.
- **A still shows two days half-lit**: it was taken while the map was moving; use `--moments`.
