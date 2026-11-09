---
name: testimonial-wall
description: "Build a social-proof section for a landing page from one wall.json - the rating with its real star distribution (the build refuses a score the stars don't add up to), a lead letter that turns over 2 to 6 featured quotes, each signed and carrying the measured result that person got, a wall of reviews in drifting columns, case cards with before/after figures, and a strip of press quotes. Set like a newspaper's letters page, with motion paced by reading time - the wall never moves faster than 24 px a second, hover, focus and a Pause button stop it, and reduced motion shows everything still. Two themes (letters and ledger), phone and tablet layouts, a self-contained page and a paste-in embed, checks at four widths, and a frame-by-frame recorder for a 1080p preview video. Use for customer reviews, testimonials, case studies or press mentions on a product, service or SaaS page."
license: MIT
---

# Testimonial Wall

One section, built from one `wall.json`, that carries every kind of social proof a page needs, in this order unless you change it:

1. **The head**: the brand and a kicker on an ink rule, a headline with one turned phrase, the **rating** set large with its count and source, and a **histogram of the real star distribution** (5 to 1 stars, in percent). A wall of perfect scores reads as fake; showing the 1 % is what makes the 4.8 believable. The build refuses a distribution that doesn't add up to 100 or a score the distribution doesn't average to.
2. **The spread**: the **lead letter** and the **wall**.
   - The lead letter shows one featured quote at a time, set big, signed (monogram or photo, name, role, place) and with the **measured result** that person got set huge in the accent ("40 / washes in, and no pilling at the hem"). Tabs 01 to 06 switch it; it turns over by itself, each quote staying up for its **reading time** (1.2 s plus 230 words a minute, 5 to 14 s), shown in its corner ("Read time 8 s") and as a progress line on its tab. Lines leave upward through masks and the next quote's lines rise in; the section never changes height while it does.
   - The wall: short reviews as typeset paragraphs between hairline rules, each with its stars, date, one turned phrase, a small monogram, name and town or role. Columns drift in opposite directions at a speed computed from the text (every review stays on screen at least twice its reading time, never faster than 24 px a second). A review fades as a whole as it reaches the edge, so no visible review is ever cut through a line. The runtime picks how many columns fit so no review is on screen twice.
   - Layout `beside`: the wall in two columns to the right of the letter. Layout `below`: the letter across the width with its result in a side column, the wall in up to four columns under it.
3. **Cases**: three cards in view (two on a tablet, one and a peek on a phone), each with a picture panel (the buyer's photo, or a monogram plate in a hairline frame), a before/after figure ("5→2"), what it measures, a one-line quote, the name and place and a link to the case. Arrows and a counter; drag or swipe; it never moves by itself.
4. **Press**: three to six publications, each its wordmark (the buyer's logo file, or the name set in type) over the line it printed.

**Stop is always available.** Hovering a wall column stops that column; hovering or focusing the lead letter stops it turning; the **Pause motion** button stops everything for the visit (WCAG 2.2.2). With `prefers-reduced-motion` nothing moves: the wall is a static list, the letter changes only when a tab is pressed.

**What you can change, honestly**: every word, number, name, link, photo and logo; which blocks appear and in what order; the theme; the layout and column count; the accent colours. The type, spacing and motion of each theme are the design. Each field has a length limit the build enforces.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the check and the video (found automatically; set `CHROME_PATH` if not).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`, or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the theme's Google Fonts. Without it system fonts stand in.
- **Real reviews.** Every quote, name, rating, distribution and result must come from the person. If they have no case figures, leave `cases` out; if they have no press, leave `press` out. Never invent a reviewer or a number.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Steps

### 1. Collect the content

From the person, their review platform export or their current site:

- The **rating**: the average score, the number of reviews, where they come from ("verified reviews since 2022"), and the **share of each star level** in percent. Most review platforms show this breakdown.
- **2 to 6 featured quotes**, each with the person's name, what they bought or their role, their town (optional), a short tab label, and **one measured result** with its unit (`"40"` and `"washes in, and no pilling at the hem"`). Ask what changed for that customer, in numbers.
- **6 to 24 short reviews** for the wall, with stars, name, town or role, and month. If the rating shows any reviews under 5 stars, include at least one (the build insists).
- **3 to 8 cases** (optional): segment, a before/after figure, what it measures, one sentence, the name, the place, and the link to the full case.
- **3 to 6 press mentions** (optional): the publication, its logo (SVG or PNG, the version that reads on your background) and the line it printed.
- **Photos** (optional): square portraits for people (at least 104 px), landscape pictures (16:9, at least 800 px wide) for cases. Without them, monogram tiles are drawn from the names, in colours derived from the palette.

### 2. Write wall.json

Copy the closer example and replace every value:

- `<skill>/examples/wrenmoor/wall.json`: Wrenmoor, a linen bedding brand, theme `letters`, layout `beside`, 4 letters, 10 reviews in 2 columns, 4 cases, 5 press lines.
- `<skill>/examples/tallyport/wall.json`: Tallyport, customs software for brokers, theme `ledger`, layout `below`, press first, 3 statements, 16 reviews in up to 4 columns, 4 cases.

In text, `_underscores_` turn a phrase (italic in the accent for `letters`; full ink against a muted sentence for `ledger`) and `*stars*` make it bold. Photo and logo paths are relative to wall.json; the build copies them into `out/assets/`.

### 3. Build

```
node <skill>/scripts/build.mjs wall.json out
```

It lists every problem at once (a missing field, a line too long, a distribution that doesn't add up, a score that doesn't match it, too few reviews for the columns, an all-5-star wall under a rating that shows lower ones, a link that isn't one, a file that isn't there, an accent that fails contrast) and writes nothing until they are fixed. It writes `out/index.html` (a page with just the section) and `out/embed.html` (the section, its styles and its script, to paste into an existing page).

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It opens the page at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, and fails on: script errors; sideways scrolling; text under 16 px on a phone or 14 px elsewhere (12 px for small-caps labels); text under WCAG AA contrast; text cut off, off the screen or inside the 16 px phone gutter; a review on the wall twice at once or a visible review cut by the wall's edge (sampled over three seconds); a wall that doesn't move, or keeps moving after Pause motion or under the pointer; a letter tab that doesn't switch; the page below shifting when the letter changes; a case arrow that doesn't move the cards; an invisible keyboard focus; and anything moving under reduced motion. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Let a letter turn over, hover a column, press Pause motion, click through the cases.

### 6. Record the video (optional)

```
node <skill>/scripts/record.mjs out/index.html
```

Writes `out/preview.mp4` (1920×1080, 30 fps, about 17 seconds: the rating, the letter turning over beside the wall, the cases sliding one card, the press strip) and `out/poster.png`. `--still 5.4 --png moment.png` saves one moment; add `--size 390x844 --scale 2` for a phone. For clean stills ask the page where nothing is mid-way:

```
node <skill>/scripts/record.mjs out/index.html --moments            # 1920×1080
node <skill>/scripts/record.mjs out/index.html --moments --size 390x844
```

It prints the video's length and every `[block, from, to]` stretch where the scroll rests and no quote line is rising, no bar filling and no card sliding. For the examples as shipped (1920×1080): head 1.7 to 2.3, the spread (Wrenmoor) or lead (Tallyport) 4.05 to 6.4, cases 15.3 to 17.3; on a phone the letter rests 4.05 to 6.4.

### 7. Hand it over

Paste `out/embed.html` where the section goes (or use `out/index.html` as a page), upload `out/assets/` beside it, and tell the person how the rating, the letter timing and the pause work.

## Fields (wall.json)

| Field | What it is | Range / default |
| --- | --- | --- |
| `theme` | `letters` (cream paper, Newsreader and Hanken Grotesk, madder accent) or `ledger` (near-black, Familjen Grotesk and Spline Sans Mono, chalk-teal accent, amber stars) | required |
| `accent` | the accent, for figures, turned phrases, the quote mark | `#rrggbb`; default #9c3b22 (letters), #8fd3c1 (ledger); must reach 4.5:1 on the background |
| `accent2` | the second palette colour: tile washes (letters), stars and tiles (ledger) | `#rrggbb`; default #5e6b4f (letters), #e8b65a (ledger) |
| `lang`, `pageTitle` | the page's language and `<title>` | up to 12 / 70 characters; default `en` / the headline |
| `brand` | the name in the top rule | 1 to 24 characters |
| `kicker` | the line after it | up to 44 characters |
| `title` | the headline; one `_phrase_` may be turned | 8 to 46 characters |
| `pauseLabel` | the pause button's words | up to 16; default `Pause motion` |
| `order` | the blocks after the head | any order of `spread`, `cases`, `press`; must include `spread`; default `["spread","cases","press"]` |
| `rating.score` | the average | 1 to 5, one decimal; must match the distribution within 0.06 |
| `rating.count` | number of reviews | whole number, 1 or more |
| `rating.source` | where they come from | up to 40 characters |
| `rating.distribution` | percent of 5, 4, 3, 2 and 1 star reviews | 5 whole numbers adding up to 100 |
| `lead.label` | what a featured quote is called ("Letter", "Statement") | up to 14; default `Letter` |
| `lead.items[]` | the featured quotes | 2 to 6 |
| `  .quote` | the quote, no quotation marks | 30 to 190 characters |
| `  .name`, `.role`, `.place` | who said it | up to 30, 46, 22 (`place` optional) |
| `  .tab` | the tab's label | up to 20 |
| `  .photo` | a portrait | optional; .webp .jpg .png .avif |
| `  .result.value`, `.result.label` | the measured result, and what it measures (`*bold*` allowed) | up to 7 / 64 |
| `wall.label` | the screen-reader name of the list | up to 40; default `Reviews` |
| `wall.layout` | `beside` the letter, or `below` it | required |
| `wall.columns` | columns at full width | 1 to 2 (`beside`), 1 to 4 (`below`); at least 3 reviews per column; fewer columns are used automatically where they don't fit |
| `wall.notes[]` | the reviews | 6 to 24 |
| `  .stars` | the rating | 1 to 5 |
| `  .quote` | the review, one `_phrase_` turned | 20 to 130 characters |
| `  .name`, `.about`, `.date` | who, their town or role, the month | up to 26, 30, 10 |
| `  .photo` | a portrait | optional |
| `cases.label`, `cases.title` | the block's label and heading | up to 20 (default `Cases`) / 34 |
| `cases.items[]` | the case cards | 3 to 8 |
| `  .segment`, `.value`, `.label` | the kind of customer, the figure ("5→2"), what it measures | up to 20, 7, 44 |
| `  .quote`, `.name`, `.place` | one sentence, the customer, the place (the town before any comma is printed on the picture) | 16 to 96, up to 26, 26 |
| `  .photo` | a landscape picture | optional |
| `  .link` | `{ "label", "href" }` to the full case | label up to 18; href `https://…`, `/path`, `#id`, `mailto:`, `tel:` |
| `press.label` | the strip's label | up to 24; default `In the press` |
| `press.items[]` | the publications | 3 to 6 |
| `  .name` | the publication (also the logo's alt text) | up to 24, set as written |
| `  .logo` | its logo file | optional; .svg .png .webp |
| `  .style` | how the name is set without a logo | `serif`, `serif-italic`, `serif-bold`, `sans`, `sans-bold`, `caps`, `mono`; default `sans` |
| `  .line` | the line it printed, with its quotation marks | up to 60 |
| `  .href` | a link to the article | optional |

## How it behaves

- **Desktop (1100 px and up)**: as above; `beside` puts the wall in two columns as tall as the letter.
- **Tablet (760 to 1099 px)**: the rating goes under the headline, the wall goes under the letter in up to two columns 600 px tall, two cases in view, the press in rows of three.
- **Phone (under 760 px)**: one column throughout; the quote mark stands above the quote; the result goes under the signature; the tabs show their numbers; the wall is one column 560 px tall (tap a column to pause it); the cases are 86 % wide with the next one peeking; the press is a list.
- **Screen readers**: the rating is read as a sentence; the letter is a tab list with panels; the moving wall is hidden and a plain list of every review stands in.
- **No JavaScript**: everything shows: the first letter, the wall as static columns, the cases as a scrollable row.

## Files

- `SKILL.md`: these instructions.
- `scripts/build.mjs`, `scripts/check.mjs`, `scripts/record.mjs`, `scripts/serve.mjs`: entry points; the work is in `scripts/kit/`.
- `scripts/kit/schema.mjs`: every field, its limits and the honesty rules (distribution, score, under-5 reviews, reviews per column).
- `scripts/kit/build.mjs`: renders the section, derives the tile colours from the palette and writes `index.html` and `embed.html`.
- `template/wall.css`: the layout, both themes and the phone and tablet layouts. `template/runtime.js`: the reading-paced motion, the pause rules and the recorder's clock.
- `scripts/kit/check.mjs`: the four-width check. `scripts/kit/record.mjs`: the frame-by-frame recorder. `scripts/kit/cdp.mjs`, `scripts/kit/serve.mjs`, `scripts/chrome.mjs`: browser and server helpers.
- `examples/wrenmoor/wall.json`, `examples/tallyport/wall.json`: the two examples (invented brands, people and figures).

## Troubleshooting

- **"rating.score is 4.8 but the distribution averages 4.73"**: one of them is wrong; copy both from the same source on the same day.
- **"are all 5 stars but the rating shows lower ones"**: add one of the real 4-star (or lower) reviews. It is what makes the wall credible.
- **The wall shows fewer columns than `wall.columns`**: the reviews were too few or too short to fill that many columns without one showing twice; add reviews or accept the columns it chose.
- **Long empty bands at the top or bottom of the wall**: that is a review fading as a whole before the edge cuts it. Shorter reviews make the bands smaller.
- **The check reports low contrast after changing `accent`**: the accent sets text; pick a darker shade on `letters`, a lighter one on `ledger`.
- **A logo is invisible**: on `ledger` use the light version of the logo.
- **The letter never turns over**: Pause motion was pressed (it is remembered for the visit), the pointer is over it, or the system asks for reduced motion.
- **The words look slightly different from the preview**: Google Fonts didn't load and system fonts stood in.
