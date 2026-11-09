---
name: spec-sheet-kit
description: Build the technical specifications section of a hardware product page from one spec.json, set as an engineering drawing and its schedule. The product is drawn in true orthographic views (plan, elevations, a detail at 2:1, a hatched section) with drafting line weights, balloons, dimension lines, notes, a title block and a projection symbol, all from the config. Every part's balloon number is its line number in the table, and pointing at a line lights its part or dimension on the drawing, and the reverse. Units switch between mm and inches and between kg and pounds, with the rounding rules stated in the config and printed in the drawing's notes. A compare mode sets 2 or 3 models side by side. Values the models share are written once, values that differ get a delta, and the other models appear on the drawing as phantom lines with a tabulation block. The build checks that every drawn dimension measures what the table says, that each part is the same size in every view, and (for battery packs) that the cells drawn fit the stated configuration and that energy equals voltage times capacity. Prints as one landscape A4 or Letter sheet. The only motion is the dimension lines drawing in once and the highlights. Builds a self-contained page and a paste-in embed, with checks at four widths and a frame-by-frame recorder.
license: MIT
---

# Spec Sheet Kit

The specifications section of a physical product's page, done the way an engineer would hand it over. **The section is one engineering drawing and its schedule.** The product is drawn in orthographic views from the same numbers the table prints. Every part on the drawing carries the balloon number of its line in the table, and pointing at either one lights up the other.

- **The drawing.** An A3 landscape frame (420 × 297 units) with zone references (1 to 8 across, A to F down). The views sit in true projection, third or first angle. Visible outlines are 0.5 mm, hidden and centre lines 0.25 mm and dimension lines 0.18 mm, scaled to the sheet. On screen they are held to at least 1.75, 0.9 and 0.75 px so the outline always leads. Extras: dash-dot centre lines through circles, a detail view called out by a dashed circle and clipped to its own ring, and a section view called out by a cutting-plane line and hatched. There are notes written from your units, rounding and tolerance, and a title block (owner, title, drawing number, scale, units, revision, sheet) with the projection symbol drawn for the chosen angle.
- **The schedule.** Groups lettered A, B, C, as real tables. Each line has a mark (a balloon number for a part, a small dimension glyph for a dimension), a label and note, the value in tabular figures, and the converted value in its own column. "In the box" and "Compliance" sit under the drawing as a numbered list and ruled marks.
- **Linking, both ways.** Hover or focus a line, and its part takes the accent colour with a 45° hatch, its dimension turns accent and its balloon fills, while the rest of the drawing steps back. Hover a part on the drawing, and every line that names it lights. A click or tap pins the selection.
- **Units.** mm or in, kg or lb. The table, the figures on the drawing, the notes and the title block's UNITS cell all follow the switch. Metric is the source; the other unit is converted and rounded to the step you set (for example 0.01 in and 0.1 lb), and the notes say so.
- **Compare (2 or 3 models).** One column per model, lettered A, B, C. A value the models share is written once with a dotted leader across the columns, and a line that differs gets a delta. On the drawing, the drawn model is solid and the others are phantom lines with letters at their ends. A dimension that differs becomes a letter (`L`) with a small tabulation block giving each model's value, the way a drawing for a family of parts does it.
- **Motion.** Only two things move. The dimensions draw in once, when the sheet first comes into view: the extension lines take 260 ms, then the dimension line grows from its middle out to both arrows in 420 ms (`cubic-bezier(.6,0,.2,1)`), then the arrowheads and the figure appear, with a 90 ms stagger between dimensions. Highlights take 180 ms. After a change of model or units, only the dimensions whose figure changed draw again. Numbers never count up.
- **Narrow screens.** The whole sheet needs about 740 px to hold 12 px labels. Narrower than that (phones, tablets, the two-column layout at 1024), the drawing shows one view at a time, cropped to that view, with tabs to switch. Up to 900 px the layout stacks and the drawing stays pinned at the top while the schedule scrolls under it. Tapping a line jumps to the view that shows it. Compare on a phone puts the label on one line and the models' values in columns under it.
- **Print.** "Print or PDF" prints one landscape sheet (A4 or Letter): the drawing at full drafting weights in black on white, the schedule beside it, and the list and marks under it.
- **Reduced motion** shows the dimensions already drawn, and highlights change without transitions. **Without JavaScript**, the page shows the drawing and the schedule as built, in the primary units.

**What you can change, honestly.** Every word and value, the models (1 to 3), the drawing's views, parts, dimensions and balloons, the units and rounding, six theme colours (contrast enforced at build time and measured again in the check), the display face, the paper size for printing, and the preview's tour. The type scale, the line weights, the layout and the motion are the design and stay as they are.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks, the print check and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video and the print picture only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- The product's real dimensions, in millimetres, and a rough sketch of its outline in each view (see step 2). Internet access when the page is opened, for the Google Fonts.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/core.js`: the drawing, the schedule and the unit maths, used by the build in Node and by the page in the browser.
- `kit/runtime.js`: the browser runtime, inlined into every build. Redraws on model, unit and compare changes, links lines and parts both ways, runs the draw-in clock, the phone views and the recording tour.
- `kit/spec.css`: the whole design, scoped to `.ss`: desktop, tablet, phone, reduced motion and print.
- `scripts/build.mjs`: spec.json to `out/index.html` (the section on its own page) and `out/spec-embed.html` (the section to paste in).
- `scripts/kit/schema.mjs`: every field and its limits, contrast, and the drawing checks (dimensions against the table, views against each other, frame, cells, products). Lists every problem at once.
- `scripts/check.mjs`: checks the built page at 390, 768, 1024 and 1440 px, with reduced motion, and prints it to PDF.
- `scripts/record.mjs`: the preview video, stills from settled moments, `--moments`, and `--print` (PDF and a picture of the printed sheet).
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/fennick/spec.json`: Fennick Works F-2 task lamp, light, two models, plan, front, side and Detail A at 2:1.
- `examples/ampwright/spec.json`: Ampwright PK-500, PK-625 and PK-750 battery packs, dark, compared, with Section B-B and the cell checks.

## Steps

### 1. Collect the facts

From the person, or from their datasheet:

- Every model's name and the facts that differ between them.
- The dimensions in millimetres and the masses in kilograms. Metric is the source; the kit converts to inches and pounds. Ask which rounding they publish (0.01 in and 0.1 lb are the defaults), and the tolerance on overall sizes.
- Power, materials, what is in the box, and the standards and marks the product actually holds (CE, UKCA, IEC numbers, IP rating). Only list a mark the product has.
- The parts that matter to a buyer, each with a short name: these become the numbered balloons.

Use their real figures. If a figure isn't known, leave the line out rather than inventing it.

### 2. Draw the product

Each view is a list of shapes in **product millimetres**, with x to the right and y up (the build turns them the right way up on the sheet):

- `rect: [x, y, width, height]` (optional `r` for rounded corners), `circle: [cx, cy, r]`, `poly: [[x, y] ...]`, or `d`: path data using absolute `M L H V C Q Z` only.
- Each shape names its `part`. A part drawn in two views must be the same size in both, within `drawing.tolerance`. The build checks this, using each view's `axes` (`["x", "y"]` for a front elevation, `["x", "z"]` for a plan, `["z", "y"]` for a side view).
- Draw nearer parts later: they cover the ones behind. Mark hidden edges with `"line": "hidden"`, open lines (a cable) with `"open": true`, and cut faces in a section with `"section": true`.
- Put the views on the sheet with `origin` (where the product's 0, 0 lands, in sheet units) and `scale` (0.3333 for 1:3). In third-angle projection the plan goes above the front elevation and the right side view to its right. Every view must stay inside the frame, 10 to 410 across and 10 to 287 down.
- Give each view a `crop` `[x0, y0, x1, y1]` on the sheet: what a phone shows when that view is chosen.
- A model whose geometry differs overrides a view with `models: { "F-2L": { "shapes": [...], "balloons": [...] } }`. In compare mode, `outline` (one shape per model) is what is drawn as a phantom line for the other models.

Copy the example closest to your product and edit it: `examples/fennick/spec.json` for an object with a detail view, `examples/ampwright/spec.json` for a family of lengths with a section.

### 3. Dimension it

Each dimension in `drawing.dims` names the `view`, the length `row` in the schedule it shows, `kind` (`h` or `v`), the two points `a` and `b` in product mm, and `offset` (how far from the object the dimension line sits, in sheet units, negative for above or left). Add `dia: true` for a diameter (Ø), and `symbol` (one capital letter) to tabulate it in compare mode when models differ. The build measures `a` to `b` and fails if it differs from the table's value by more than `drawing.tolerance`. So if the drawing says 480, the table says 480.

### 4. Build

```
node <skill>/scripts/build.mjs spec.json out
```

It lists every problem at once and writes nothing until they are fixed. The problems it finds include a field out of range, a colour pair under its contrast minimum, a dimension that doesn't measure what the table says, a part that is a different size in two views, a view outside the frame, a balloon on a part that isn't drawn in its view, and an energy that isn't voltage times capacity. For a battery pack it also finds a cell configuration the drawn housing can't hold. It prints notes for what it confirmed (for a pack: the cells needed against the cells that fit).

### 5. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, and fails on:

- script errors, and sideways scrolling anywhere down the page
- page text under 16 px on a phone or 14 px elsewhere (labels: 12 px), and drawing text under 12 px as shown on screen
- text under WCAG AA contrast against what is behind it (4.5:1, or 3:1 from 24 px), on the page and on the drawing
- text cut off, off the screen, or within 16 px of a phone's edge
- labels on the drawing that overlap each other or a balloon (it measures again in compare mode and in inches)
- the dimensions not drawn after the sheet arrives, or drawn more than once
- a line that doesn't light the drawing, or a part that doesn't light its line
- the unit switch not converting the table, the drawing figures and the notes
- compare mode without per-model columns or phantom lines
- a tapped line not jumping to its view when the drawing shows one view at a time
- a keyboard focus that can't be seen (it presses Tab through the page)
- with reduced motion, anything that animates or redraws

Then it prints the page to PDF and fails unless the sheet is one page. Fix and build again until it prints `all checks passed`.

### 6. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints, on a laptop and on a phone. Point at a few lines, switch to inches, compare the models, and press Print or PDF.

### 7. Put it on the product page

Paste `out/spec-embed.html` where the specifications section goes. It brings its own fonts, styles and script, and every class starts with `ss-`. Use one per page. The drawing stays beside the schedule while it scrolls, so don't put the section inside an element with `overflow: hidden`.

### 8. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --poster 2.2
node <skill>/scripts/record.mjs out/index.html --still 3.9 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --print --png sheet.png
```

The video follows `tour`: the dimensions draw in, then each step points at a line, a part or a control and holds. `--moments` prints `{ length, rest, steps, settled }`: the stretches where nothing moves, at the size you give. Take every still and poster from inside one; `--still` warns when a time is not settled. `--print` writes the PDF exactly as the browser prints it, and with `--png`, a picture of that page.

## spec.json, every field

Top level: `lang` (default `en`), `brand` (up to 40 characters, set in the title block), `drawn` (the model drawn solid in compare mode), `start` `{ model, compare }` (how the section opens; compare needs 2 or 3 models).

`theme`, colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `mode` | `light` or `dark` | the paper must match |
| `paper` | | the page behind the section |
| `sheet` | | the drawing's stock (drafting film, or instrument black) |
| `ink` | 7:1 on `paper` and on `sheet` | text and drawing lines; the mute is derived at 5:1 |
| `accent` | 4.5:1 on `paper` and `sheet` | the selection, deltas, hatching |
| `onAccent` | 4.5:1 on `accent` | a filled balloon's number |
| `turn` | 3:1 on `paper` | the headline's turn |
| `display` | `newsreader`, `ibm-plex-serif`, `archivo` | Newsreader and IBM Plex Serif turn in italic; Archivo is set wide and turns by colour |
| `text` | `ibm-plex-sans`, `archivo` | page text, with tabular lining figures |
| `mono` | `ibm-plex-mono`, `jetbrains-mono` | drawing lettering and labels |
| `radius` | 0 to 12 (px) | default 0; buttons and view tabs |

`head`: `eyebrow` (1 to 3 items, up to 28 characters each; the third drops on phones), `headline` (up to 64 characters; one `_turn_`; `\n` for the line break), `lede` (optional, up to 180).

`models`: 1 to 3 × `{ id (up to 16), name (up to 16), sub? (up to 24, shown as the button's tooltip) }`.

`units`: `length` `{ primary: mm | in, step: { mm, in } }` and `mass` `{ primary: kg | lb, step: { kg, lb } }`. Each step is one of 1, 0.5, 0.25, 0.2, 0.1, 0.05, 0.01, 0.005, 0.001. Defaults in the examples: mm 1, in 0.01, kg 0.1, lb 0.1. Rounding is half away from zero.

`groups`: 1 to 8, each `{ title (up to 28) }` with exactly one of:

- `rows`: 1 to 14 lines, each `{ key (letters, digits, -), label (up to 32), note? (up to 40), parts? [part ids] }` with exactly one value: `length` (mm), `mass` (kg), `number` with `unit` (up to 6 characters) and optional `extra` (up to 12, shown in the converted column, e.g. "CRI 95"), or `text` (up to 32). Any value can be per model: `{ "PK-500": 352, "PK-625": 398 }`.
- `list`: 1 to 12 items (up to 48 characters), numbered, for what is in the box.
- `marks`: 1 to 12 marks (up to 32 characters), for standards and warranties.

`drawing`:

| Field | Range | Notes |
| --- | --- | --- |
| `number`, `rev`, `scale` | up to 16, 3, 6 characters | the title block |
| `projection` | `third` or `first` | the symbol and your view layout |
| `tolerance` | 0.05 to 5 (mm) | for dimensions against the table and views against each other |
| `toleranceNote` | up to 26 characters | note 4, e.g. "Overall sizes ±1 mm." |
| `notes_at` | [x, y] | where the notes start on the sheet |
| `title_block` | [x, y, width, height, [col1, col2, col3]] | the bottom row's column offsets |
| `tab` | [x, y] | where the tabulation block goes in compare mode |
| `tabNote` | optional | default "B solid; A and C phantom." from the models |
| `parts` | 1 to 20 × `{ id, no (1 to 99), name }` | the balloons |
| `views` | 1 to 6 | see below |
| `dims` | | see step 3 |
| `cells` | optional | battery packs, see below |

Each view: `id`, `label` (up to 24), `short` (the phone tab, up to 12), `origin` [x, y], `scale` (0.01 to 10), `axes` (two of x, y, z), `crop`, `shapes`, and optionally `label_at` [x, y, anchor], `sub` (a second label line, e.g. "Scale 2:1"), `centers` (`[cx, cy, r]` for centre lines), `balloons` (`{ part, at: [x, y] in product mm, offset: [dx, dy] in sheet units }`), `detail` (`{ at, r, letter }`: a callout circle on this view), `ring` (a detail view's own circle radius; its shapes are clipped to it), `partial: true` (a detail: not compared with the other views), `cut` (`{ x, from, to, letter }`: a cutting plane), `outline` and `tags` (compare mode), and `models` (per-model overrides).

`drawing.cells` (optional): `{ view, part, diameter, length, wall, bodyView, bodyParts, row, voltRow, ahRow, cellV, cellAh }`. The build reads `S` and `P` from the `row` text (like "10S5P"). It counts the cells drawn in the section, takes the body length from `bodyParts` in `bodyView`, and fails unless cells across × the cells that fit along (body minus two walls, divided by the cell length) is at least S × P. It also checks that no two cells overlap and every cell sits inside the housing, that the voltage is S × `cellV` (within 2%) and that the capacity is no more than P × `cellAh`.

`checks.product` (optional): `[{ of: ["v", "ah"], is: "wh", within: 0.01 }]`: the product of those number lines must equal the other, within a share, for every model.

`tour` (the preview video, up to 8 steps): `{ row }`, `{ part }`, or `{ set: { len, mass, model, compare } }`. Each step moves for 0.6 s and holds for 1.3 s, plus the time for any dimensions that redraw.

`print`: `{ paper: "A4" | "Letter" }`, default A4. Always landscape, one sheet.

## Troubleshooting

- **Build says a dimension is drawn at one size and the table says another.** The drawing's points `a` and `b` and the table must agree within `drawing.tolerance`. Fix whichever is wrong. Usually the shape was sketched by eye. Move its edge to the real figure, and move `a` or `b` with it.
- **Build says the views disagree on a part.** The part is wider in one view than in another (a knuckle 28 mm across in the side view but 18 mm deep in the plan). Check which axis the build names and make both views agree. Remember each view's `axes`.
- **Build says a view runs outside the frame.** Move its `origin` or use a smaller `scale`. Models with longer geometry need the room too, because every model is checked.
- **Check says drawing labels overlap.** Move a balloon's `offset`, a dimension's `offset`, `notes_at`, `tab` or a view's `label_at`. The check names both labels. It looks at the widest sheet, in compare mode and in inches, where figures are longest.
- **Build says the cells don't fit.** The section shows fewer cells across than the configuration needs for that body length. Lengthen the body, draw the cell grid you really use, or correct the S and P figures.
- **The drawing shows one view at a time on a laptop.** The sheet is narrower than 740 px, so 12 px lettering wouldn't fit on the whole A3 sheet. Give the section more width, or keep the tabs. They are the designed state, not a fallback.
- **The printed sheet runs onto a second page.** Too many lines for one page. Shorten notes and labels, or move a group into the list.
