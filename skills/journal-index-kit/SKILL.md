---
name: journal-index-kit
description: Build a journal or blog front page and article pages from a folder of Markdown files, set like a printed magazine rather than a blog theme. The index is a numbered register (issue number, title and dek, section, reading time drawn as a rule, date), grouped by year, with section filters that work in place and as real links, a preview slot beside the register that shows the lead image of the row under the pointer or keyboard focus, a lead story and a series band. Articles get editorial typography - an optional drop cap, pull quotes, footnotes set as sidenotes on wide screens and end notes on narrow ones, numbered figures that keep their own shape, charts drawn from data, highlighted code with marked lines, a contents rail and a progress bar that agree with one reading-time model. The build writes RSS with full text, a sitemap, Article JSON-LD and a paste-in embed, and the check verifies text size, contrast, overflow, layout shift, sidenote placement, the reading position, the filters, the keyboard, the no-JavaScript pages, the feed and the structured data.
license: MIT
---

# Journal Index

The front page of a journal, set like the contents page of a printed periodical: one numbered register where every piece carries an issue number, a section, a length and a date. Each article is set like the printed piece that number points to, and its margins do real work: sidenotes beside the line that needs them, a contents rail, and how much is left to read.

It is for brands that publish properly: a design studio's essays, an engineering team's write-ups, a research group's notes. It is not a card grid of thumbnails with tag pills.

**What the build makes from `journal/`** (a `journal.json` and a `posts/` folder of Markdown files):

1. **The index** (`index.html`): a masthead, the lead story (the post marked `featured`, else the newest) with its picture or chart, then **the register**. Rows are grouped by year, with an optional volume label. Each row has the issue number, the title and dek, the section, the reading time drawn as a hairline whose length is relative to the longest piece, and the date. Filters by section sit above it, each with its count. In the browser they filter in place: the rows that leave fold away, nothing below the register moves, and the address gets `?section=`. Without JavaScript they are links to `section/<name>/`, which lists the same rows. Beside the register on wide screens, **the preview slot** shows the lead image of the row under the pointer, after a 60 ms pause so crossing rows doesn't flicker, or of the row with keyboard focus, at once. A piece with no picture shows a typographic plate (its number and section), and a piece whose lead is a chart shows the chart, redrawn at the slot's size with its labels kept at 12 px. Below is the **series band**: each series with "4 of 6 published", a tick strip, and its parts in order, with written parts linked and planned ones marked Forthcoming.
2. **Every article** (`<slug>/index.html`): folio (number, section, series and part), title, dek and byline, the lead picture or chart, then the text. On screens 1180 px and wider, a **contents rail** on the left lists the `##` headings with a dot on the current one, a fill line and "N min left of M". The **measure** is about 66 characters. **Sidenotes** sit in the right margin at the baseline of their reference, each pushed below the note above it and below any figure or pull quote that reaches into the margin. A 3 px **progress bar** runs along the top. Narrower screens get a sticky "Contents · N min left" bar that opens the list, and the notes move to the end of the article. Pull quotes, numbered figures (tall ones get their caption beside them, and nothing is cropped), charts, code with a file name, language, line numbers and marked lines, then the next part of the series and three more pieces from the same section as register rows.
3. **The feed and the rest**: `feed.xml` (RSS 2.0, full text, authors, section, the lead picture as an enclosure), `sitemap.xml`, `section/<name>/` for each section, `archive/` when there are more pieces than `indexLimit`, Article JSON-LD on every article and Blog JSON-LD on the index, and `journal-embed.html`, the lead story, register and series band to paste into an existing site.

**One reading-time model.** Prose (paragraphs, headings, lists, quotes, captions and footnotes) is read at **230 words a minute**. Code counts by its non-blank lines at **12 lines a minute**, so 5 seconds a line, whatever is on the line. Each figure or chart adds **12 seconds**. The build works out the seconds for every block, rounds the total up to whole minutes (never below 1), and every number on the site comes from that: the index row, the lead's byline, the article head, JSON-LD `timeRequired`, the rail's "N min left of M" and the progress bar. A post can't type its own minutes. Change the rates in `journal.json` `reading` and every number moves together.

**Motion.** It is used only where it means something. The register rises once when it first comes into view (8 px, 420 ms, 35 ms apart, at most 12 rows staggered). The preview crossfades in 180 ms and settles from 1.015 scale over 600 ms. Filtered rows fade in 160 ms and fold in 240 ms. Row titles take an accent underline on hover and focus. The progress bar and rail follow the scroll, because they are instruments. Nothing loops. **Reduced motion** gets every state at once, and the progress still updates. **Without JavaScript** every page is complete static HTML: filters are links, footnotes are anchors to end notes, and the preview slot shows the newest piece.

**What you can change, honestly.** Every word, picture and chart, the sections, series and volumes, the two presets (`paper`, a light serif publication; `ink`, a dark technical one) and their seven colours (contrast enforced at build time and measured again in the check), the two type pairings, which side the lead picture sits on, the drop cap, old-style or tabular figures, the reading rates and how many rows the index shows. The grid, the type scale and the motion are the design, and they stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install: the Markdown, front matter, code colouring and charts are all done by the kit's own scripts.
- Chrome, Chromium or Edge, for the check and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the preview video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when a page is opened, for its Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `scripts/build.mjs`: the journal folder in, the whole site out (index, articles, section pages, archive, feed, sitemap, embed, images).
- `scripts/kit/build.mjs`: the page templates, the feed, the sitemap and the JSON-LD.
- `scripts/kit/markdown.mjs`: front matter and Markdown, including footnotes, pull quotes, figures and code fences, with line numbers in every error.
- `scripts/kit/reading.mjs`: the reading-time model; the only place minutes are worked out.
- `scripts/kit/schema.mjs`: every field of `journal.json` and of a post, its limits, the presets and the colour contrast rules.
- `scripts/kit/chart.mjs`: charts from a .json file (line, bars, columns), drawn at any size with real text labels.
- `scripts/kit/highlight.mjs`: build-time code colouring for Rust, Go, JavaScript, TypeScript, Python, SQL and shell.
- `scripts/kit/images.mjs`: reads each picture's size, so every image has its width and height and nothing shifts while loading.
- `kit/journal.css`: the whole design, scoped to `.ji`: both presets, tablet and phone rules, reduced motion.
- `kit/runtime.js`: the browser runtime inlined into every page: filters, the preview slot, the entrance, sidenote placement, the rail and progress, and the recording clock.
- `scripts/check.mjs`: checks a built journal at 390, 768, 1024 and 1440 px, with reduced motion, without JavaScript, and its feed, sitemap and JSON-LD.
- `scripts/record.mjs`: the preview video, stills of any page, and `--moments`.
- `scripts/serve.mjs`: serves the built site on localhost to look at.
- `examples/coldframe/`: Coldframe Journal, a furniture and interiors studio, `paper`, 11 pieces, two series.
- `examples/tarnline/`: Tarnline Engineering, a database company, `ink`, 10 pieces with charts and code, an archive page.

## Steps

### 1. Collect the writing

From the person, or from their current blog's export:

- **Each piece as Markdown**, with its title, a dek (one or two sentences: it is the second line of the index row), section, date, author, and, if it has one, its lead picture with alt text and a caption. A piece with no picture is fine: it gets a typographic plate.
- **The sections**: 1 to 8, named the way the publication names them (Essays, Process; Storage, Postmortems), not as tags.
- **Issue numbers**: if they have never numbered their pieces, number them in date order from 1. The number is the piece's identity on the page.
- **Series**, if any: the name, a sentence, and the titles of all the parts in order, including planned ones.
- **The masthead**: the publication's name with one word to set as the turn, a strap (one sentence on what it publishes), and a "since" line.
- The site's address, its main navigation, and the email sign-up page if there is one.

Never invent pieces, dates, authors or numbers to fill the register. A journal with four pieces should look like a journal with four pieces.

### 2. Lay out the journal folder

```
journal/
  journal.json
  posts/048-what-the-bench-taught-us.md     (the slug is the file name without its number)
  images/bench.jpg  images/bench.webp       (a .webp or .avif beside a .jpg is used automatically)
  charts/latency.json
```

Copy the example closest in spirit and replace everything:

- `examples/coldframe/`: a studio's essays, `paper` preset, Newsreader and Schibsted Grotesk, photographs, drop caps, roman-numeral series.
- `examples/tarnline/`: an engineering blog, `ink` preset, Geist, Source Serif 4 and Geist Mono, charts as lead figures, code, an archive page.

The example photographs in `examples/coldframe/images/` were generated for this demo. Replace them with the publication's own.

### 3. Write each post

````markdown
---
no: 48
title: What the bench taught us about _edges_
dek: Three prototypes, one sanding block and a year of people sitting down.
section: Essays
date: 2026-10-09
author: Ines Marlow
series: { name: On Edges, part: 4 }
lead:
  image: images/bench.jpg
  alt: Two hands sanding the rounded edge of an oak bench top.
  caption: The third prototype, white oak, before oiling.
---

Body text. A footnote goes here.[^1]

## A heading for the contents rail

> !pull The edge you can't see is the one _you touch first._
> cite: From the studio diary

![Card models on a cutting mat.](images/models.jpg "Fig. 2 | Card studies on the mat.")

```rust scheduler/budget.rs {3-4}
let bucket = &mut self.buckets[tier as usize];
```

[^1]: The note's text, set in the margin on wide screens.
````

### 4. Build

```
node <skill>/scripts/build.mjs journal out
```

It lists every problem at once, with file and line: a missing dek, a section that isn't in `journal.json`, two posts with the same number, a footnote used but never written, an image without alt text, an image or chart that isn't there, a series part claimed twice, a colour pair under its contrast minimum. It writes nothing until they're fixed. Posts dated after today are drafts and are left out; `--drafts` includes them, `--today 2026-11-09` sets the day.

### 5. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs the index and the lead article at 390, 768, 1024 and 1440 px, and with reduced motion at 390 and 1440, then every other page at 1440. It fails on:

- script errors, links without an address, sideways scrolling, layout shift over 0.02 while loading
- text under 16 px on a phone or 14 px elsewhere (labels, chart labels and note numbers: 12 px), and text under WCAG AA contrast against the colour actually behind it
- text cut off or off the screen
- a row linking to a page that wasn't built, or showing different minutes from the build
- a filter showing the wrong rows or count, or moving anything below the register
- a preview slot the keyboard can't reach, a focused row not shown in it, a focus ring you can't see
- sidenotes overlapping each other or a figure, starting above their reference's line, or leaving the margin
- "N min left of M" or the progress bar disagreeing with the reading model at 35% and 70% down the page, or not saying Finished at the end
- JSON-LD whose headline isn't the h1, or whose dates or minutes differ from the page, the feed or the build
- a feed or sitemap that doesn't parse, or misses a piece, its date or its full text
- without JavaScript: missing rows, section links that don't lead to that section, an article body or notes that don't show

Each line reports what it measured. Fix and build again until it prints `all checks passed`.

### 6. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Hover down the register and press Tab through it; try a filter; open the lead article on a laptop and a phone and scroll.

### 7. Publish

Upload the whole `out/` folder to the address in `site.url`: every link, the feed and the canonical URLs assume it lives there. Point the site's RSS link at `feed.xml` and submit `sitemap.xml` (or merge its entries into the site's sitemap). To put the front page inside an existing site instead, paste `out/journal-embed.html` where it goes; its links point at `site.url`, so the article pages must still be published there. `journal.manifest.json` is what the check reads; it need not be published.

### 8. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --seconds 10 --poster 0.4
node <skill>/scripts/record.mjs out/index.html --still 6.6 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --still 0 --page what-the-bench-taught-us/ --scroll .ji-pull --png article.png
node <skill>/scripts/record.mjs out/index.html --moments
```

The video follows a fixed 10-second script: the masthead and lead, a scroll to the index, the register rising, the preview slot following three rows, one filter, a hold. `--moments` prints the stretches in which nothing moves; take stills from inside them.

## journal.json, every field

| Field | What it is | Limits, default |
| --- | --- | --- |
| `brand` | The wordmark in the top bar | required, 32 characters |
| `masthead` | The publication's name, set as the masthead; `_one word_` is the turn | required, 40 characters, one turn |
| `strap` | One sentence on what it publishes | required, 220 characters |
| `since` | "Published irregularly since 2019" | required, 64 characters |
| `publisher` | Organisation name for JSON-LD | 60 characters, default `brand` |
| `language` | `lang` of every page and the feed | default `en` |
| `site.url` | Where `out/` will live, ending in `/` | required |
| `site.home` | Where the wordmark links | default the journal |
| `site.nav` | `[{ "label", "href", "current"? }]` in the top bar | 0 to 6, label 18 characters |
| `theme.preset` | `paper` (light) or `ink` (dark) | default `paper` |
| `theme.fonts` | `newsreader` (Newsreader, Schibsted Grotesk) or `geist` (Geist, Source Serif 4, Geist Mono) | default by preset |
| `theme.leadSide` | Lead picture `left` or `right` of its copy | `paper` left, `ink` right |
| `theme.dropCap` | Drop cap on each article's first paragraph (a post can override) | `paper` true, `ink` false |
| `theme.numerals` | `oldstyle` or `tabular` | by preset |
| `theme.colors` | Any of `bg`, `band`, `ink`, `muted`, `faint`, `rule`, `accent`, `code` as `#rrggbb` | ink on bg 7:1; ink on band and code, muted on bg and band, accent on bg and band 4.5:1; faint on bg 3:1 |
| `issueLabel` | Before the number: `Nº`, `No.` | 4 characters, default `Nº` |
| `sections` | Section names, in filter order | 1 to 8, 18 characters each |
| `series` | `[{ "name", "description", "parts": [titles in order] }]` | 0 to 3; name 32, description 160, 2 to 12 parts |
| `volumes` | `{ "2026": "Volume 8" }`, shown beside each year | 20 characters |
| `indexLimit` | Rows on the index; the rest go to `archive/` | 4 to 200, default 24 |
| `reading.wpm` | Prose reading speed | 120 to 400, default 230 |
| `reading.codeLinesPerMinute` | Code reading speed | 4 to 60, default 12 |
| `reading.secondsPerFigure` | Time added per figure or chart | 0 to 60, default 12 |
| `labels.lead`, `.index`, `.series`, `.read`, `.plate` | "Lead story", "The _Index_", "In _series_", "Read the essay", "Plate" | 32 characters each |
| `labels.seriesIntro` | The sentence beside the series heading | 160 characters |
| `footer.email`, `.emailLabel` | Email sign-up link and its words | optional |
| `footer.colophon`, `.note` | Colophon line and an extra sentence | 80 and 120 characters |
| `feed.title`, `.description`, `.items` | Feed overrides; items 1 to 100 | default masthead, strap, 20 |

## Post front matter, every field

| Field | What it is | Limits |
| --- | --- | --- |
| `no` | Issue number, unique | required, whole number 1 or more |
| `title` | `_one word_` is the turn (italic accent on `paper`) | required, 90 characters |
| `dek` | The standfirst and the index row's second line | required, 10 to 200 characters |
| `section` | One of `sections` | required |
| `date` | `YYYY-MM-DD`; after today it is a draft | required |
| `updated` | `YYYY-MM-DD`, on or after `date` | optional; JSON-LD dateModified and sitemap lastmod |
| `author` | A name or a list of up to 4 | required, 40 characters each |
| `series` | `{ name: On Edges, part: 4 }` | name from `series`, part within its parts |
| `lead.image`, `.alt`, `.caption`, `.credit` | Lead picture, its alt text (required with an image), caption and credit | caption 180, credit 60 |
| `lead.chart`, `.caption` | Lead chart instead of a picture | a chart .json |
| `featured` | Make this the lead story | one post at most; default the newest |
| `dropCap` | Override the theme's drop cap | true or false |
| `draft` | Leave out of the build | true or false |
| `slug` | The page's folder | default the file name without its leading number |

**Body extras**: `[^id]` and `[^id]: text` footnotes; `> !pull ...` and `> cite: ...` pull quotes; `![alt](src "Fig. 2 | caption")` figures, with `{wide}` after to reach into the margin; a `.json` source for a chart; ```` ```lang path/file {3-4} ```` for code with marked lines. `##` headings go in the contents rail (60 characters), `###` don't.

**Chart files** (`charts/*.json`): `kind` (`line`, `bars`, `columns`), `describe` (a sentence for screen readers, required), `max`, `unit`, `ticks` (default 4), `values` (line and bars, each between 0 and `max`), `x` (`[[index, "label"], ...]`), `shade` (line: shade from this index), `highlight` (bars: `[from, to]` in the accent), `marker` (`{ "at", "label" }`), `guide` (a dotted value line), `notes` (`[{ "at", "value", "text", "accent" }]`, 40 characters), `groups` and `legend` (columns).

## Troubleshooting

- **The build says a footnote is used but never defined.** Every `[^id]` in the text needs a line `[^id]: text` somewhere in the post, and the ids must match exactly. Unused definitions are reported too.
- **A section filter shows nothing.** The section is in `journal.json` but no published post uses it, so its page reads "Nothing in ... yet". Remove the section, or check the post's `section` spelling and that its date isn't in the future.
- **The minutes look too low or too high.** They come from the text, not from a field. Check `reading` in `journal.json`; long code listings count 5 seconds a line, and each figure adds 12 seconds.
- **Sidenotes appear at the end of the article.** That is the design below 1180 px wide, and without JavaScript. On wide screens with JavaScript they move into the margin.
- **The preview slot shows a number instead of a picture.** The post has no `lead.image`. Add one with alt text, or leave the typographic plate, which is designed for it.
- **A chart's labels overlap.** Use fewer `x` labels (four or five) and keep `notes` short. The small copy in the preview slot keeps only the first and last label on each axis.
- **The check reports contrast on a colour you set.** The build checks your `theme.colors` pairs, and the check measures the page. Darken `muted` or `accent` on `paper`, or lighten them on `ink`, until both pass.
- **The feed has the wrong addresses.** Every link is built from `site.url`. Set it to the address where `out/` will be published, ending in `/`, and build again.
