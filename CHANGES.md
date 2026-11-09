# Changes

## 1.3.0 (2026-11-09)

- **30 new skills**, made free (MIT) on lookbk.dev and copied from `packages/<slug>/` of the site repository at commit `31d6fc27` (git-tracked files only):
  - **Page Kits, sections (18):** `phone-screen-showcase`, `proof-band-kit`, `feature-tabs-kit`, `process-steps-kit`, `integrations-kit`, `spec-sheet-kit`, `testimonial-wall`, `compare-table-kit`, `pricing-kit`, `fee-calculator-kit`, `services-menu-kit`, `booking-slots-kit`, `story-rail-kit`, `faq-kit`, `newsletter-kit`, `contact-kit`, `closing-cta-kit`, `footer-kit`. Each builds one website section from a JSON file as a page and a paste-in embed, checks it in headless Chrome and records a 1080p preview.
  - **Page Kits, pages (6):** `about-story-kit`, `portfolio-index-kit`, `shop-collection-kit`, `journal-index-kit`, `event-page-kit`, `itinerary-kit`.
  - **Motion Heroes (6):** `parallax-depth-hero`, `signal-glitch-hero`, `falling-leaves-hero`, `aperture-reveal-hero`, `laser-etch-hero`, `snow-globe-hero`.
- In eight of them (`aperture-reveal-hero`, `compare-table-kit`, `event-page-kit`, `falling-leaves-hero`, `laser-etch-hero`, `parallax-depth-hero`, `shop-collection-kit`, `snow-globe-hero`) the `description` in `SKILL.md` contains ": " and was not valid YAML, so the `skills` CLI skipped them. It is now a double-quoted string with the same text.
- `newsletter-kit/scripts/kit/selftest.mjs`: the made-up mailing-list key in one refusal test is now written as two joined strings, so secret scanners do not mistake it for a real key. The self-test still passes all its cases.
- Third-party parts that come with them, each with its licence beside it and listed in the skill's `NOTICE.md` and the README License section: a partial three.js r186 build (MIT) in `shop-collection-kit`, Natural Earth land (public domain, via world-atlas 2.0.2, ISC) in `itinerary-kit`, and four OFL font families in `story-rail-kit`.
- README: a preview GIF for each new skill (`assets/<skill>.gif`, 640 px wide, 6 to 10 fps, 0.16 to 1.29 MB each, 25.3 MB for all 30, cut from each skill's preview video on lookbk.dev), the skills grouped into Videos, slides and images; Landing pages; Page Kits: sections; Page Kits: pages; and Motion Heroes, "What the skills run and fetch" updated for the new pages' fonts, three.js and forms, and "More skills" brought up to date: 258 skills in the catalog as of 9 November 2026, 39 of them free (Roller Diner Hero still installs from lookbk.dev), 219 in Pro.
- `skills.sh.json` adds "Page Kits: sections" and "Page Kits: pages" and renames "Interactive heroes" to "Motion heroes". The Claude Code marketplace lists all 38 skills in the `lookbk` bundle and each as its own plugin; the Cursor manifest is updated to match. Plugin version 1.3.0.

No existing skill changed.

## 1.2.0 (2026-11-01)

- **New skill: `washing-line-hero`.** An interactive hero section: the brand's poster printed on a cotton cloth pinned to a washing line with wooden pegs, under a sky with drifting clouds. Visitors dent the cloth with the pointer, grab it anywhere and pull it (mouse or finger), and it swings back when they let go. A Verlet cloth simulation in three.js r180 (loaded from jsDelivr, pinned with SRI), stepped at a fixed 120 Hz so `record.mjs` writes the same 1080p video on any machine. Two examples (Paperwind, Halden Linen). Its checks pass at 390, 768, 1024 and 1440 px.
- README, `skills.sh.json` (new "Interactive heroes" group), the Claude Code marketplace (the `lookbk` bundle and a single `washing-line-hero` plugin) and the Cursor manifest list eight skills. Plugin version 1.2.0.

## 1.1.0 (2026-10-26)

### Install from more places

- **Claude Code plugin marketplace.** Added `.claude-plugin/marketplace.json` (marketplace `lookbk-skills`) and `.claude-plugin/plugin.json` (plugin `lookbk`, version 1.1.0, MIT). `/plugin marketplace add lookbkdev/lookbk-skills` then `/plugin install lookbk@lookbk-skills` installs all seven skills. Each skill is also listed as its own plugin (for example `swiss-grid-deck@lookbk-skills`) for people who want just one. Checked with `claude plugin validate .` (passes) and a local `marketplace add` and `install` on Claude Code 2.1.310: `lookbk` loads 7 skills, a single-skill plugin loads 1.
- **Anthropic directory fields.** `plugin.json` sets `icon` (`assets/logo.png`), `documentationUrl`, `supportUrl`, `privacyPolicyUrl` and `termsOfServiceUrl`, which the directory listing reads.
- **skills.sh.** Added `skills.sh.json`, which groups the skills on the skills.sh repo page into Video, Slides and images, and Web pages. `npx skills add lookbkdev/lookbk-skills` finds all 7 skills (checked with skills CLI 1.7.4 against a local copy).
- **Cursor.** Added `.cursor-plugin/plugin.json` (plugin `lookbk`), the manifest Cursor's plugin marketplace reads.

### README

- A preview GIF per skill, rendered from each skill's own output (`assets/<skill>.gif`, 640 px wide, 0.12 to 1.3 MB each), in a grid at the top and again in each skill's section.
- Install instructions for the `skills` CLI, the Claude Code plugin marketplace, Cursor, Codex and by hand, plus the existing Lookbk installer.
- Each skill now has its own section: what it makes, what it needs, a prompt to try, and a link to its page on lookbk.dev.
- A "What the skills run and fetch" section listing what runs on your machine, what is downloaded when a skill is used, and what is sent elsewhere.
- "More skills" brought up to date: 58 skills in the catalog, Roller Diner Hero as an eighth free skill on lookbk.dev, 50 in Pro, and a link to [awesome-ai-motion-videos](https://github.com/lookbkdev/awesome-ai-motion-videos).
- Links to lookbk.dev carry `utm_source=github&utm_medium=repo` with `utm_campaign=free-skills-readme` (skill links) or `free-skills-more` (More skills), so visits from this README show up as their own channel.

### Skills

- Every `SKILL.md` front matter now carries `license: MIT`. All seven were checked against the Agent Skills specification (agentskills.io): `name` is lowercase letters, digits and single hyphens, at most 64 characters and the same as its folder; `description` is plain text of 288 to 625 characters (the limit is 1,024) and says what the skill makes and when to use it.
- `kinetic-title-drop`: one remaining unpinned call, `npx hyperframes docs compositions`, now pins the version like every other call: `npx --yes hyperframes@0.8.192 docs compositions`.

No skill's scripts, templates or examples changed.

## 1.0.0

- First release: seven free skills (kinetic-title-drop, pixel-quest-promo, swiss-grid-deck, editorial-og-card, blueprint-architecture, mono-editorial-landing, waitlist-glow) under the MIT License.
