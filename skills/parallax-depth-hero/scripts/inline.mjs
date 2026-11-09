// Inline Markdown in page text: `code`, [links](url), **bold** and _italic_.
import { h } from './markup.mjs'

// Links other than http, https, mailto, anchors and relative paths are
// dropped, so a pasted javascript: link can't reach the page.
const safeHref = (url) =>
  /^(https?:|mailto:|#|\/|\.\/|\.\.\/)/i.test(url) ||
  !/^[a-z][\w+.-]*:/i.test(url)

const INLINE =
  /(`+)([\s\S]*?[^`])\1(?!`)|\[([^\]]+)\]\(((?:[^()\s]|\([^()\s]*\))+)(?:\s+"[^"]*")?\)|\*\*(.+?)\*\*|__(.+?)__|\*([^*\s](?:.*?[^*\s])?)\*|(?<![\w])_([^_\s](?:.*?[^_\s])?)_(?![\w])|<(https?:\/\/[^>\s]+)>/g

/** Inline Markdown as element-tree children. */
export function inline(text) {
  const out = []
  let last = 0
  for (const m of String(text).matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    last = m.index + m[0].length
    const [, , code, label, href, b1, b2, i1, i2, auto] = m
    if (code !== undefined) out.push(h('code', null, code.trim()))
    else if (label !== undefined)
      out.push(safeHref(href) ? h('a', { href }, inline(label)) : inline(label))
    else if (b1 !== undefined || b2 !== undefined)
      out.push(h('strong', null, inline(b1 ?? b2)))
    else if (i1 !== undefined || i2 !== undefined)
      out.push(h('em', null, inline(i1 ?? i2)))
    else if (auto) out.push(h('a', { href: auto }, auto))
  }
  if (last < text.length) out.push(text.slice(last))
  return out.flat()
}

/** Inline Markdown as plain text, for limits and head tags. */
export const plain = (text) =>
  String(text ?? '')
    .replace(/\[([^\]]+)\]\((?:[^()]|\([^()]*\))*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2')
    .replace(/\s+/g, ' ')
    .trim()
