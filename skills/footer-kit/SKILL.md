---
name: footer-kit
description: Build the end of a landing page from one footer.json - a closing call to action and a footer as one composed finale. The page above is a sheet lying on a coloured board, and when the reader reaches the end the sheet lifts off the board, its cut edge and soft shadow crossing the brand's name, which is set across the full measure (fitted to the letters' real ink, kerning kept) and rises through the opening gap. Four layouts from the same config - wordmark (closing call, link columns, showrooms), index (every link set like a book's index with leader dots), dispatch (a newsletter-led footer with recent issues and designed form states) and place (a drawn street map with a route to the door and live opening hours). On phones the name stacks onto two lines at a syllable so it stays the hero of the last screen. Reduced motion gets the finished footer, sheet already off. Builds a self-contained page and a paste-in embed, with checks at four widths (text size, measured contrast, overflow, safe area, the name's ink fit, focus rings, form states) and a frame-by-frame recorder for the preview video.
license: MIT
---

# Footer Kit

The end of a landing page done properly: the closing call and the footer as one finale. The governing idea is physical. **The page is a sheet lying on a coloured board. When you reach the end, the sheet slides off and the brand's name is under it, printed edge to edge on the board.** The closing call and the links are the last lines on the sheet. The legal row and the name sit on the board. Nothing animates in by itself: the sheet moves and uncovers what was already there.

- **The lift.** As the reader scrolls onto the board, the sheet's cut edge (a lit lip and the stock's thickness, which shows more as it lifts) passes over the board. A soft cast shadow follows it, growing from a tight contact line to a wide penumbra as the sheet lifts, and multiplied onto the board so the name darkens where it passes. The sheet's last inches shade slightly as they bow up and turn from the light. The name rises through the gap: its tops are cut by the sheet's edge and its feet by the page's edge until both cuts clear. It all runs on the scroll, so scrolling back up plays it backwards. When the board is fully uncovered, the shadow fades in 320 ms and the footer is at rest.
- **The name, set to the measure.** It is measured on a canvas in the page's own display face, with kerning on. Its inked width, not its advance, is scaled to the content width, so the letters' edges sit exactly on the grid with no sidebearings showing. The box is cropped to the ink, so the name sits on the floor with no dead leading. The check finds the inked pixels in a screenshot and fails if they miss any edge by more than 2 px.
- **Two lines on phones.** When the name on one line would be under 120 px tall (`reveal.stackBelow`) and you give it a break (`"Fer|row"`), it is set on two lines at the same size. The first line is flush left, the second flush right, and the two ink boxes are stacked with one even gap. On a 390 px phone Ferrow becomes two lines 153 px tall, and Ostrel two lines 172 px tall.

**The four layouts** (`"layout"`):

1. **wordmark**: the closing call (an eyebrow with a rule, a display headline with one `_turn_`, a sentence, one or two buttons), a hairline, then up to 4 link columns, an optional Visit column (up to 3 showrooms with hours), and socials and back to top on the right.
2. **index**: the closing call, then every link from every column, alphabetised and grouped under a display initial (digits under `#`) with leader dots running to a mono reference: the link's `note` (`"12 pieces"`) or its column's title. The leader dots run out as the index arrives. A bar closes it with socials, the first showroom and back to top.
3. **dispatch**: led by the newsletter. A headline, an email field drawn as one ruled line with the action in the emphasis colour, a fine-print line, and up to 4 recent issues listed as proof. The form has designed states: empty, typing (the rule thickens to 2 px), error (the rule and message turn to the error colour, `aria-invalid`, focus stays in the field), sending, and sent (the field is replaced by your sent line, which takes focus). Link columns sit underneath.
4. **place**: for a restaurant, shop or studio. A headline, the address and phone, Book and Directions buttons, and a street map drawn from the config. The map is figure-ground: blocks are the ground and the streets are cut out of them. It shows water and green space, and a route in the accent colour that draws from the named stop to the pin as the map arrives. Labels are set in mono at 12 px or more. Next to it, an hours table marks today and works out the status live in the business's time zone (*Open now*, *Closes at 23:00* in the last hour, *Closed · opens Tue 17:00*). Link columns and a Getting here column (tram, bus, bikes) sit underneath.

Every layout shares the floor (the legal line, up to 5 legal links, and the name) and the rest of the system: hairlines, a mono label voice, link underlines that draw from the left in 300 ms, socials written as words with an ↗ (no brand icons), and a back-to-top button whose ring fills with how much of the page has been read. Back to top scrolls home (it jumps instead under reduced motion) and moves keyboard focus to the top of the page.

**Reduced motion** gets the finished state. The board is not under the sheet (it sits in the page after it), there is no shadow, nothing rises, and the route and leader dots are already drawn. **Without JavaScript**, the footer renders complete in normal flow without the lift.

**What you can change, honestly.** Every word and link, the layout, all seven theme colours (with contrast enforced at build time and measured again in the check), the display face (Gloock, Instrument Serif or Bricolage Grotesque), square or pill buttons, how far the name rises, and where it stacks. The spacing, the type scale and the motion are the design and stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in, and the name is still fitted to whatever face is used.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/footer.css`: the whole design, scoped to `.fk`. Layouts, phone and tablet rules, the lift, and the reduced-motion finished state.
- `kit/runtime.js`: the browser runtime, inlined into every build. The name's ink fit and stacking, the lift, live hours, form states, back to top, and the recording clock.
- `scripts/build.mjs`: footer.json to `out/index.html` (a page that ends with the footer) and `out/footer-embed.html` (the footer to paste in).
- `scripts/kit/schema.mjs`: every field, its limits and the colour contrast rules; lists every problem at once.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, and with reduced motion at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills, form-state stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/ferrow/footer.json` (wordmark), `examples/ferrow/footer.index.json` and `examples/ferrow/footer.dispatch.json` (the same brand in the other two layouts), `examples/ostrel/footer.json` (place).

## Steps

### 1. Collect the content

From the person, or from their current site:

- **The name** as it should be set (up to 12 characters), and where it may break onto two lines on a phone: at a syllable (`Fer|row`, `Os|trel`) or between words. Ask; don't guess at a break that reads badly.
- **The legal line** a real company prints: the company name, its registration number or address. Plus its privacy and terms pages.
- **The closing call**: an eyebrow (a fact: "Showrooms in Bristol and Ghent"), a headline of up to 48 characters with one `_turn_`, an optional sentence, and the main action and its link.
- **The links** they actually have, grouped into up to 4 columns of 2 to 7 links.
- For **place**: the address, phone, time zone, opening hours for every day, the nearest stop, and a rough sketch of the streets around the door (see step 2). For **dispatch**: the sign-up form's address, the fine print, the sent line, and the last few issues with their real titles.

Use their real addresses, hours, issue titles and numbers. If they have none, leave that part out rather than inventing it.

### 2. Write footer.json

Copy the example closest in spirit and replace every value:

- `examples/ferrow/footer.json`: Ferrow, outdoor furniture, `wordmark` layout, Gloock on warm paper over a garden-green board.
- `examples/ostrel/footer.json`: Ostrel, a wood-fire restaurant, `place` layout, Bricolage Grotesque on charcoal over an ember board.
- `examples/ferrow/footer.index.json` and `footer.dispatch.json`: the other two layouts.

**Drawing the map** (place only): the map is a 100 × 100 square, with x from the left and y from the top. Each street is a line of 2 to 12 points with a `width` from 1 to 8 (7 for a main road, 3 for a side street). Name up to two or three streets near the door, with `labelAt` (where the label's baseline starts) and `labelAngle` (degrees, to follow the street). `water` and `park` are optional outlines. `route` runs along the streets from the stop (its first point) to the door (`pin`, its last point). Trace it from a real map of the area by eye. It is a diagram, not a survey, and the Directions button links to the real map.

### 3. Build

```
node <skill>/scripts/build.mjs footer.json out
```

It lists every problem at once (a missing field, a line too long for its place, a colour pair under its contrast minimum, a board too close to the sheet to read as a different stock, a break that doesn't match the name, hours that close before they open, a map point outside the square) and writes nothing until they're fixed. Shorten words rather than asking for smaller type. If the name has 5 letters or more and no break, it prints a note suggesting one.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440. It scrolls the whole page, rests at the end, and fails on:

- script errors and links without an address
- sideways scrolling
- text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
- text under WCAG AA contrast against the colour actually behind it, on the sheet and on the board
- text cut off or off the screen, or the floor not clearing the bottom of the screen
- the name's ink not touching all four edges of its box within 2 px
- a name on one line under the stacking height when it has a break
- the board not lying under the sheet, no shadow or rise half way, or the footer not at rest at the end
- back to top not reaching the top
- the form not showing its error and sent states
- hours without a status or without today marked
- map labels under 12 px
- a keyboard focus that can't be seen (it presses Tab through the page)
- under reduced motion, anything that isn't the finished state

Each line it prints shows how many text and background pairs it measured, the lowest contrast as a multiple of the minimum, and the name's line count, height and ink edges. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints and scroll to the end on a laptop and a phone. Check that the name breaks where you meant it to.

### 6. Put it on the site

Paste `out/footer-embed.html` as the **last thing inside `<body>`**, after all of the page's content. It brings its own fonts, styles and script, and every class starts with `fk-`. The lift needs nothing from your page, except that the footer must not sit inside an element with `overflow: hidden` or `overflow: auto`. If it does, the board can't stick under the sheet, and the footer simply shows finished. Back to top moves focus to the first `h1`; to land somewhere else, give that element an `id` and set `"topTarget"` (top level of footer.json) to it.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --seconds 12 --poster 5
node <skill>/scripts/record.mjs out/index.html --still 7 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --still 7 --form error:"ana@" --clip .fk-lead-in --png error.png
node <skill>/scripts/record.mjs out/index.html --moments
```

The video follows a fixed 12-second scroll script: from the end of the page above, down onto the board (seconds 1 to 6), holding finished (6 to 7.6), back up three quarters of the board to show that the lift is reversible, then down again. `--moments` prints `{ mid, end }`: the second at which the first descent has uncovered half the board (the best poster), and a second inside the finished hold.

## footer.json, every field

Top level:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `wordmark`, `index`, `dispatch`, `place` | required | |
| `lang` | language tag | `en` | the built page's `lang` |
| `topTarget` | an element id | first `h1` | where back to top moves focus |

`theme`, all colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `sheet` | | the page's paper; the demo page and the footer's upper part |
| `ink` | 7:1 on `sheet` | text; muted text is derived at 5:1 |
| `board` | 1.5:1 or more from `sheet` | the stock under the page |
| `boardInk` | 4.5:1 on `board` | the name and legal text; the legal mute is derived at 5:1 |
| `accent` | 3:1 on `sheet` | primary button fill, map route and pin |
| `onAccent` | 4.5:1 on `accent` | button text |
| `turn` | 4.5:1 on `sheet` | the headline's turn, eyebrow rule, issue numbers, hours status, the back-to-top ring |
| `mark` | optional | colour of `brand.mark`; default `boardInk` |
| `error` | optional | form error colour; default #a3271a on light sheets, #ff9a7e on dark |
| `display` | `gloock`, `instrument`, `bricolage` | Gloock (high-contrast serif, turn by colour), Instrument Serif (turn in real italic), Bricolage Grotesque 800 (turn by colour) |
| `buttons` | `square`, `pill` | default `square` |

`brand`:

| Field | Range | Notes |
| --- | --- | --- |
| `name` | 1 to 12 characters | set across the measure |
| `break` | the name with one `|` | optional; where it may stack on two lines |
| `mark` | 1 character | optional, e.g. `.` or `®`, after the name in `theme.mark` |
| `legal` | up to 90 characters | after `© year` |
| `year` | 1900 to 2100 | |

`cta` (wordmark, index and place layouts): `eyebrow` (up to 44 characters), `headline` (up to 48 characters; `_turn_`, and `\n` for a line break), `lede` (optional, up to 140 characters), `primary` `{ label (up to 24), href }`, `secondary` (optional, same; not used by place, which uses `place.directions`).

`columns`: 1 to 4, each `{ title (up to 18), links: [2 to 7 × { label (up to 26), href, note? (up to 10) }] }`. Wordmark takes 4 columns, or 3 plus `visit`. Place takes up to 3.

`socials`: 0 to 5 × `{ label (up to 14), href }`. `legalLinks`: 1 to 5 × `{ label (up to 18), href }`. `backToTop`: `{ label }`, up to 18 characters, default "Back to top".

`visit` (wordmark and index): 1 to 3 × `{ city (up to 20), address (up to 34), hours? (up to 26) }`.

`dispatch` (dispatch layout): `eyebrow` (44), `headline` (48), `fine` (90), `placeholder` (32, default "you@example.com"), `button` (14, default "Subscribe"), `sent` (70), `action` (your sign-up form's `https://` address, or `#` to send nothing), `issuesTitle` (default "Recent letters"), `issues` 0 to 4 × `{ no (8), title (40), date? (8), href }`. Optional messages: `error`, `sending`, `failed`.

`place` (place layout):

| Field | Range | Notes |
| --- | --- | --- |
| `address` | up to 90 characters, `\n` for lines | |
| `phone` | up to 20 characters | becomes a `tel:` link |
| `timezone` | an IANA zone, e.g. `Europe/London` | the status is worked out in this zone |
| `hours` | `mon` … `sun`: `"closed"` or `"HH:MM-HH:MM"` | 24-hour; `24:00` for midnight |
| `now` | a date and time | previews only: freezes the status (the example uses Friday 19:30) |
| `directions` | `{ label (24), href }` | the real map |
| `map.streets` | 2 to 14 × `{ points: [[x, y] × 2 to 12], width 1 to 8 (default 3), name? (18), labelAt? [x, y], labelAngle? }` | coordinates 0 to 100 |
| `map.water`, `map.park` | optional `{ shape: [[x, y] × 3 to 16], name?, labelAt? }` | |
| `map.route` | 2 to 12 points | first is the stop, last is the door |
| `map.pin` | [x, y] | the door |
| `map.from` | up to 22 characters | the stop's name |
| `gettingHere` | 0 to 4 × `{ mode (10), text (34) }` | |
| `text` | `{ open, closesAt, closed, closedAll, closedDay }` | `{t}` and `{d}` are filled in; defaults in English |
| `dayNames` | 7 short names, Monday first | default Mon … Sun |
| `hoursTitle`, `gettingHereTitle`, `mapLabel` | optional | headings and the map's accessible description |

`reveal`:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `lift` | true / false | true | false: the footer sits in the page after it, finished |
| `rise` | 0 to 0.35 | 0.22 | how far below its place the floor starts, as a share of its height |
| `stackBelow` | 0 to 200 (px) | 120 | stack the name on two lines when one line would be shorter than this; 0 never stacks |

`demo` (only for the built preview page): `title` (70) and `above` 1 to 3 × `{ label (36), heading (130), text? (240) }`, the stand-in page above the footer.

## Troubleshooting

- **The footer just sits there; no lift.** The page is in reduced motion (correct: that's the finished state), JavaScript is off, `reveal.lift` is false, or the footer is inside an element with `overflow` other than `visible`. A footer whose upper part is shorter than its board also shows finished, because the board can't hide under it. Add a line to the closing call or a column.
- **The name doesn't reach the edges.** The display font didn't load (offline, or blocked fonts). The fit is measured on whatever face is used, so it re-fits when the font arrives. If it stays off, the check reports the ink edges in pixels.
- **The name stacks badly on phones.** Move the `|` in `brand.break`, or set `reveal.stackBelow` to 0 to keep one line.
- **Build says the board is too close to the sheet.** The reveal needs a different stock. Pick a board colour at 1.5:1 or more from the sheet: darker for a light page, brighter for a dark one.
- **The hours status is wrong.** Check `place.timezone`, and remove `place.now`, which freezes the clock for previews.
- **The form says sent but nothing arrived.** `dispatch.action` must be your form provider's endpoint that accepts a plain POST with an `email` field. The kit posts in `no-cors` mode, so it can't read the provider's reply. Test with a real address.
- **Check fails on contrast after changing colours.** It prints the measured pair. Darken the ink or the turn rather than lightening the paper.
