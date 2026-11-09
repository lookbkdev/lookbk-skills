---
name: compare-table-kit
description: "Build the \"us against the alternatives\" section (a vs page, an alternatives page, or the comparison on a pricing page) from one compare.json, set as a fact-checked brief. The product is compared with 2 to 4 alternatives, including doing it yourself or the tool they already have. Every cell is a short fact with a numbered source and a date, never a tick or a cross; rows are grouped by the buyer's real questions, each group states its assumptions, and every row gets a verdict in words. The build refuses a table where nothing else ever wins, unsourced or yes/no cells, a typed tally, and claims about named competitors without dated, linked sources. A tally computed from the verdicts, a \"who should pick the other one\" row, sticky head row and product column, a swipeable two-at-a-time view on phones, a print layout with every source, a paste-in embed, checks at four widths and a frame-by-frame recorder. Use for vs pages, alternatives pages and pricing-page comparisons."
license: MIT
---

# Compare Table Kit (Honest Comparison)

The comparison section that buyers believe. **It is set as a fact-checked brief: every cell is a short claim carrying its footnote and date, every row gets a verdict in words, and the rows where something else wins are printed in exactly the same type as the rows where you win.**

- **Columns.** Your product, then 2 to 4 alternatives: another product, a spreadsheet, a paper diary, running it yourself, the tool they already have. Each is introduced by what it is ("Do it yourself", "Already have it", "Software") and one line on who uses it. Your column is tinted the whole way down.
- **Groups are the buyer's questions.** "What will it cost over a year?", "How long until it is working?", "What happens to my data if I leave?". Each group states its assumptions ("One clinic, three practitioners, about 120 bookings a week") so the numbers can be compared.
- **Cells are facts.** A short fact ("2.5 h a week", "Read-only"), an optional note, and a source mark: a boxed number, or a dashed `est` when it is your own estimate. Point at, focus or tap a mark and the source opens: its kind ("Our study", "Public page", "Independent"), its date and its text, with a link when it has one. The mark is glued to the fact's last word, so it never wraps onto a line of its own.
- **Verdicts in words.** Every row says who is ahead ("Ahead: Hearthbook", "Ahead: the paper diary", "Level: Hearthbook and the spreadsheet"), in the same form whether you win or lose. The winning cell gets an underline in your colour or in the "them" colour; level cells get a dotted one. The "them" colour means one thing only: something else is ahead here.
- **The tally.** At the top, the verdicts counted: "4 of 8 Hearthbook ahead, 1 Level, 3 Something else ahead". The build computes it; it can't be typed.
- **Who should pick the other one.** A last row with one sentence per column, written as each option's best case. Your cell carries the button.
- **Sources.** A numbered list with each source's kind and date, then "How we compared" and an address for corrections.
- **Wide screens** (1180 px of section and up): a label column, then the columns. The head row sticks to the top while the table is in view. **700 to 1179 px:** each row's label and verdict sit above its cells; when the alternatives don't fit they scroll sideways under a product column that stays put on the left, and the head row follows. **Under 700 px (phones):** "Compare Hearthbook with" and one chip per alternative; the pair head (yours filled, theirs beside it) sticks, and the pairs swipe sideways, one alternative at a time. When a row's winner is not one of the two on screen, the verdict says so ("Ahead: Clinicore, not shown"), level verdicts included.
- **Motion.** Only the evidence moves. When a group arrives, its winning underlines draw left to right (420 ms, `cubic-bezier(.2,.7,.2,1)`, 60 ms apart down the rows) and each verdict's square fills as its underline lands. A source opens in 160 ms. The stuck head row gains a rule in 120 ms. Nothing loops, nothing counts up.
- **Reduced motion:** underlines are drawn from the start and nothing transitions. **Print:** the whole table on landscape paper in a light palette, the sources list with every link, no pair view.

**What you can change, honestly.** Every word and figure, the columns (product plus 2 to 4), the groups and rows, the sources, the picks, the button, seven theme colours (contrast enforced at build time and measured again in the check), the display, text and mono faces from a short list, and the offset under a sticky site header. The type scale, the layout, the verdict forms and the motion are the design and stay as they are.

> **WARNING: naming real competitors.** The examples use invented products. If you name a real company or product, mark it `"named": true`. The build then prints a warning and refuses any cell about it that is an estimate, comes only from your own study, has no url, or was checked more than `maxAgeDays` (default 180) ago. Comparative claims about a named company must be true, current and provable; many countries treat a misleading comparison as false advertising. Recheck every source before each publish, keep a copy of each source page as it looked on its date, and don't use their logos. When in doubt, compare against kinds of alternatives ("a spreadsheet", "an all-in-one suite") instead of names.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video and the print picture only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- The facts, with a source and a date for each one, and at least one row where an alternative really is better. Internet access when the page is opened, for the Google Fonts.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/compare.css`: the whole design, scoped to `.ct`: wide, tablet, phone, reduced motion and print. Widths are the section's own (container queries), so the embed fits its column.
- `kit/runtime.js`: the browser runtime, inlined into every build: draw-ins, source pop-ups, the sticky head row and product column, the phone pair view, and the recorded tour.
- `scripts/build.mjs`: compare.json to `out/index.html` (the section on its own page) and `out/compare-embed.html` (the section to paste in).
- `scripts/kit/schema.mjs`: every field and its limits, contrast, and the honesty rules (sources, kinds, dates, verdicts, tally and head counts, named competitors). Lists every problem at once.
- `scripts/check.mjs`: checks the built page at 390, 768, 1024 and 1440 px, with reduced motion, and the print layout.
- `scripts/record.mjs`: the preview video, stills from settled moments, `--moments`, and `--print` (PDF and a picture of the first page).
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/hearthbook/compare.json`: Hearthbook, online booking for small clinics, against a paper diary, a shared spreadsheet and Clinicore; light, editorial serif.
- `examples/brakewater/compare.json`: Brakewater, error tracking for dev teams, against running it yourself, the cloud's own logs, Tracewell and Faultline; dark, wide grotesk.

## Steps

### 1. Collect the facts and the sources

From the person, with them:

- What buyers actually use instead. Include the do-it-yourself option (a spreadsheet, a paper diary, running it yourself) and the tool they already have; those are what most buyers really weigh you against.
- The 3 to 6 questions buyers ask before they switch, and for each, the scenario the numbers are for (team size, volume, period).
- For every cell, the fact and where it comes from: your price page, their public price page, an independent test, your own study or survey, or your own estimate. Note the date each one was checked.
- The rows where an alternative is better. There is always at least one (cost, setup time, working offline, owning the file). The build will not run without it.

Never invent a figure. If a fact isn't known, leave the row out. If the person wants to name a real competitor, read the warning above to them first.

### 2. Write compare.json

Copy the example closest to the person's case (`examples/hearthbook/compare.json` for a light, editorial page; `examples/brakewater/compare.json` for a dark, technical one) and replace everything. Give each row a `verdict`: the id of the column that is ahead, or `{ "level": [ids] }`. Write the head without numbers, or with numbers that match the table: the build checks "8 questions", "four things" and "ahead on 4" against what it computes.

### 3. Build

```
node <skill>/scripts/build.mjs compare.json out
```

It lists every problem at once and writes nothing until they are fixed: a field out of range, a colour pair under its contrast minimum, a cell without a source, a source without a kind or date, a yes/no cell, a comparison ("faster", "cheaper", "best") resting on an estimate, a head count or tally that disagrees with the rows, a typed tally, no row where an alternative is ahead, and any of the named-competitor rules. A warning box is printed whenever a real competitor is named.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, and fails on:

- script errors, and sideways scrolling anywhere down the page
- page text under 16 px on a phone or 14 px elsewhere (labels: 12 px)
- text under WCAG AA contrast against what is behind it (4.5:1, or 3:1 from 24 px), the open source pop-up included
- text cut off, off the screen, or within 16 px of a phone's edge
- a source mark wrapped onto a line of its own, away from its fact
- a tally that disagrees with the verdicts, or a table with no row where an alternative is ahead
- underlines not drawn once their group has arrived, or drawn twice
- a head row that does not stick; when the table scrolls sideways, a product column that does not stick, a head row that does not follow, or a table that can't be reached by keyboard
- a source that does not open from the keyboard, does not show its kind ("Our study" for your own figures), date and text, does not light its line in the list, or does not close on Escape and give focus back to its mark
- on a phone: chips that don't swipe the pair, a swipe that doesn't move the chips, a verdict about a column not on screen without "not shown"
- a keyboard focus that can't be seen (it presses Tab through the page)
- with reduced motion, anything that animates

Then it lays the page out for print and fails unless the whole table and every source print, with no pair view. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints on a laptop and a phone. Scroll the table, open a few sources with the mouse and with Tab and Enter, narrow the window until the alternatives scroll, swipe the pairs, and print it.

### 6. Put it on the page

Paste `out/compare-embed.html` where the comparison goes. It brings its fonts, styles and script; every class starts with `ct-`. Use one per page. If the site has a sticky header, set `stickyTop` to its height so the head row sticks under it. Don't put the section inside an element with `overflow: hidden`, or the head row can't stick.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --poster 1.4
node <skill>/scripts/record.mjs out/index.html --still 3.4 --size 390x844 --scale 2 --png phone.png
node <skill>/scripts/record.mjs out/index.html --print --png page.png
```

On a desktop the tour rests on the head, scrolls to the table with its head row stuck, opens a source from your own study about an alternative, draws each group's verdicts and ends on the picks and sources. On a phone it shows the pair view, swipes, opens a source sheet, scrolls a group and swipes again. `--moments` prints `{ length, settled, moments }` at the size you give; take every still from inside a settled stretch (`--still` warns when a time is not).

## compare.json, every field

Top level: `lang` (default `en`), `brand` (up to 40 characters, used in the page title), `stickyTop` (0 to 160 px, default 0), `maxAgeDays` (30 to 365, default 180: how fresh sources about named competitors must be). There is no `tally` field: the build refuses one.

`theme`, colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `mode` | `light` or `dark` | must match `paper` |
| `paper` | | the page behind the section |
| `column` | | your column's tint |
| `ink` | 7:1 on `paper`, `column` and `themWash` | text; the mute is derived at 4.8:1 on all three |
| `us` | 4.5:1 on `paper`, 3:1 on `column` | your verdicts, headline turn, filled head and button |
| `onUs` | 4.5:1 on `us` | text on your filled head and button |
| `them` | 4.5:1 on `paper`, 3:1 on `themWash` | the "something else is ahead" colour, and nothing else |
| `themWash` | | the tint of a cell where an alternative is ahead |
| `display` | `instrument-serif`, `newsreader`, `bricolage-grotesque` | the serifs turn in italic, the grotesk by colour |
| `text` | `source-sans-3`, `ibm-plex-sans` | page text, lining figures |
| `mono` | `ibm-plex-mono`, `jetbrains-mono` | marks, verdicts and labels |

For print, `us` and `them` are darkened automatically until they reach 4.5:1 on white.

`head`: `eyebrow` (1 to 3 items, up to 32 characters; the third drops on phones), `headline` (up to 72, exactly one `_turn_`), `lede` (up to 220; `**bold**` allowed). Any count written next to "questions", "rows", "alternatives", "options", "things", "ways" or "tools", and any "ahead on N", "behind on N" or "level on N", must equal what the build computes.

`product`: `id` (lowercase, up to 16), `name` (up to 24), `desc` (up to 60).

`alternatives`: 2 to 4 × `{ id, name (up to 28, the column head), short (up to 16, the phone chip), called (up to 26, how a verdict names it: "the spreadsheet"), desc (up to 60), kind, invented | named }`. `kind` is `diy` (Do it yourself), `have` (Already have it), `software`, `service` or `nothing` (Doing nothing). Exactly one of `"invented": true` or `"named": true`.

`sources`: 1 to 20 × `{ id, kind, text (up to 110), asOf, period?, url?, estimate? }`. `kind` is `own` (your study, survey or estimate; shown as "Our study"), `third-party` (an independent test or report; "Independent") or `public` (a public page such as a price list; "Public page"). `asOf` is the date it was checked (YYYY-MM-DD, not in the future). `period` (up to 28) replaces the date in the pop-up for studies run over time ("Jun to Aug 2026"). `url` must start with https. `"estimate": true` (always `own`) shows the mark as `est` and the kind as "Our estimate". Sources are numbered in this order.

`groups`: 1 to 6 × `{ question (up to 60), assumes (up to 110, required), rows }`. `rows`: 1 to 6 × `{ label (up to 40), verdict, cells }`. `verdict` is a column id or `{ "level": [2 or more ids] }`; a level that leaves your product out counts as something else ahead. `cells` has every column id: `{ fact (up to 28), note? (up to 60), source (a source id) }`. A fact can't be yes, no, true, false, a dash or a tick. A fact or note resting on an estimate can't say faster, cheaper, better, best, easier, only, leading, more than, less than or beats.

`picks`: one sentence per column id (up to 200), shown as "Pick X if". `cta`: `{ label (up to 32), href (https://, /, # or mailto:) }`. `method` (up to 360): how you compared. `corrections` (optional): an email address shown under the sources.

## Troubleshooting

- **Build says no row has an alternative ahead.** Find the row where something else really is better (it is cheaper, it is already set up, it works offline, you already own the file) and give it that verdict. A table that never loses is the one buyers stop reading.
- **Build says the head's count disagrees.** The headline or lede says "seven questions" or "ahead on 6" and the rows say otherwise. Change the words to the computed number, or drop the number.
- **Build refuses a cell about a named competitor.** Each of its cells needs a public or independent source with a url, checked within `maxAgeDays`, not an estimate and not only your own study. Recheck the source, update `asOf`, or compare against the kind of product instead of its name.
- **Build says a comparison rests on an estimate.** "Faster" or "cheaper" needs a measured or published source. Cite one, or state the fact without the comparison.
- **Check says a source mark sits on its own line.** Something in your page's CSS overrides `.ct-nb` (the no-break span that holds the last word and its mark). Remove the override, or shorten the fact.
- **The head row doesn't stick on your site.** An ancestor of the section has `overflow: hidden` or `auto`. Remove it, or set `stickyTop` if a site header covers the head row.
- **The table scrolls sideways on a laptop.** The section is narrower than 1180 px and there are 4 alternatives; that is the designed tablet layout, with your column pinned. Give the section more width to see every column at once.
