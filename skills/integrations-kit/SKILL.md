---
name: integrations-kit
description: Build the integrations section and directory of a software product from one integrations.json. Instead of a wall of app icons, choosing an integration draws its wiring like a terminal strip - your product on the left showing where each record lands, the other app on the right showing what it is called there, one wire per record with its direction, trigger and cadence, and the records that never cross drawn as open switches with the reason - next to a setup bar where every step is drawn to its minutes (yours, then ours), who built it, which plans include it and which side wins when both change. Packets travel each wire at one speed; how often a record crosses sets the gap between packets, so cadence reads as rhythm. Below it, a directory with search, category and status filters (native, via webhook, community, coming) whose counts follow each other, rows that slide into place, an empty state that answers from the not-supported list, and that honest list itself. Every number on the page is counted from the lists; the build refuses typed numbers that disagree. On a phone the chosen app opens in place and its wiring stacks vertically with arrows and words for each direction. Self-contained page and paste-in embed, a check at four widths (text size and contrast, 3:1 for wires, packets and chips, no label touching another label or any wire, the packet rule, keyboard, filters, reduced motion, no JavaScript) and a frame-by-frame recorder.
license: MIT
---

# Integrations

The section a buyer reads before they connect anything. The governing idea: **an integration is a contract, not a logo.** Pick one and the page draws what actually crosses: which records, which way, on what event, how often, and what stays where it is. The ones you do not support are listed with what to do instead.

**What is on the page:**

1. **Head**: eyebrow, a headline with one turn in the accent, a lede, and three ruled facts counted from the config: integrations, native ones, and how many you do not support ("listed below").
2. **The rail** (a real tablist): the featured apps, each with its drawn mark, name and category, a 3 px accent rule on the chosen one, "10 more in the directory", and a three-line key (a wire with a packet, an open switch, your minutes then ours).
3. **The stage** for the chosen app: its mark, "Fennick + Tillwright", one line, the status chip and the Connect button (for an app that is coming, its date instead).
4. **The wiring**. Two nodes, drawn like a terminal strip. The left node lists where each record lands in your product ("Sales journal"); the right lists what it is in the other app ("Z-report"). One straight wire per record joins the two rows, with pins at both ends, an arrow in the direction of travel (two for "both"), the record above the wire and the trigger and cadence below ("When the till is closed · once a day"). Under a dashed rule, **Stays in Tillwright**: the other app's node runs longer than yours, and each record that never crosses ends in an open switch with the reason ("never leave the till"). An app that is coming has its wires dashed and no packets.
5. **Setup**: a bar where each step is as long as its minutes (yours in the accent, ours hatched), the numbered steps, and four terms: built by, plans, if both change (which side wins), and how long the sync log is kept.
6. **The directory**: "All 16 integrations", a search box, category chips and status chips with counts, then a ruled table: mark, name and one line, category, `← in → out` (records into and out of your product), your setup minutes, status, and a "Wiring" link that opens that app in the stage (an app that is not featured joins the rail as "From the directory").
7. **Not supported, and what to do instead**: the thing, why, and the workaround, with a link to ask for an integration.

**The packet rule.** Every packet moves at 150 px a second on every wire at every width. A record's cadence sets only the gap between packets on its wire:

| Cadence | Gap between packets |
| --- | --- |
| instant, or every / within up to 60 s | 0.9 s (a stream) |
| up to 15 min | 1.8 s |
| up to 1 h | 3.2 s |
| up to 6 h | 5 s |
| longer: daily, weekly | 8 s |

Each wire starts 0.37 s after the one above it, so packets never march in step. The check fails a wire whose gap is not the one its cadence gives, gaps that shrink as cadence slows, any packet not moving at 150 px/s, and any packet off its wire.

**Layouts.** From 1100 px: the rail beside the stage. 700 to 1099 px: the tabs in a grid of three (two under 861 px) above the stage, the setup and terms stacked. Under 700 px: a list. Each featured app is a 64 px row; the chosen row says "← 3 in · → 1 out · 5 min setup" and opens in place. Its wiring stacks vertically: your product is a bar at the top ("lands as"), the other app a bar at the bottom ("starts as"), one vertical wire per record between them, and beside each record a line in words and arrows ("↑ into Fennick", "↓ out to Tillwright", "↕ both ways") with two arrowheads on its own wire. At most 3 records show; the rest sit behind "+2 more records". The records that stay behind rise from the bottom bar and stop at open switches. Without JavaScript, every app's wiring is a table (record, direction, when, what it is on each side), its records that stay behind and its setup steps, each in a `<details>`; the directory is a plain table.

**Motion.** Easing `cubic-bezier(.2,.7,.2,1)`. When an app is chosen, each wire draws from the side that sends (520 ms, 80 ms apart), its words fade in as it passes halfway (220 ms), the open switches swing open last (200 ms), and only then do the packets start. On the first view this waits until the stage is 20% on screen. Filters and search slide the rows that stay into their new places (260 ms) and fade in the rows that arrive (200 ms); rows that leave go at once. The rail's rule slides (280 ms). The page sets `data-settled` when nothing is drawing or sliding (packets in steady flow count as settled). **Reduced motion**: everything is drawn at once and each wire shows one packet parked a third of the way from its sender.

**What you can change, honestly.** All copy, your product's name and mark, the apps (4 to 60) and which 3 to 8 are featured, every record, direction, trigger and cadence, what stays behind, the setup steps and minutes, the terms, the unsupported list, the categories, seven theme colours (contrast enforced at build time and measured again in the check) and the display face (Newsreader or Archivo). The diagram's drawing language, the packet rule, the spacing and the motion are the design.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the check and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- Internet access when the page is opened, for the Google Fonts. Without them, system fonts stand in.

This skill's folder is `<skill>` below: the folder this SKILL.md is in.

## Files

- `kit/integrations.css`: the whole design, scoped to `.ik`: the head, the rail, the stage, the diagram's drawing styles, setup, the directory, the not-supported list, the no-JavaScript tables, the tablet and phone rules.
- `kit/runtime.js`: the browser runtime, inlined into every build. Lays out and draws the wiring (measuring every label and wrapping it so none touches another label or a wire), runs the draw-in, the switches and the packets on one clock, the tablist and its keys, the phone list, search and filters with their counts and the sliding rows, and the recording clock (`?ik-record=1`).
- `scripts/build.mjs`: integrations.json to `out/index.html` (a short demo page around the section) and `out/integrations-embed.html` (the section to paste in).
- `scripts/kit/schema.mjs`: every field, its limits, the colour rules, the cadence grammar and the packet rule; lists every problem at once; counts every number the page shows.
- `scripts/kit/build.mjs`: writes the section, the app marks and the no-JavaScript tables.
- `scripts/check.mjs`: serves the page and checks it at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440, and with JavaScript off at 390 and 1440.
- `scripts/record.mjs`: the preview video, stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at.
- `examples/fennick/integrations.json` (a bookkeeping product, light) and `examples/bayline/integrations.json` (a warehouse management system, dark).

## Steps

### 1. Collect the contracts

From the person, their docs or their current integrations page, for each app:

- **Its name, category and status**: native (you build and support it), via webhook (documented, the customer wires it), community (kept up by users), or coming (with a date or a plain condition like "When their feed opens").
- **Every record that crosses**: what it is called in the other app, what it becomes in yours, which way it goes, what starts it and how often. Ask for the real cadence ("every 15 min", "within 1 h", "daily at 02:00"), not "real time".
- **What does not cross and why**: the records people ask about ("Customer names: never leave the till").
- **Setup**: each step, who does it and how many minutes it takes; what you do in the background.
- **Terms**: who built it, which plans include it, which side wins when both change, how long the sync log is kept.
- **What you do not support**, why, and what to do instead, with a few words people would search for.

Draw each app's mark from a shape and one cut (below). Never use another company's logo or a lookalike.

### 2. Write integrations.json

Copy the example closest in spirit and replace every value:

- `examples/fennick/integrations.json`: Fennick, bookkeeping. 16 apps in 7 categories (8 native, 3 via webhook, 3 community, 2 coming), 6 featured, 5 things not supported. Newsreader on warm paper with fountain-pen blue.
- `examples/bayline/integrations.json`: Bayline, warehouse management. 12 apps in 6 categories (6 native, 2 via webhook, 2 community, 2 coming), 6 featured, 4 things not supported. Archivo condensed caps on near-black with hi-vis yellow.

### 3. Build

```
node <skill>/scripts/build.mjs integrations.json out
```

It lists every problem at once and writes nothing until they are fixed: a typed number that disagrees with the lists (`stated`, an app's `minutes`, or "20 integrations" in the copy when there are 16; write `{count}` and the build fills it in), a cadence it cannot read, a featured or selected id that is not an app, a category not declared, an app that is coming without a date or with setup steps, an app with no step for the person, a line too long for its place, a colour pair under its minimum, a mark whose cut does not read on its shape, an exclamation mark or an em dash.

### 4. Check

```
node <skill>/scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px, with reduced motion at 390 and 1440 and with JavaScript off at 390 and 1440. With JavaScript it chooses every featured app in turn (on a phone it also opens the hidden records) and fails on:

- script errors and sideways scrolling
- text under 16 px on a phone or 14 px elsewhere (labels: 12 px), in the page and in the drawing
- text under WCAG AA contrast against the colour actually behind it (in the drawing, the node or the page)
- wires, pins, arrows, packets, node frames, open switches, chips, the setup bar and app marks under 3:1
- any diagram label touching another, crossing any wire, leaving the drawing or the screen, or running out of its node
- the packet rule broken (gap, ordering, speed, packets off their wire), packets moving under reduced motion, or an app that is coming showing packets
- Arrow keys, Home and End on the tablist not moving the selection and the focus together, or more than one tab selected; on a phone, a row that does not open its app in place
- the directory showing rows that do not match, a chip count that disagrees with its rows, rows still sliding after 1 s, a search for a not-supported keyword that does not answer from the list, a search with no match and no empty state
- with JavaScript off: an app without its wiring table, or a table without one row per record

Each line reports the text pairs measured and the lowest contrast as a multiple of its minimum, the marks measured and the lowest of them, how many diagram labels were checked against how many wires, the packets found on their wires, and the directory's row counts. Fix and build again until it prints `all checks passed`.

### 5. Look at it

```
node <skill>/scripts/serve.mjs out
```

Open the address it prints. Choose a few apps, search for something you do not support, and look on a phone.

### 6. Put it on the site

Paste `out/integrations-embed.html` where the section belongs. It brings its own fonts, styles and script, and every class starts with `ik-`. Use one per page. Point `cta.href` at your connect flow; the button links to `cta.href/<app id>`.

### 7. Record a preview (optional)

```
node <skill>/scripts/record.mjs out/index.html --moments
node <skill>/scripts/record.mjs out/index.html --seconds 23.5 --poster 3.8
node <skill>/scripts/record.mjs out/index.html --still 3.8 --size 390x844 --scale 2 --png phone.png
```

The video follows a fixed 23.5 s script: 1.6 s on the head, a move to the panel, the first three featured apps wired one after another (at 0.4, 5.0 and 9.6 s), the directory filtered to Native, a category word typed in three keystrokes, a search for something you do not support, then the not-supported list. `--moments` prints the settled stretches; take stills and posters inside them.

## integrations.json, every field

Top level:

| Field | Range | Default | Notes |
| --- | --- | --- | --- |
| `brand` | 1 to 18 characters | required | your product; it names the left node |
| `mark` | `{ shape, cut, color, ink }` | required | your product's mark, drawn like the apps' |
| `lang` | language tag | `en` | |
| `eyebrow` | up to 52 | required | `{count}`, `{native}`, `{webhook}`, `{community}`, `{coming}`, `{unsupported}` are filled in |
| `headline` | up to 90, one `_turn_` | required | the turn takes the accent |
| `lede` | up to 280 | none | |
| `theme` | see below | required | |
| `categories` | 2 to 9 names, up to 22 each | required | in the order the chips show |
| `apps` | 4 to 60 | required | in the order the directory lists them |
| `featured` | 3 to 8 app ids | required | the rail and the phone list |
| `selected` | one of `featured` | `featured[0]` | shown first |
| `unsupported` | 2 to 8 | required | |
| `cta` | `{ label (32, "{app}" is the app's name), href }` | required | `https://…` or a path on your site |
| `request` | `{ label (36), href }` | required | where to ask for an integration |
| `stated` | `{ integrations?, native?, webhook?, community?, coming?, unsupported? }` | none | numbers you want checked; the build fails if the lists disagree |
| `demo` | `{ title, nav: [left, right], footer }` | none | the demo page around the section |

Each app:

| Field | Range | Notes |
| --- | --- | --- |
| `id` | lowercase letters, digits, hyphens, up to 32 | |
| `name` | up to 18 | wraps onto two lines in its node if it must |
| `category` | one of `categories` | |
| `status` | `native`, `webhook`, `community`, `coming` | each status has a shape too: dot, diamond, ring, dashed ring |
| `mark` | `{ shape, cut, color, ink }` | `shape`: circle, square, hex, diamond, tri, pill; `cut`: bar, bars, dot, ring, slash, chev, cross, half; `color` 3:1 on the page, `ink` 3:1 on `color` |
| `summary` | up to 90 | one line |
| `eta` | up to 24, only and always for `coming` | "Planned for March 2027", "In testing" |
| `by`, `plans`, `conflict`, `log` | up to 44, 32, 44, 44 | the terms |
| `flows` | 1 to 6 | the records that cross |
| `stays` | 0 to 4 `{ record (24), why (34) }` | records that never cross |
| `setup` | 1 to 6 `{ step (60), minutes (1 to 240), who: "you" or "us" }` | not for `coming`; at least one step for `you` |
| `minutes` | whole number | optional; must equal the `you` minutes |

Each flow:

| Field | Range | Notes |
| --- | --- | --- |
| `record` | up to 24 | above the wire |
| `dir` | `in` (into your product), `out`, `both` | |
| `trigger` | up to 36, optional | "When the till is closed" |
| `cadence` | `instant`, `every N s/min/h`, `within N s/min/h`, `daily`, `daily HH:MM`, `weekly` | written under the wire ("once a day", "daily at 02:00") and sets the packet gap |
| `theirs` | up to 22 | what it is in the other app |
| `ours` | up to 22 | where it lands in yours |

Each unsupported item: `what` (44), `why` (90), `instead` (90), `keywords` (optional words people would search for; the first is used in the recorded search).

`theme`, colours `#rrggbb`:

| Field | Rule | Notes |
| --- | --- | --- |
| `page` | | the ground |
| `surface` | close to `page` (at most 1.4:1) | the nodes and the search box |
| `ink` | 7:1 on `page` and `surface` | muted text is derived at 5.4:1, lines that carry meaning at 3.2:1, wires at 7:1 |
| `accent` | 4.5:1 on `page` and `surface` | the turn, the chosen tab, your minutes, the phone's direction words; on a dark page also the button |
| `onAccent` | 4.5:1 on `accent` | |
| `packet` | 3:1 on `page` and `surface` | |
| `status` | `{ native, webhook, community, coming }`, each 4.5:1 on `page` and `surface` | the chips' text |
| `display` | `newsreader` or `archivo` | default `newsreader`; Archivo sets headings in condensed capitals |

## Troubleshooting

- **The build lists problems and writes nothing.** Fix them all and build again; it reports everything at once.
- **"stated.native is 9, but the lists give 8".** A number on the page must be counted, not typed. Remove `stated`, or fix the app's `status`.
- **"headline says 20 integrations".** Write `{count} integrations`; the build fills in the real number.
- **"cadence … is not one of".** Use the grammar exactly: `every 15 min`, `within 1 h`, `daily 02:00`. "Real time" is not a cadence; ask how long it really takes, then write `within 4 s` or `instant`.
- **A status colour fails contrast.** It is 12 px text on the chip. Darken it on a light page, lighten it on a dark one.
- **A mark fails "the cut … needs 3:1".** Change `ink` to white or near-black, whichever stands out on `color`.
- **The check says a label crosses a wire.** That should not happen within the length limits; send the config with the report. Shortening the trigger usually fixes it at once.
- **No video.** Install ffmpeg or set `FFMPEG_PATH`. The check and stills don't need it.
