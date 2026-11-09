---
name: closing-cta-kit
description: Build the last call to action before the footer from one cta.json - a band that asks for the click once and puts the real reason to act in plain sight. Three layouts from the same config - stub (an admission ticket whose stub carries the fact, with punched perforation, seat dots, and a rubber stamp placed where it covers no text), poster (the fact set as the poster's figure, fitted to its column, with a price window that shows today between the day a price opened and the day it ends) and sentence (the form is the headline - "Hold 2 places on Sat 5 Dec for your email." - with empty, typing, error, sending and sent states). The fact is validated, day counts are worked out from real dates, and after the deadline the band switches to its own after-close copy instead of a stale date. One entrance when the band comes into view, then it holds still; reduced motion gets the settled band. Builds a self-contained page and a paste-in embed, with checks at four widths (text size, measured contrast including the labels on the stub, overflow, the stamp covering nothing, the form's states and fields, the entrance settling once, the after-close switch) and a frame-by-frame recorder for the preview video.
license: MIT
---

# Closing CTA Kit

The band above the footer, the moment a page asks for the click. The governing idea: **ask once, and put the reason in plain sight.** The band is a printed object built around one hard fact (the places left, the day booking closes, a price held, or a measured result), and the click is what that object exists for. The giant type is always the fact, never the slogan.

**The three layouts** (`"layout"`):

1. **stub**: an admission ticket the width of the content, on a band one step darker than the page. The main face has a mono top row (what it admits, a serial), the headline with one turn in the accent, the lede, the primary button with the price after a divider, a text-link secondary, and up to 4 printed fields (dates, time, where, group). Perforation at 69 % of the width: punched holes, and two notches cut out of the edges so the band shows through. The stub, in the accent, carries the fact as a 330 px numeral, a row of seat dots (the places left are solid, the booked ones are struck through, with a legend: "4 left · 6 booked"), the live day count ("23 days left to book") and when booking closes. A rubber stamp (the top arc reads round the outside, the bottom arc left to right inside, both the right way up; ink texture, uneven pressure) is placed by the page wherever it covers no text at that width, preferring the paper just left of the perforation. On a phone the ticket turns upright and the stub comes first, so the fact is on the first screen.
2. **poster**: a typographic poster on the page's own ground. Header row, eyebrow, the headline across the measure, then the figure (for example €49) fitted to its column by measuring it, with "Was €89 · you keep €40" under it, beside the lede, actions and one line of proof (a score, a count and a short quote with a name). Along the bottom, the price window: a ruled timeline from the day the price opened to the day it ends, a tick per day, the time gone in grey, the time left in the accent, and a TODAY marker ("Today · 53 days left at €49").
3. **sentence**: the headline is the form. "Hold [2] places on [Sat 5 Dec] for [your email]." Each blank is a real select or email field set in the display face, underlined just under its baseline from where its text starts, with a visible caption under it and a label for screen readers. The email field has `type="email"`, `inputmode="email"` and `autocomplete="email"`. The button restates the sentence and the total ("Hold 2 places → €680"). States: empty, typing, error (the field and its rule turn to the error colour, `aria-invalid`, a plain message, focus stays in the field), sending (three stepping dots), sent (the sentence rewrites itself in the past tense and takes focus, with a small hold slip under it).

**After the deadline**, the page shows `afterClose` instead: a waitlist and the next date for a course, the regular price for an offer. Without JavaScript, the open version shows.

**Motion.** One entrance, run once when the band is about a third in view, then it holds still and the page marks itself `data-settled`. Stub: the ticket rises 16 px (520 ms), the holes punch top to bottom 8 ms apart, the numeral rises out of its slot (560 ms), the seat dots fill 40 ms apart, and the stamp lands at 1000 ms (160 ms, no bounce). Poster: the headline and copy rise 24 px (600 ms), the figure's digits rise 70 ms apart (700 ms each), the window draws left to right (900 ms), then the TODAY marker drops in. Sentence: the rules draw under the blanks 90 ms apart. Settled after 1300, 1750 and 760 ms. **Reduced motion** gets the settled band from the start.

**What you can change, honestly.** Every word, link and number, the fact and its deadline, the layout, the five theme colours (contrast enforced at build time and measured again in the check), the display face (Big Shoulders Display, Archivo, Newsreader) and square or pill buttons. The spacing, the type scale and the motion are the design and stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/cta.css`: the whole design, scoped to `.cc`. The three layouts, the tablet and phone rules, the stamp and the reduced-motion rule.
- `kit/runtime.js`: the browser runtime, inlined into every build. Today and the deadline, the after-close switch, day counts, the perforation, the stamp's placement, the figure's fit, the sentence form's states, the entrance, and the recording clock.
- `scripts/build.mjs`: cta.json to `out/index.html` (a short demo page that ends with the band and a footer) and `out/cta-embed.html` (the band to paste in).
- `scripts/kit/schema.mjs`: every field, its limits and the colour contrast rules; lists every problem at once.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, and once the day after the deadline.
- `scripts/record.mjs`: the preview video, stills, form-state stills, after-close stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/morrow/cta.json` (stub), `examples/morrow/cta.sentence.json` (the same course as a sentence), `examples/fernhall/cta.json` (poster).

## Steps

### 1. Collect the content

From the person, or from their current page:

- **The ask**: one primary action and its link, and the price if there is one. Optionally one secondary link.
- **The fact**, which must be true: how many places are left out of how many, the date and time something closes and its time zone, the price now and before, or a score and how many reviews it comes from. Ask; never invent a count or a deadline to create urgency.
- **What happens after the deadline**: the next date, the regular price, a waitlist. The band switches to this by itself.
- A headline of up to 52 characters with one turn, a lede of up to 180, an eyebrow.
- For **stub**: up to 4 printed fields and the stamp's words. For **poster**: the day the price opened, one line of proof with a real name. For **sentence**: where the form posts, the choices, and the sent line.

### 2. Write cta.json

Copy the example closest in spirit and replace every value:

- `examples/morrow/cta.json`: Morrow Clay Studio, a weekend pottery course, `stub`, Big Shoulders Display on plaster and cobalt. Fact: 4 of 10 places left, booking closes Tue 1 Dec 18:00 London.
- `examples/fernhall/cta.json`: Fernhall Audio, a tape-delay plug-in, `poster`, Archivo on near-black and amber. Fact: launch price €49, was €89, until 1 Jan Berlin.
- `examples/morrow/cta.sentence.json`: the Morrow course as a `sentence`.

Set `preview.now` to the day you want the stills and recordings to show. The live page always uses the visitor's real date.

### 3. Build

```
node <skill>/scripts/build.mjs cta.json out
```

It lists every problem at once (a missing fact, a count above its total, a price that is not below the old one, a window that closes before it opens, a time zone that does not exist, a line too long for its place, a colour pair under its contrast minimum, a missing after-close, an exclamation mark or an em dash) and writes nothing until they're fixed. Shorten words rather than asking for smaller type.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, with today pinned to `preview.now`. It fails on:

- script errors, links without an address, sideways scrolling
- text under 16 px on a phone or 14 px elsewhere (labels: 12 px), form fields under 16 px
- text under WCAG AA contrast against the colour actually behind it; the mono labels on the stub are reported on their own (4.5:1)
- text cut off or off the screen, buttons under 44 px tall on a phone
- the stamp touching any text, field, button, seat dot or the barcode, or hanging off the ticket
- the seat legend not matching the solid dots, a day count not written, the TODAY marker off its track or colliding with a label
- the entrance running before the band is in view, not reporting settled, or running twice; reduced motion that is not settled from the start
- the sentence form: the email field without its type, inputmode, autocomplete or label, a rule that does not start where its text starts, an empty or bad address not marked invalid, focus leaving the field, a good address not reaching sent
- a keyboard focus that can't be seen (it presses Tab through the band)
- and, the day after the deadline, the band not switching to its after-close copy

Each line shows how many text and background pairs it measured, the lowest contrast as a multiple of its minimum, the stub labels' contrast and the stamp's size. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints, scroll to the band on a laptop and a phone. Add `?cc-now=2026-12-02` to the address to see the band after its deadline.

### 6. Put it on the site

Paste `out/cta-embed.html` where the band belongs, normally just above the footer. It brings its own fonts, styles and script, and every class starts with `cc-`. Use one band per page. The sentence form posts its fields (`count`, `option`, `email`) to `sentence.action` with `fetch` and expects a 2xx answer; with `"#"` it only shows the sent state.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --seconds 8 --poster 6
node <skill>/scripts/record.mjs out/index.html --still 6 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --still 6 --form error:"ana@mail" --png error.png
node <skill>/scripts/record.mjs out/index.html --still 6 --now 2027-01-02 --png after.png
node <skill>/scripts/record.mjs out/index.html --moments
```

The video follows a fixed 8-second script: the page above, a scroll onto the band (0.8 to 2.6 s), the entrance, a hold. `--moments` prints `{ enter, settled, end }`; take stills and posters between `settled` and `end`.

## cta.json, every field

Top level:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `layout` | `stub`, `poster`, `sentence` | required | |
| `brand` | 1 to 40 characters | required | poster header, demo page title |
| `lang` | language tag | `en` | the built page's `lang` |
| `eyebrow` | up to 48 | required | |
| `serial` | up to 40 | none | ticket number (stub), product line (poster) |
| `headline` | up to 52, one `_turn_` | required | the turn takes `theme.turn` |
| `lede` | up to 180 | none | |
| `primary` | `{ label (up to 22), href, price? (up to 8) }` | required (not for sentence) | |
| `secondary` | `{ label (up to 30), href }` | none | |
| `fact` | see below | required | the reason to act now |
| `closes` | `{ at "YYYY-MM-DDTHH:MM", tz, label (up to 28), title? (up to 24), countdown? (up to 40, with {days}) }` | none | when the offer ends, in its own time zone |
| `opened` | `YYYY-MM-DD` | none | when a price window opened (poster) |
| `openedLabel` | up to 48 | none | the window's start label |
| `fields` | up to 4 `{ label (up to 12), value (up to 24) }` | none | stub |
| `stamp` | `{ top (up to 18), bottom (up to 22), big (up to 3), small (up to 4) }` | none | stub |
| `proof` | `{ score (up to 5), label (up to 28), quote (up to 120), cite (up to 48) }` | none | poster |
| `sentence` | see below | required for sentence | |
| `afterClose` | see below | required when `closes` is set | |
| `preview` | `{ now: "YYYY-MM-DD" }` | none | today for checks, stills and recordings |
| `demo` | `{ above: up to 6 [question, answer], footer }` | none | the demo page around the band |

`fact` by `kind`:

| kind | Fields | Shown as |
| --- | --- | --- |
| `count` | `value` (0 or more, not above `of`), `of` (1 to 60), `label`, `left`, `taken` | the numeral and "of 10"; up to 24 seat dots and a legend |
| `date` | `label`, `unit?` | the day of `closes.at` and its month |
| `price` | `value`, `was?` (higher), `currency` (up to 3), `label`, `window?` (with `{days}`) | the figure, "Was €89 · you keep €40", the window |
| `proof` | `value` (up to 5), `unit?`, `label` | the figure and its label |

`{days}` counts today and the last day before the deadline, in the deadline's time zone; `{s}` adds a plural s.

`theme`, colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `band` | | the band's ground |
| `card` | stub only; must differ from `band` | the ticket's stock |
| `ink` | 7:1 on `band` (and `card`) | text; muted text is derived at 5.2:1 |
| `accent` | 3:1 on its ground | button, stub, figure, window |
| `onAccent` | 4.5:1 on `accent` | button and stub text; the stub labels are derived at 5:1 |
| `turn` | 3:1 on its ground; optional | the headline's turn; default `accent` |
| `error` | 4.5:1 on `band`; optional | default #a3271a on light bands, #ff9a7e on dark |
| `display` | `shoulders`, `archivo`, `newsreader` | default `shoulders` |
| `buttons` | `square`, `pill` | default `square` |

`sentence`:

| Field | Range | Notes |
| --- | --- | --- |
| `action` | URL or `#` | where the fields are posted |
| `parts` | 3 to 9 pieces | words (up to 24 characters) and blanks, in reading order: `{ "count": { caption, min, max (1 to 12, not above the places left), default } }`, `{ "option": { caption, values (2 to 8), default } }`, exactly one `{ "email": { caption, placeholder } }` |
| `button` | up to 24, may use `{n}` | |
| `price`, `currency` | optional | the price of one; the button shows the total |
| `fine` | up to 140 | what happens next |
| `sent` | up to 120 | `{n}`, `{option}`, `{email}`; `[brackets]` take the accent |
| `holdLabel`, `holdLine`, `holdNote` | optional | the slip under the sent line |
| `errEmpty`, `errBad`, `errSend` | up to 80 | the three error messages |

`afterClose`: `eyebrow?`, `headline`, `lede?`, `primary`, `secondary?`, `fact?` `{ label, value, unit?, note? }`, `fields?`, `foot?` `{ title, label }`, `stamp?`, `window?` (poster, up to 48).

## Troubleshooting

- **The build lists problems and writes nothing.** Fix them all and build again; it reports everything at once.
- **"theme.ink on theme.card is 6.4:1".** Darken the ink or lighten the card. Contrast is measured with the WCAG formula, so eyeballing won't settle it.
- **The check says the stamp covers text.** The page could not find a clear place at that width. Shorten the stamp's words, a field or the lede, or leave `stamp` out.
- **The day count is wrong by one.** It counts in `closes.tz`, including today. Check that `closes.at` is local to that zone.
- **The band shows its after-close copy on your machine.** Your computer's date is past `closes.at`. Open the page with `?cc-now=` and an earlier date to look at the open state.
- **The sentence form says it did not go through.** `sentence.action` answered with an error or blocked the request (CORS). Point it at an endpoint that accepts a form POST from your site.
- **The figure looks small.** It is fitted to its column; fewer digits make it bigger. Long prices are better on `stub`.
- **No video.** Install ffmpeg or set `FFMPEG_PATH`. The checks and stills don't need it.
