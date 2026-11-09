---
name: portfolio-index-kit
description: "Build a designer's, studio's or photographer's work index from one work.json - a typographic list of projects (number, client, discipline, year, one-line outcome) where pointing at a row slides that project's picture or loop out as a numbered plate that follows the pointer on a spring, never covers the line being read, and riffles as you move down the list. An Index/Grid switch with a FLIP transition, a discipline filter with live counts, and one case page per project. Phones open the plate inline, keyboard focus gets the same plate, reduced motion gets it without movement. Two row systems, your own pictures resized to WebP at five widths, a self-contained page plus a paste-in embed, checks at four widths (text size, contrast, overflow, the plate's placement on every row, filter counts, focus rings) and a frame-by-frame recorder. Use for type foundries, graphic designers, studios, illustrators, architects and photographers whose work list should read in 20 seconds."
license: MIT
---

# Work Index

The page a creative director skims in 20 seconds: every project on one list, set in type, with the evidence beside it. The governing idea: **the work list is a catalogue's list of plates.** The type is the index; each picture is one numbered plate that slides out of the line you are reading, hangs from it like a print pulled from a sleeve, and never covers that line.

**The plate.** Point at a row and the plate appears right there (it never flies in from a corner), revealed by a clip that opens away from the row (460 ms). It hangs 14 px under the row; if there is no room below on the screen it stands 14 px above it instead, but never higher than the top of the list, so it never covers the statement or the controls. When both sides have room it takes the side with less text under it. If neither side has room it shrinks to fit (its caption stays on one line). It follows the pointer sideways on a spring and tilts a little with speed (up to 3.5°). The row's rule on that side thickens, so the row reads as the slot the plate came out of. Other rows fade back; any text the plate sits over fades out completely, so the plate's edge never cuts through a legible word. Moving to another row keeps the same plate and **riffles** the picture inside it: the new one comes in from the direction you moved. Under the picture is a caption the exact width of the picture: `Pl. 02 · Haverland Philharmonic · 2025`. A loop gets a `Loop · 12 s` tag and plays only while it is shown.

**Two row systems** (`"style"`):

- `ledger`: number, a small thumbnail, title, client, discipline, outcome and year on one line, 76 px rows. Four-column grid with portrait pictures.
- `caption`: number, a large title, the client with a place under it, outcome and year, 112 px rows, no thumbnails (the pictures stay hidden until asked for). Three-column grid with landscape pictures.

**Index and Grid.** The switch moves every item with FLIP: the thumbnails grow into the grid's pictures and the number, title, year and client travel to their card (640 ms, 18 ms apart). In `caption` the pictures rise in after the titles land. **The filter** shows each discipline with its count; rows that leave are hidden at once and the rest close up with FLIP, and a live line says how many are shown.

**Phones.** No hover, so each row's thumbnail is the control, with a small "Plate +" label under it (clear of the picture). Tapping it opens the plate inline under the row text, full width at the picture's own shape, with its caption and "Open the case". One plate is open at a time; the label turns to "Close". The title is still a plain link to the case.

**Case pages** (`work/<slug>.html`): the position (`01 / 09 · Commission · 2026`) with a link back to the index, the title set very large, a definition list (client, year, discipline, place, outcome) on an ink rule, the picture full width on the plate colour (a loop plays muted, or shows its poster with controls under reduced motion), the lead sentence, the text, a **Credits** block, links, more pictures, and previous/next with their thumbnails. The ← and → keys move between cases.

**What you can change, honestly.** Every word, picture, loop and link, the order, the disciplines, the row system, the two type pairings and the four colours. The spacing, the plate's placement rule and the motion are the design and stay as they are. Each field has a limit that the build enforces, and the check fails if anything spills, overlaps, scrolls sideways, falls under the size or contrast minimums, hides its focus, or if the plate ever covers its own row.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge. The build uses it to resize the pictures, the check and the recorder use it to open the pages (the scripts find it; set `CHROME_PATH` if they don't).
- The person's pictures: JPG, PNG, WebP or AVIF, one per project, at least 1600 px wide for a sharp case page. A loop is an MP4 or WebM under 4 MB with a poster picture.
- ffmpeg, only for the preview video.
- Internet access when the site is opened, for its Google Fonts.

## Files

- `kit/index.css`: the whole design, scoped to `.wi`: bar, statement, controls, the two row systems, the plate, Grid view, case pages, tablet and phone rules.
- `kit/runtime.js`: the browser runtime, inlined into every index page: the plate (placement, spring, reveal, riffle, the text it sits over), Index/Grid and filter FLIP, the inline plate on phones, keyboard focus, and the recording clock with its fixed script.
- `scripts/build.mjs`: work.json to `out/index.html`, `out/work/<slug>.html` (one per project), `out/embed.html` and `out/media/` (every picture as WebP at 160, 480, 960, 1600 and 2400 px).
- `scripts/kit/schema.mjs`: every field, its limits and the colour rules; lists every problem at once.
- `scripts/check.mjs`: serves the site and checks the index and two case pages at 390, 768, 1024 and 1440 px, and with reduced motion at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills of the index or of a case page, and `--moments` (when nothing on the page is moving).
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/fenn/work.json` (ledger, light) and `examples/halm/work.json` (caption, dark, with one loop), each with its pictures in `media/`.
- `examples/art/draw.mjs`: how the examples' pictures were drawn (in SVG, no photographs); not needed to use the kit.

## Steps

### 1. Collect the work

For each project: a title, the client, the discipline, the year, one line on what changed (with a number if there is one: "licensed by 140 studios in year one", not "Branding"), one picture or a short loop with a poster, its alt text, and for the case page an opening sentence, a few paragraphs if there are any, and the credits (who did what). Also the person's name, a one-line statement, two sentences about them, their email and whether they are taking work.

### 2. Write work.json

Copy `examples/fenn/work.json` (or `examples/halm/work.json`) next to the pictures and change it. Paths are relative to work.json. Projects go newest first unless `"order": "manual"`.

### 3. Build

```bash
node scripts/build.mjs work.json out
```

Every problem is listed at once, with the field and the limit. Warnings (an outcome that reads like a label, a mode that doesn't match the ground colour) don't stop the build. The first build resizes every picture; later builds reuse them until the original changes.

### 4. Check

```bash
node scripts/check.mjs out/index.html
```

One line per size and page, with what was measured, for example `✓ 1440x900 index.html: 86 text pairs, lowest contrast 1.23× its minimum; plate: 8 rows hovered (4 below, 4 above)`. Anything wrong is listed under the line and the check exits with 1.

### 5. Look at it

```bash
node scripts/serve.mjs out
```

Open the address it prints. Point down the list slowly, then fast; press Tab through it; switch to Grid and back; try a filter; open a case and press → a few times; make the window phone-sized and tap a thumbnail.

### 6. Put it on the site

Upload `out/` as it is (index.html, work/, media/). To put the index into a page that already has a header, paste `out/embed.html` inside its `<body>` and keep `work/` and `media/` next to that page.

### 7. Record a preview (optional)

```bash
node scripts/record.mjs out/index.html --moments              # when nothing moves, at 1920x1080
node scripts/record.mjs out/index.html --seconds 16 --poster 3.9
node scripts/record.mjs out/index.html --still 3.9 --size 390x844 --scale 2 --png phone.png
node scripts/record.mjs out/work/<slug>.html --still 0 --png case.png
```

The video follows a fixed script, the same frame for frame on any machine: the page, a scroll to the list, the pointer visits two rows (the plate hangs from each and riffles between them), Grid and back, a filter and back. Take stills and the poster from inside the stretches `--moments` prints. `preview.hover`, `preview.filter` and `preview.open` in work.json choose the rows and filter it uses.

## work.json, every field

| Field | What it is | Limits / default |
| --- | --- | --- |
| `style` | `"ledger"` or `"caption"` | required |
| `site.name` | the person or studio | 1 to 32 characters |
| `site.nav` | links in the bar: `{label, href}` | 0 to 4; label up to 16 |
| `site.availability` | a status line with a dot ("Taking projects from March 2027") | 4 to 44, optional |
| `site.statement` | the one-line statement; one `_turn_` in underscores (lighter weight or italic) | 6 to 70 |
| `site.lede` | two sentences about them; `**bold**` for the name | 20 to 220 |
| `site.email` | shown in the footer of every page | required |
| `site.place` | after the name in the footer | 2 to 40, optional |
| `site.note` | the count line beside the lede (`caption` only) | 4 to 44; default "N projects · first–last year" |
| `theme.mode` | `"light"` or `"dark"` | required |
| `theme.ground` | page colour | `#rrggbb` |
| `theme.ink` | text colour; the muted text is worked out from it | `#rrggbb`, 7:1 on the ground |
| `theme.accent` | the hovered row's number and the availability dot | `#rrggbb`, 4.5:1 on the ground |
| `theme.plate` | the colour behind pictures | `#rrggbb`, optional; default a step off the ground |
| `theme.display` | `"bricolage"` (Bricolage Grotesque with DM Mono) or `"instrument"` (Instrument Serif with Geist and Geist Mono) | required |
| `disciplines` | the filter, in order | 1 to 8; default: in the order they first appear |
| `order` | `"manual"` to keep your order | default: newest first, checked |
| `preview.hover` | the two rows the recording visits (from 0) | default `[1, 3]` |
| `preview.filter` | the filter the recording uses | default the first discipline |
| `preview.open` | the row the phone recording opens | default `1` |
| `projects` | the work | 3 to 40 |
| `projects[].slug` | the case page's file name | lowercase words and hyphens, unique |
| `projects[].title` | | 1 to 34 |
| `projects[].client` | | 1 to 32 |
| `projects[].place` | under the client (`caption`) and on the case page | 2 to 24, optional |
| `projects[].discipline` | one of `disciplines` | 2 to 18 |
| `projects[].year` | | four digits |
| `projects[].outcome` | what changed, in one line | 12 to 64; a warning under 4 words |
| `projects[].image` | `{src, alt}` | jpg, png, webp or avif; alt 4 to 160 |
| `projects[].loop` | `{src, poster, alt, seconds}` instead of `image` | mp4 or webm under 4 MB; seconds 2 to 30 |
| `projects[].case.intro` | the case page's lead sentence | 12 to 140; default the outcome |
| `projects[].case.body` | paragraphs | up to 6, up to 900 characters each |
| `projects[].case.credits` | `{role, name}` | 2 to 12; role up to 24, name up to 60 |
| `projects[].case.gallery` | more pictures: `{src, alt, caption?}` | up to 8 |
| `projects[].case.links` | `{label, href}` | up to 4 |

## Troubleshooting

- **The build says a picture is not found.** Paths in work.json are relative to work.json itself, not to where you run the command. Put the pictures next to it, or write `../photos/x.jpg`.
- **The build says the projects are not newest first.** Reorder them by year, or add `"order": "manual"` if the order is deliberate (a best-first list).
- **The plate shrinks on a short screen.** That is the rule working: it may not cover its row or rise over the controls, so on a window too short for the whole picture it scales to the room it has, down to 30 %. On a normal screen it is full size.
- **The check fails on contrast after changing colours.** `theme.ink` needs 7:1 on the ground (the muted text is worked out from it at 5.4:1) and `theme.accent` needs 4.5:1. The build stops with the exact ratio before the check gets there.
- **A loop does not play.** It plays only while its plate or case page is shown, muted. Under reduced motion it shows its poster and, on the case page, controls. Keep it under 4 MB and encoded as H.264 MP4 (or WebM) so every browser plays it.
- **Chrome is not found.** Set `CHROME_PATH` to the browser's executable; the build needs it to resize the pictures.
