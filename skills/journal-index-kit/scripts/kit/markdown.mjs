// Journal Index Kit: front matter and Markdown, with no packages to install.
//
// Front matter is the YAML most writers use: `key: value`, nested maps by
// indentation, `- item` lists, inline [a, b] lists and { a: 1 } maps,
// quoted or plain strings, numbers, true/false. Anything else is reported
// with its line, never guessed at.
//
// The body is CommonMark's everyday part (paragraphs, ## and ### headings,
// lists, links, emphasis, inline code, fenced code, block quotes, rules)
// plus four additions that read as plain Markdown anywhere else:
//   [^1] ... [^1]: note          footnotes, set as sidenotes on wide screens
//   > !pull The line             a pull quote; `> cite: Name` under it
//   ![alt](images/a.jpg "Fig. 2 | caption")   a numbered figure; a .json
//                                source is a chart (see chart.mjs)
//   ```rust src/a.rs {3-4}       code with a file name and marked lines
//
// Every block is given its reading time in seconds (the one model in
// reading.mjs), which the index, the article head, the contents rail and
// the progress bar all read from.
import { highlight } from './highlight.mjs'
import { blockSeconds, words } from './reading.mjs'

export class MdError extends Error {}

// ---------- front matter ----------

function scalar(raw, where) {
  const v = raw.trim()
  if (v === '') return ''
  if (/^".*"$/.test(v)) return v.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'")
  if (v === 'true') return true
  if (v === 'false') return false
  if (v === 'null' || v === '~') return null
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v.startsWith('[')) return flowList(v, where)
  if (v.startsWith('{')) return flowMap(v, where)
  return v
}
function splitFlow(inner) {
  const out = []
  let depth = 0, q = null, cur = ''
  for (const ch of inner) {
    if (q) { cur += ch; if (ch === q) q = null; continue }
    if (ch === '"' || ch === "'") { q = ch; cur += ch; continue }
    if (ch === '[' || ch === '{') depth++
    if (ch === ']' || ch === '}') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}
function flowList(v, where) {
  if (!v.endsWith(']')) throw new MdError(`${where}: a list that starts with [ must end with ]`)
  return splitFlow(v.slice(1, -1)).map((x) => scalar(x, where))
}
function flowMap(v, where) {
  if (!v.endsWith('}')) throw new MdError(`${where}: a map that starts with { must end with }`)
  const o = {}
  for (const part of splitFlow(v.slice(1, -1))) {
    const i = part.indexOf(':')
    if (i < 0) throw new MdError(`${where}: "${part.trim()}" needs a key and a value (key: value)`)
    o[part.slice(0, i).trim()] = scalar(part.slice(i + 1), where)
  }
  return o
}

/** Parses the front matter lines; `first` is the file line of lines[0]. */
export function parseYaml(lines, file, first = 2) {
  const items = lines
    .map((text, i) => ({ text: text.replace(/\s+#\s.*$/, ''), n: first + i }))
    .filter((l) => l.text.trim() && !l.text.trim().startsWith('#'))
  let pos = 0
  const indent = (l) => l.text.match(/^ */)[0].length
  function block(level) {
    if (pos >= items.length) return null
    const isList = items[pos].text.trim().startsWith('- ')
    const out = isList ? [] : {}
    while (pos < items.length) {
      const l = items[pos]
      const ind = indent(l)
      if (ind < level) break
      if (ind > level) throw new MdError(`${file}:${l.n}: unexpected indentation`)
      const t = l.text.trim()
      const where = `${file}:${l.n}`
      if (isList) {
        if (!t.startsWith('- ')) throw new MdError(`${where}: expected "- item" in this list`)
        pos++
        const rest = t.slice(2)
        const kv = /^([A-Za-z_][\w-]*):(\s|$)/.exec(rest)
        if (kv) {
          // - key: value, then more keys indented under it
          const o = {}
          const v = rest.slice(kv[0].length)
          o[kv[1]] = v.trim() ? scalar(v, where) : block(level + 4) ?? ''
          if (pos < items.length && indent(items[pos]) === level + 2) Object.assign(o, block(level + 2))
          out.push(o)
        } else out.push(scalar(rest, where))
      } else {
        const m = /^([A-Za-z_][\w-]*):(\s+(.*))?$/.exec(t)
        if (!m) throw new MdError(`${where}: expected "key: value", got "${t}"`)
        pos++
        if (m[1] in out) throw new MdError(`${where}: "${m[1]}" is set twice`)
        if (m[3] !== undefined && m[3].trim() !== '') out[m[1]] = scalar(m[3], where)
        else if (pos < items.length && indent(items[pos]) > level) out[m[1]] = block(indent(items[pos]))
        else out[m[1]] = ''
      }
    }
    return out
  }
  return block(0) ?? {}
}

/** Splits a Markdown file into { data, body, bodyLine }. */
export function frontMatter(src, file) {
  const text = src.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  if (!text.startsWith('---\n')) throw new MdError(`${file}:1: the file must start with front matter between --- lines`)
  const end = text.indexOf('\n---', 4)
  if (end < 0) throw new MdError(`${file}: the front matter has no closing --- line`)
  const fm = text.slice(4, end).split('\n')
  const body = text.slice(end + 4).replace(/^[^\n]*\n/, '')
  return { data: parseYaml(fm, file, 2), body, bodyLine: fm.length + 3 }
}

// ---------- inline ----------

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Inline Markdown to HTML. `ctx.note(id)` returns the html for a footnote reference. */
export function inline(src, ctx = {}) {
  const codes = []
  let s = String(src).replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(`<code>${esc(c)}</code>`) - 1}\u0000`)
  const links = []
  s = s.replace(/\[\^([\w-]+)\]/g, (_, id) => `\u0001${links.push(ctx.note ? ctx.note(id) : '') - 1}\u0001`)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, t, href, title) => `\u0001${links.push(`<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''}>${inline(t)}</a>`) - 1}\u0001`)
  s = esc(s)
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|[\s(“"'‘>])_([^_]+)_(?=$|[\s.,;:!?)”"'’<])/g, '$1<em>$2</em>')
  s = s.replace(/(^|[\s(“"'‘>])\*([^*]+)\*(?=$|[\s.,;:!?)”"'’<])/g, '$1<em>$2</em>')
  s = s.replace(/\u0001(\d+)\u0001/g, (_, i) => links[i])
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[i])
  return s
}
/** Inline Markdown to plain text (for feeds, JSON-LD, titles). */
export const plain = (src) => String(src).replace(/\[\^[\w-]+\]/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(^|\W)[_*]([^_*]+)[_*](?=\W|$)/g, '$1$2').trim()

// ---------- blocks ----------

const FENCE = /^```\s*([\w+#-]*)\s*([^\s{]*)\s*(\{[\d,\s-]+\})?\s*$/
function lineSet(spec) {
  const set = new Set()
  if (!spec) return set
  for (const part of spec.slice(1, -1).split(',')) {
    const [a, b] = part.trim().split('-').map(Number)
    for (let i = a; i <= (b || a); i++) set.add(i)
  }
  return set
}

/**
 * Parses a body into blocks:
 *   { type: 'p'|'h2'|'h3'|'ul'|'ol'|'quote'|'pull'|'code'|'figure'|'hr', ... }
 * with footnote definitions collected in `notes`.
 */
export function blocks(body, file, firstLine = 1) {
  const lines = body.replace(/\r\n?/g, '\n').split('\n')
  const out = []
  const notes = new Map()
  let i = 0
  const at = (k) => `${file}:${firstLine + k}`
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    let m
    if ((m = FENCE.exec(line))) {
      const start = i++
      const code = []
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++])
      if (i >= lines.length) throw new MdError(`${at(start)}: this code block has no closing \`\`\``)
      i++
      out.push({ type: 'code', lang: m[1] || '', file: m[2] || '', marks: lineSet(m[3]), code: code.join('\n'), line: firstLine + start })
      continue
    }
    if ((m = /^\[\^([\w-]+)\]:\s*(.*)$/.exec(line))) {
      const start = i++
      const text = [m[2]]
      while (i < lines.length && /^ {2,}\S/.test(lines[i])) text.push(lines[i++].trim())
      if (notes.has(m[1])) throw new MdError(`${at(start)}: footnote [^${m[1]}] is defined twice`)
      notes.set(m[1], { text: text.join(' '), line: firstLine + start })
      continue
    }
    if (/^#\s/.test(line)) throw new MdError(`${at(i)}: the title comes from the front matter; start body headings at ##`)
    if ((m = /^(#{2,3})\s+(.+?)\s*#*$/.exec(line))) {
      out.push({ type: m[1].length === 2 ? 'h2' : 'h3', text: m[2], line: firstLine + i })
      i++
      continue
    }
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) { out.push({ type: 'hr' }); i++; continue }
    if ((m = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*(\{wide\})?\s*$/.exec(line))) {
      const [label, caption] = (m[3] ?? '').includes('|') ? m[3].split('|').map((x) => x.trim()) : ['', (m[3] ?? '').trim()]
      out.push({ type: 'figure', alt: m[1], src: m[2], label, caption, wide: !!m[4], line: firstLine + i })
      i++
      continue
    }
    if (line.startsWith('>')) {
      const start = i
      const q = []
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''))
      if (q[0].startsWith('!pull ')) {
        const cite = q.find((x) => /^cite:\s/.test(x))
        const text = q.filter((x) => !/^cite:\s/.test(x)).join(' ').replace(/^!pull\s+/, '')
        out.push({ type: 'pull', text, cite: cite ? cite.replace(/^cite:\s*/, '') : '', line: firstLine + start })
      } else out.push({ type: 'quote', text: q.join(' '), line: firstLine + start })
      continue
    }
    if ((m = /^(\s*)([-*]|\d+\.)\s+/.exec(line))) {
      const ordered = /\d/.test(m[2])
      const items = []
      while (i < lines.length && lines[i].trim()) {
        const mm = /^\s*([-*]|\d+\.)\s+(.*)$/.exec(lines[i])
        if (mm) items.push(mm[2])
        else items[items.length - 1] += ' ' + lines[i].trim()
        i++
      }
      out.push({ type: ordered ? 'ol' : 'ul', items, line: firstLine + i })
      continue
    }
    const start = i
    const para = []
    while (i < lines.length && lines[i].trim() && !FENCE.test(lines[i]) && !/^(#{2,3}\s|>|!\[|\[\^[\w-]+\]:)/.test(lines[i])) para.push(lines[i++].trim())
    out.push({ type: 'p', text: para.join(' '), line: firstLine + start })
  }
  return { blocks: out, notes }
}

/** Plain words in a block, for the reading model and JSON-LD wordCount. */
export function blockWords(b) {
  if (b.type === 'p' || b.type === 'h2' || b.type === 'h3' || b.type === 'quote' || b.type === 'pull') return words(plain(b.text))
  if (b.type === 'ul' || b.type === 'ol') return b.items.reduce((n, t) => n + words(plain(t)), 0)
  if (b.type === 'figure') return words(b.caption)
  return 0
}

export { blockSeconds, highlight }
