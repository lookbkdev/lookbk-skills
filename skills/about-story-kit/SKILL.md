---
name: about-story-kit
description: Build a company or studio About page from one about.json, where nothing is claimed without a receipt. A founding sentence with a record card (founded, where, headcount as of a date, who wrote the page and when); a dated record of milestones, each with what changed (before and after) and a lettered evidence note in the margin, drawn as you scroll, down a spine with the empty years ticked or along a rail on a true time scale; the people as a contact sheet or an index with a viewer, each with what they actually do and one dated decision that appears on hover (and is always printed on touch screens); how we work as rules with the year they started and how to check them; up to four numbers, each footnoted with how it was counted and an as-of date; and a close that names who to talk to, with real addresses and reply times. Supply-your-own portraits are shown in the palette's duotone, with designed fallback tiles (timber rings, hatching or plain initials) when there is no photo, and never stock faces. The build refuses unsourced numbers, milestones without evidence, future as-of dates and a headcount the page does not add up to. Builds a self-contained page and a paste-in embed, with checks at four widths (text size, measured contrast, overflow, initials seated in their tiles, decisions visible without hover, the viewer, the rail's spacing, the record drawn under reduced motion, focus rings) and a frame-by-frame recorder for the preview video.
license: MIT
---

# About Story Kit

The About page most sites waste on a stock team grid and three values. The governing idea: **nothing is claimed without a receipt.** Every statement sits beside its margin note (a date, a name, a source), so the page reads like a well-kept record of the company rather than a brochure about it.

**The page, top to bottom:**

1. **The founding sentence.** One sentence (who, when and why) with one turn in the accent, who signed it, and a **record card** in the margin: founded, where, people (as of a date), and who wrote the page and when. A contents row follows.
2. **The record.** Up to 12 milestones, each with a title, a short body, a **Before → After** row in concrete units, and a lettered **evidence** note (a, b, c) beside it. Two layouts:
   - `spine`: a vertical line with the year as a figure on the left. Years with no entry are still ticked on the line, so the gaps in the story show.
   - `rail` (up to 8): a horizontal axis on a true time scale, one tick a year, a pin at each entry's month. Entries alternate above and below and sit as close to their own date as their neighbours allow; an L-shaped leader joins pin and entry. Below 1024 px (1280 px for 7 or 8 entries) the rail runs down a spine.
   - The line draws as you scroll (it follows the scroll exactly), and each dot fills as the line reaches it; key entries fill in the accent.
3. **The people.** Each person has a role and the year they joined, one line on what they actually do, and **one dated decision** ("Decided, 2019: No more veneer, whatever it costs."). Two layouts:
   - `sheet`: everyone on a contact sheet (6 columns, 4 on tablets). On hover or keyboard focus a strip slides up over the portrait with the decision (280 ms); on touch screens and phones the decision is printed under the person.
   - `index`: the people who lead the work as ruled rows beside a sticky **viewer** that shows the hovered or focused person: portrait, name, the decision set large, and what changed (before → after). Arrow keys move through the rows. Everyone else is listed by name and role underneath, so a 40-person company names all 40.
4. **How we work.** 2 to 6 practices, each a rule you could hold the company to, one line of detail, the year it started and **how to check** it.
5. **Numbers.** 2 to 4 figures, set still (they never count up), each with a footnote marker and a numbered source that says how it was counted. The section is headed with its as-of date.
6. **Talk to us.** Up to four named people, what to bring to each, their address and how fast they reply, then the address and visiting line.

**Portraits.** Put your own photos next to about.json and name them per person. They show in a duotone made from the palette (shadows to the ink, highlights to the surface, mid-tones lightly through the accent) and come up in colour on hover or focus (320 ms). Without a photo, each person gets a **fallback tile**: their initials (first and last capitalised words, so "Mats de Vries" is MV) seated on a baseline with the same margin on every tile, over a pattern drawn from their name: `rings` (growth rings, in up to 6 timber tones you choose), `hatch` (fine hatching), or `plain`. The kit ships no faces. The Hollin example's photo version uses cut-paper stand-ins drawn in code (`scripts/kit/paper-portraits.mjs`), which have no faces either.

**Motion.** The record's line follows the scroll; dots fill in 240 ms; each section fades up 12 px once as it comes into view (420 ms, `cubic-bezier(.2,.7,.2,1)`); the hover strip and the colour photo, 280 and 320 ms. Nothing loops. **Reduced motion** gets the record fully drawn, every dot filled and no fades. **Without JavaScript** the page is all there, with the record drawn and the decisions printed.

**What you can change, honestly.** Every word, date, number, person and link; the timeline and people layouts; the five theme colours (contrast enforced at build time and measured again by the check); serif or grotesk type; the fallback pattern and its tones; section titles. The spacing, the type scale and the motion are the design and stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/about.css`: the whole design, scoped to `.ab`. Hero, record (spine and rail), people (sheet and index), practices, numbers, close; tablet and phone rules; touch and reduced-motion rules.
- `kit/runtime.js`: the browser runtime, inlined into every build. Draws the record as you scroll, lays out the rail on its time scale, runs the index viewer, fades sections in once, and gives the recorder its clock.
- `scripts/build.mjs`: about.json to `out/index.html` (the About page with the site's nav and footer), `out/about-embed.html` (the sections to paste in) and `out/people/` (your portraits).
- `scripts/kit/schema.mjs`: every field, its limits, the colour contrast rules and the evidence rules; lists every problem at once.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills, full-page shots and `--moments` (the holds where nothing moves).
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `scripts/kit/paper-portraits.mjs`: draws the cut-paper stand-in portraits for the Hollin photo example.
- `examples/hollin/about.json` (spine, sheet, rings), `examples/hollin/about.photos.json` (the same with portraits from `examples/hollin/people/`), `examples/halyard/about.json` (rail, index, hatch).

## Steps

### 1. Collect the evidence first

From the person, or from their records, not from imagination:

- **The founding sentence**: who started it, when, and why, in one sentence. The founding date, the place, the headcount and the day it was counted.
- **The record**: 3 to 12 milestones with their month. For each: what changed, in units if possible (people, benches, revenue share, designs), and the **receipt**: a document, a count, a date. Ask for it; a milestone without one is left out.
- **The people**: name, role, the year they joined, one line on what they actually do (verbs, not titles), and one thing they decided, with its year. Photos if they want them shown. For bigger teams, the rest of the names and roles.
- **Practices**: specific things they always do, since when, and how a visitor could check.
- **Numbers**: up to 4, each with how it was counted and the period, and the day they were counted.
- **Who to talk to**: a named person per kind of enquiry, their address and reply time.

### 2. Write about.json

Copy the example closest in spirit and replace every value:

- `examples/hollin/about.json`: Hollin Workshop, a 12-person furniture workshop. Serif on paper and madder, `spine` record, `sheet` people with `rings` tiles in four timber tones.
- `examples/halyard/about.json`: Halyard, a 40-person software consultancy. Grotesk on graphite and orange, `rail` record, `index` people (8 who lead the work, 32 more listed) with `hatch` tiles.
- `examples/hollin/about.photos.json`: Hollin with portraits.

Put photos next to about.json (for example `people/ines.jpg`) and set `photo` and, if the face is not centred, `focus` ("50% 30%").

### 3. Build

```
node <skill>/scripts/build.mjs about.json out
```

It lists every problem at once and writes nothing until they are fixed. The evidence rules are deliberate: a number needs its `source`, a milestone its `evidence`, an `asOf` date must have happened, and the people listed (featured plus others) must add up to `founding.headcount.count`. Warnings name empty adjectives in practices ("passionate", "innovative"); rewrite them as something you do.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

At 390, 768, 1024 and 1440 px, and with reduced motion at 390 and 1440, it fails on script errors, links without an address, sideways scrolling, copy under 14 px (16 px on a phone) or labels under 12 px, contrast under WCAG AA measured against what is actually behind the text, text cut off or off screen, initials that reach the edge of their tile (measured from the glyphs' ink), a decision that is not printed where there is no hover, a viewer that does not follow the hovered row, a headcount that does not match the people listed, a milestone without its evidence or a number without its source, rail entries that overlap, a record already drawn at the top of the page or not fully drawn at the bottom (or under reduced motion), a section that never fades in, and a keyboard focus that can't be seen. Each run prints the smallest copy and label sizes, the lowest contrast and the tightest initials margin.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints, scroll through the record, hover the people, and try it on a phone. For a single picture of the whole page: `node <skill>/scripts/record.mjs out/index.html --full --size 1440x900 --png page.png`.

### 6. Put it on the site

`out/index.html` is a complete About page with a demo nav and footer. To use your site's own, paste `out/about-embed.html` where the page content goes and copy `out/people/` beside it. The embed carries its own styles (scoped to `.ab`), runtime and font link; nothing else is needed.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 17 --size 1920x1080 --poster 11.45
node <skill>/scripts/record.mjs out/index.html --still 11.45 --size 390x844 --scale 2 --png phone.png
```

`--moments` lists the holds (hero, record, record-end, people, numbers, close) where nothing on screen moves; take posters and stills from inside one. The recorder scrolls a fixed 17-second script frame by frame, so the video is the same on any machine.

## about.json, every field

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `brand` | 1 to 40 characters | required | demo nav, title, footer |
| `lang` | language tag | `en` | |
| `nav` | up to 6 `{ label (up to 20), href, current? }` | none | the demo page's nav |
| `theme` | see below | required | |
| `titles` | `{ record?, people?, practices?, numbers?, contact? }`, up to 24 each | The record, The people, How we work, Numbers, Talk to us | section titles |
| `founding.eyebrow` | up to 40 | required | |
| `founding.sentence` | up to 160, exactly one `_turn_` | required | the turn takes the accent |
| `founding.signedBy` | up to 90, `**bold**` allowed | required | |
| `founding.place` | up to 40 | required | |
| `founding.founded` | `YYYY-MM-DD`, not in the future | required | |
| `founding.headcount` | `{ count (1 to 2000), asOf (YYYY-MM-DD, not in the future) }` | required | must equal the people listed |
| `founding.written` | `{ date (YYYY-MM or YYYY-MM-DD), by (up to 30) }` | required | shown in the record card and footer |
| `timeline.layout` | `spine`, `rail` | required | |
| `timeline.entries` | 3 to 12 (rail: up to 8), in date order | required | |
| entry `date` | `YYYY-MM`, not in the future | required | |
| entry `title` / `body` | up to 60 / up to 220 | required | |
| entry `before`, `after` | up to 48 each, both or neither | none | |
| entry `evidence` | up to 140 | required | the lettered margin note |
| entry `key` | `true` | none | year and dot in the accent |
| `people.layout` | `sheet`, `index` | required | |
| `people.featured` | 1 to 24 (sheet) or 12 (index) | required | |
| person `name` / `role` | up to 32 / up to 22 | required | |
| person `since` | a year, not before founding or in the future | required | |
| person `does` | up to 110 | required | what they actually do |
| person `decided` | `{ year (not before since), line (up to 70), before?, after? (up to 40, both or neither) }` | required | before/after shows in the index viewer |
| person `photo` | a .jpg, .png, .webp, .avif or .svg next to about.json | none | shown in the duotone |
| person `focus` | `"50% 30%"` | centre | the photo's crop |
| person `tone` | index into `theme.tones` | from the name | the fallback tile's tone |
| `people.others` | up to 400 `{ name (up to 32), role (up to 18) }` | none | index only: the roll |
| `people.hover` | a featured person's number, from 0 | 0 | who is hovered in the recording |
| `practices` | 2 to 6 `{ rule (up to 48), detail (up to 160), since (year), check (up to 48) }` | required | |
| `numbers.asOf` | `YYYY-MM-DD`, not in the future | required | |
| `numbers.items` | 2 to 4 `{ value (up to 8, with digits), unit? (up to 5), label (up to 60), source (up to 140) }` | required | |
| `contact.title` / `lede` | up to 60 / up to 120 | title required | |
| `contact.people` | 1 to 4 `{ for (up to 40), name, role (up to 30), email, reply (up to 40) }` | required | a featured person's name reuses their tile |
| `contact.visit` | up to 2 lines of 90 | none | |

`theme`, colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `bg` | | the page |
| `surface` | | panels, the viewer, the duotone's highlights |
| `ink` | 7:1 on `bg` and `surface` | text; muted text is derived at 5.4:1 |
| `accent` | 4.5:1 on `bg` and `surface` | turn, markers, key entries, rules |
| `onAccent` | 4.5:1 on `accent` | |
| `type` | `serif` (Source Serif 4 and IBM Plex Mono), `grotesk` (Familjen Grotesk and Martian Mono) | default `serif` |
| `fallback` | `rings`, `hatch`, `plain` | default `rings` |
| `tones` | 1 to 6 `{ name?, tile, line, ink }`, ink 3:1 on tile | fallback tile colours; default from `surface` and `ink` |

## Troubleshooting

- **The build lists problems and writes nothing.** Fix them all and build again; it reports everything at once.
- **"the people section lists 39 people, but founding.headcount.count says 40".** Add the missing person to `people.others` (or `featured`), or correct the count and its `asOf`. The page must agree with itself.
- **"numbers.items[1].source is required".** Say how the number was counted: which register, ledger or log, and over what period. If nobody can say, leave the number out.
- **"numbers.asOf is in the future".** Use the day the figures were actually counted.
- **The rail shows as a spine on a laptop.** Below 1024 px (1280 px with 7 or 8 entries), or when the entries can't fit beside their dates, the record runs down a spine. Shorten the bodies or use `spine`.
- **A photo looks muddy.** The duotone maps light and dark to the palette; photos with flat lighting go grey. Use a photo with a clear light side, or set `focus` so the face fills more of the tile.
- **The check says initials reach the edge of their tile.** A very wide pair of letters in a narrow column. Use `plain`, or let the name's first and last capitalised words give narrower letters.
- **No video.** Install ffmpeg or set `FFMPEG_PATH`. The checks and stills don't need it.
