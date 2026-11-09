---
name: newsletter-kit
description: Build a newsletter signup from one letter.json that earns the address by showing the letter itself - the latest real issue opened in a neutral inbox (sender, subject, preheader, the first screen of the email, a fold that says how many words are left), the cadence drawn as a send calendar worked out from the schedule (the next issue's date in the reader's own time zone), a subscriber count that cannot appear without its source and date, an archive with dates derived from the send log, and a privacy ledger beside the field. One email field with every state designed (empty, typing, invalid, sending, check your inbox for double opt-in, already subscribed, subscribed, error) and no layout jump between them; while you type, the sample email's "to:" line shows your address, and on double opt-in the confirmation email lands in that inbox. Posts to any endpoint, with presets and recipes for common list services and a server-function recipe for keys; the build refuses anything key-shaped. Two layouts (a standalone page or an inline section), built as a self-contained page and a paste-in embed, with checks at four widths and a frame-by-frame recorder.
license: MIT
---

# Newsletter Signup

A signup that shows what you will actually get. **The latest real issue is the pitch: it sits opened in an inbox, exactly as it arrives, so the reader judges the letter before giving an address.** Everything around it is something the reader can check rather than a promise.

- **The issue, opened.** A neutral mail client drawn by the kit (no real mail app's chrome or logo): an Inbox bar, the issue's row with its unread dot, the previous issue's row, the opened header (monogram, sender and address, the send time in the reader's zone, "to: you", the subject), then the email in the letter's own typography: nameplate, issue number and read time, the title, one to three real paragraphs and one figure (a contents list, a pull quote, or a chart drawn from your numbers). A dashed fold closes it: "First screen ends here · 1,140 more words" and a link to the full issue.
- **The cadence, worked out.** You give the schedule (the first issue's date, every 1, 2 or 4 weeks, the weekday, the send time and the sender's time zone, and any skipped sends). The build numbers every send from it, so the issue's date, the archive's dates, "87 issues since 2023" and the send calendar (past sends, skipped sends hatched, the latest in the accent, the next one outlined) all come from one source. A typed date or count that disagrees is refused. In the browser, the next issue is worked out from the clock, and every time is shown in the reader's own zone: a reader in Los Angeles sees "Wed 18 Nov" for a Thursday 07:30 Madrid send, and the cadence line adds "Wed 22:30 your time".
- **The count, sourced.** "6,240 readers · count from our mailing list, 1 Nov 2026". The source and date are required, a date after today is refused, and the build notes a count older than 90 days.
- **The form.** One field with a real label, `type=email`, `inputmode=email`, `autocomplete=email`, and a polite live status line under it that says what happens next ("One email to confirm the address is yours, then No. 88 on Thu 19 Nov."). Every state is designed and stacked in the same box, which is measured at its tallest state, so nothing on the page moves when the state changes:
  - **typing**: the field takes the accent, and the sample email's "to:" line shows the address as it is typed (it never leaves the page)
  - **invalid**: says what is missing (the @, or an ending like .com), keeps focus in the field
  - **sending**: three stepped dots in the button, the field read-only
  - **check your inbox** (double opt-in): a panel that takes focus and names the address; the confirmation email slides into the sample inbox as a new unread row
  - **already subscribed**, **subscribed** (lists without a confirming step), and **error**: "The list didn't answer, so you are not subscribed yet", with the address kept
- **Privacy in plain sight.** Three lines beside the field (what is kept, what is never done, how to leave), repeated on the page layout in a "Before you sign up" colophon with the confirming step explained.
- **No keys in the page.** The form posts to the address from your list's embed code, or to your own small server function (recipe included) when the list needs a secret key. The build scans every value in letter.json and the finished page for key-shaped strings (payment, cloud, mail-API and Git tokens, signed tokens, `api_key=` parameters, long random strings) and writes nothing if it finds one.

**Two layouts** (`"layout"`): **page**, a standalone landing page with a masthead and dateline, the pitch and the issue side by side, then the archive as a contents list and the colophon; and **inline**, a section to drop into an article or a homepage, with the four most recent issues under the form. On phones the issue moves under the form, and a card under the opening paragraph shows the latest subject and preheader with "Read it before you sign up ↓", so the issue is still the first thing offered.

**Motion** happens once, when the inbox scrolls into view: the frame rises 12 px (480 ms), the issue's row arrives (420 ms) and its unread dot appears, the email opens downward (620 ms), the calendar's cells fill left to right 35 ms apart with the next send outlined last, and a chart draws left to right. All of it settles by 1.8 s and uses transforms and clipping only (no layout shift). **Reduced motion** gets the finished page and instant state changes. **Without JavaScript**, the page is complete with the sender's times, and the form posts normally.

**What you can change, honestly.** Every word, link, date and number; the layout; the page, ink, accent and state colours (contrast is enforced at build time and measured again in the check); the display face (Young Serif, Newsreader or Geist), the text face (Literata, Geist or IBM Plex Sans) and the label face (IBM Plex Mono or Geist Mono); square or soft fields; the issue's figure. The spacing, type scale and motion are the design.

## What you need

- Node.js 18 or newer. Nothing to install.
- Chrome, Chromium or Edge, for the checks and the video (the scripts find it; set `CHROME_PATH` if they don't).
- ffmpeg for the video only (`brew install ffmpeg`, `winget install ffmpeg`, `apt install ffmpeg`; or set `FFMPEG_PATH`).
- The latest issue as sent: subject, preheader, the first paragraphs, its number and the schedule it goes out on.
- Internet access when the page is opened, for its Google Fonts. Without it, system fonts stand in.

Run the commands below from this skill's folder (the folder this SKILL.md is in).

## Files

- `kit/newsletter.css`: the whole design, scoped to `.nk`: both layouts, the inbox, the form states, phone and tablet rules.
- `kit/runtime.js`: the browser runtime, inlined into every build: the reader's time zone, the next issue from the clock, the entrance, the form and its states, the "to:" mirror, the sending adapters, and the recording clock.
- `scripts/build.mjs`: letter.json to `out/index.html` and `out/newsletter-embed.html` (the section to paste in); refuses key-shaped values.
- `scripts/kit/schema.mjs`: every field and its limits, the provider presets, and the derivation of every date from the schedule; lists every problem at once.
- `scripts/kit/dates.mjs`: send times in the sender's zone as exact instants, summer time included.
- `scripts/kit/secrets.mjs`: the key patterns and the long-random-string test.
- `scripts/selftest.mjs`: breaks example 1 one way at a time and proves the build refuses each (17 cases), accepts what it should, and gets summer time right.
- `scripts/check.mjs`: checks the built page at 390, 768, 1024 and 1440 px and with reduced motion, including the form end to end against stand-in addresses and the times from Los Angeles.
- `scripts/record.mjs`: the preview video, stills, form-state stills and `--moments`.
- `scripts/serve.mjs`: serves `out/` on localhost to look at; also answers the stand-in sign-up addresses the check uses.
- `recipes/proxy-function.mjs`: a server function for lists that need a secret key (standard Request and Response, so it runs on most hosts).
- `examples/brine-crumb/letter.json` (page layout, light) and `examples/tail-latency/letter.json` (inline layout, dark).

## Steps

### 1. Collect the letter

From the person, or from their list's archive:

- **The latest issue as sent**: its number, subject line, preheader (the grey line after the subject in an inbox), title, the first one to three paragraphs word for word, how many words follow, and the link to read it in full. If it has a chart, the numbers behind it; if it has a contents list, the items.
- **The schedule**: the date of issue No. 1, how often (every week, every other week, every fourth week), the weekday, the send time and the time zone it is sent in, and any weeks it did not go out. Check it against two or three real send dates: the build will refuse a typed date that disagrees.
- **The count** and where it came from, with the date it was taken. If there is no honest count, ask before inventing one; a small real number is fine.
- **The last few issues**: numbers, titles and read times.
- **Where sign-ups go** (step 3) and **what is stored**, what is never done with the list, and how people leave.

### 2. Write letter.json

Copy the example closest in spirit and replace every value:

- `examples/brine-crumb/letter.json`: Brine & Crumb, a cooking letter every other Thursday, the `page` layout on warm paper (Young Serif, Literata, IBM Plex Mono, tomato accent).
- `examples/tail-latency/letter.json`: Tail Latency, an engineering weekly, the `inline` layout on graphite (Geist and Geist Mono, signal-yellow accent), with a chart in the issue.

Leave out `today` (it pins "today" for the examples so they build the same forever) and `demo` (the demo page around an inline section, and the address the recorder types).

### 3. Choose where sign-ups go

Set `form.provider` and paste the address from your list's own embed or form code into `form.action`. Only public values ever go in the page.

| `provider` | `form.action` is | Posts | Notes |
| --- | --- | --- | --- |
| `post` | any address that takes a form post | `email` + the spam trap, reads the reply | 2xx = sent; 409 = already subscribed; 400 or 422 = refused address; or answer `{"state": "confirm" \| "subscribed" \| "already" \| "invalid"}` |
| `proxy` | `/api/subscribe` on your own site | JSON | `recipes/proxy-function.mjs`: holds the key in the host's environment, calls the list, answers one of the states above |
| `buttondown` | the embed form's address | `email`, `embed=1` | the reply can't be read from the page, so the panel says "If that address is new, a confirmation email is on its way" |
| `kit` | a form's subscriptions address | `email_address` | same: the reply can't be read |
| `mailchimp` | the embedded form's `action` | `EMAIL` as a classic post | put its hidden `b_…` spam field in `form.hidden`; the list's own page takes over after sending |
| `ghost` | your Ghost site's members magic-link address | JSON with `emailType: signup` | same-site only |
| `listmonk` | the public subscription form address | `email`, list ID as `l` | put the list's public ID in `form.hidden` as `l` |

Lists differ and change: check the provider's current docs for the exact address and field name, then test with a real address (step 6). `form.field` and `form.mode` (`fetch`, `json`, `no-cors`, `navigate`) override a preset.

Never put an API key, token or password in letter.json: the build refuses it. If your list only accepts sign-ups with a secret key, deploy `recipes/proxy-function.mjs` (set `LIST_ENDPOINT` and `LIST_KEY` in the host's environment, as its comments explain) and use `proxy`.

### 4. Build and run the self-test

```
node scripts/build.mjs letter.json out
node scripts/selftest.mjs
```

The build lists every problem at once (a missing field, a line too long for its place, a colour pair under its contrast minimum, a first issue that isn't on the weekday, a skipped week that isn't a send day, a typed date or count that disagrees with the schedule, an issue that hasn't gone out yet, a count dated after today, anything key-shaped) and writes nothing until they are fixed. When it succeeds it prints what it worked out, for example `No. 87 went out 5 Nov 2026; next: No. 88 on 19 Nov 2026; 87 issues since 2023`: read it and compare with the real list. `selftest.mjs` proves the refusals still work.

### 5. Check

```
node scripts/check.mjs out/index.html
```

It runs at 390, 768, 1024 and 1440 px wide, and with reduced motion at 390 and 1440, and fails on:

- script errors, links without an address, sideways scrolling, layout shift over 0.01
- text under 16 px on a phone or 14 px elsewhere (labels and the chart's axis labels: 12 px, at the size they render)
- text under WCAG AA contrast against the colour actually behind it
- text cut off by its box or off the screen; an inbox row taller than its slot
- a field without a visible label, `type=email`, `autocomplete=email` and `inputmode=email`, or without its live status line
- any of the eight states moving the form's box or anything under it by more than 1 px
- typing that doesn't show on the sample email's "to:" line
- the form end to end against stand-in addresses on the local server: an empty or broken address, a 2xx (check your inbox, with the confirmation row in the inbox and focus on the panel), 409, 422, 500 (error, address kept), a "subscribed" reply, the field name and spam trap in the post, JSON for `proxy`
- the next issue's day and time, and the issue's send time, not matching what it works out itself for the reader's zone and again for Los Angeles
- a keyboard focus that can't be seen, or a spam trap reachable with Tab
- under reduced motion, anything not in its finished state

### 6. Look at it, and test the real list

```
node scripts/serve.mjs out
```

Open the address it prints on a laptop and a phone. Then sign up once with a real address of your own: the stand-ins prove the page handles every answer, but only the real list proves the address and field name are right. Confirm the email arrives, and unsubscribe to check the promise in your privacy lines is true.

### 7. Put it on the site

For `page`, deploy `out/index.html` as the page. For `inline`, paste `out/newsletter-embed.html` where the section should sit: it brings its own fonts, styles and script, and every class starts with `nk-`. Use one Newsletter Kit section per page.

### 8. Record a preview (optional)

```
node scripts/record.mjs out/index.html --moments
node scripts/record.mjs out/index.html --seconds 12 --poster 8
node scripts/record.mjs out/index.html --still 2.75 --size 390x844 --scale 2 --png phone.png
node scripts/record.mjs out/index.html --still 2.75 --state error:"ana@weiss.example" --clip .nk-zone --png error.png
```

The video follows a fixed 12-second script: the inbox arrives (0.3 to 2.1 s), an address is typed (3.4 to 4.9 s), sent (5.6 s), the confirmation lands (6.5 s), and on the page layout it scrolls to the archive (9 to 10.2 s). `--moments` prints the holds, the stretches where nothing moves (`arrived`, `typed`, `confirm`, `archive`); take stills inside them. The clock is pinned to `today` and the reader's zone to `demo.readerTz`, so the stills are the same on any machine.

## letter.json, every field

Top level:

| Field | Range | Default | |
| --- | --- | --- | --- |
| `layout` | `page`, `inline` | required | |
| `lang` | language tag | `en` | |
| `today` | `YYYY-MM-DD` | the real date | pins "today" for the build's checks and the recorder |
| `eyebrow` | up to 60 characters | required | a fact, shown in the label voice |
| `headline` | up to 70 | required | one `_turn_` in the accent |
| `dek` | up to 240 | required | |
| `about` | up to 140 | none | what an issue contains, for the colophon |
| `nav` | 0 to 3 `{ label (18), href }` | none | page layout masthead |
| `footer` | `{ left (60), right? (60) }` | none | page layout |
| `stats` | `{ issues?, since? }` | none | only to double-check: refused if they disagree with the schedule |

`theme`: `page`, `ink`, `accent`, `onAccent` (colours like `#211c16`, required); `client` (the inbox), `mail` (the email body), `accent2` (the already-subscribed panel), `error`, `ok` (worked out from the page if left out); `display` (`young`, `newsreader`, `geist`; default `young`), `text` (`literata`, `geist`, `plex`; default `literata`), `mono` (`plex`, `geist`; default `plex`), `fields` (`square`, `soft`; default `square`). Ink must be 7:1 on the page, the button label 4.5:1 on the accent, error and ok colours 4.5:1 on the page; muted text is derived to hold 4.5:1 everywhere it sits.

`brand`: `name` (32), `monogram` (3, the avatar), `from` (40, the sender name as an inbox shows it), `address` (the sender address, shown, never posted to), `author` (40, optional).

`schedule`: `first` (date of No. 1, on the weekday), `every` (1, 2 or 4 weeks), `weekday` (`mon` to `sun`), `time` (`HH:MM`, 24-hour, in `tz`), `tz` (a time zone name such as `Europe/Madrid` or `UTC`), `skipped` (dates of send days that had no issue; default none), `read` (24, such as `6-minute read`), `zoneLabel` (default the city, such as `Madrid time`, or `UTC`).

`issue`: `no` (the latest sent issue), `date` (optional double-check), `subject` (90), `preheader` (120), `title` (70), `body` (1 to 3 paragraphs of 40 to 360 characters, required), `dropCap` (true or false), `figure` (optional, below), `moreWords` (0 to 50,000), `href`.

`issue.figure`, one of:
- `{ "type": "list", "title"? (30), "items": [[text (48), note (10)], …] }` (2 to 5 items)
- `{ "type": "quote", "text" (200), "cite" (48) }`
- `{ "type": "chart", "title" (44), "note"? (30), "alt" (200), "scale": "log" | "linear", "x": [2 to 8 labels], "series": [{ "name" (30), "values": [one per x], "accent"? }] (1 to 3, one accent), "ticks"? [[value, label]], "unit"?, "callouts"? [{ "series", "at", "label" (10) }] }`. Labels are HTML at 12 px or more at every size, not text inside a scaled drawing.

`archive`: 0 to 8 `{ no, title (70), read? (10), href, date? }`, newest first, all before the issue's own `no`. Dates are derived; a typed `date` is only a double-check.

`count`: `value` (a whole number), `label` (20, such as `readers`), `source` (70), `asOf` (date, not after today).

`form`: `label` (40), `placeholder` (40), `button` (26; `{next}` becomes "No. 88", or "the next issue" if the page is older than the next send), `provider` (above; default `post`), `action` (https address, `/path`, or `#` to send nothing), `field`, `mode`, `hidden` (`{ name: public value }`), `honeypot` (the spam trap's name, default `website`), `doubleOptIn` (default true).

`privacy`: exactly 3 `[key (12), line (100)]`.

`messages` (optional, each up to 160): `hint`, `invalidEmpty`, `invalidAt`, `invalidDot`, `invalidServer`, `sending`, `confirmTitle`, `confirmLine`, `confirmOpaque`, `doneTitle`, `doneLine`, `alreadyTitle`, `alreadyLine`, `error`, `confirmRow`, `confirmRowLine`, `nextFallback`. `{next}` and `{nextDay}` are filled in.

`demo` (examples only): `title`, `readerTz` (the zone the recorder uses), `email` (an address on `.example` the recorder types), `above` `{ label, text }` and `below` (the page around an inline section).

## Troubleshooting

- **"issue.date says …, but on this schedule No. 87 went out on …"**: the schedule and the real send log disagree. Usually a week the letter skipped is missing from `schedule.skipped`, or `first` is wrong. Fix the schedule rather than the date, so the archive and calendar are right too.
- **"No. 88 is scheduled for …, after today"**: show the latest issue that has actually gone out.
- **"looks like a secret key"**: a key, token or long random string is in letter.json. Remove it and use `proxy` with `recipes/proxy-function.mjs`. A list's public ID or form ID is fine; if a public ID is flagged, it is very long and random, so check the provider's docs for the public value.
- **The panel says "check your inbox" but nothing arrives**: with `buttondown`, `kit` or `listmonk` the page cannot read the list's reply, so it shows the careful wording. Sign up with a real address and look at the list's dashboard; a wrong `form.action` or `form.field` is the usual cause.
- **The page shows "the next issue" instead of a number**: the page is older than the next scheduled send. Update `issue` with the issue that went out.
- **The times are an hour off around March or October**: `schedule.tz` must be the sender's zone name (`Europe/Madrid`), not a fixed offset; the kit handles summer time from the name.
- **The check says a state moves the layout**: a custom message is much longer than the others. Shorten it; the box is measured at its tallest state, but a message that wraps differently at one width can still change it.
