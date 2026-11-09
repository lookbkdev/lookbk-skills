// Journal Index Kit: the one reading-time model. Every minute count on the
// site comes from here: the index row, the lead story's byline, the article
// head, Article JSON-LD's timeRequired, and the contents rail's "N min left
// of M" and progress bar (which read the per-block seconds written into the
// page as data-t).
//
//   prose (paragraphs, headings, lists, quotes, pull quotes, captions and
//   footnotes):          words / wpm minutes                 (wpm: 230)
//   code:                non-blank lines / codeLinesPerMinute (12, so 5 s a line)
//   figures and charts:  secondsPerFigure each                (12 s)
//
// The total is rounded up to whole minutes, never below 1. A post can't set
// its own minutes; change the text, or these rates in journal.json
// "reading", and every number moves together.

export const READING_DEFAULTS = { wpm: 230, codeLinesPerMinute: 12, secondsPerFigure: 12 }

export const words = (text) => (String(text).match(/[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu) ?? []).length

/** Seconds to read one block, given its prose word count. */
export function blockSeconds(b, proseWords, rates = READING_DEFAULTS) {
  if (b.type === 'code') return (b.code.split('\n').filter((l) => l.trim()).length * 60) / rates.codeLinesPerMinute
  if (b.type === 'figure') return rates.secondsPerFigure + (proseWords * 60) / rates.wpm
  return (proseWords * 60) / rates.wpm
}

export const minutesOf = (seconds) => Math.max(1, Math.ceil(seconds / 60 - 1e-9))
