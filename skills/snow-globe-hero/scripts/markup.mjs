// A small element tree that prints as HTML or as JSX, so the static page and
// the Next.js component are built from the same markup.
//
//   h('a', { class: 'pill', href: '/signup' }, 'Start free')
//
// Attributes use HTML names (class, for, stroke-width); `style` takes an
// object with camelCase keys. In `class`, a token starting with $ is a JS
// expression that only the JSX output keeps, e.g. '$sans.variable'.

const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
])
// Containers whose element children can go on their own lines: whitespace
// between block-level children never renders.
const BLOCK = new Set([
  'html',
  'head',
  'body',
  'div',
  'section',
  'nav',
  'header',
  'footer',
  'main',
  'article',
  'aside',
  'ul',
  'ol',
  'li',
  'figure',
  'details',
  'form',
  'svg',
  'g',
  'defs',
  'linearGradient',
  'radialGradient',
])
const INLINE = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'button',
  'code',
  'em',
  'i',
  'img',
  'input',
  'label',
  'mark',
  's',
  'small',
  'span',
  'strong',
  'sub',
  'sup',
  'svg',
  'time',
  'u',
])

export function h(tag, attrs, ...children) {
  return {
    tag,
    attrs: attrs || {},
    children: children
      .flat(Infinity)
      .filter((c) => c !== null && c !== undefined && c !== false && c !== '')
      .map((c) => (typeof c === 'number' ? String(c) : c)),
  }
}

// SVG shapes are written self-closed, as in JSX.
const SVG_LEAF = new Set([
  'circle',
  'ellipse',
  'line',
  'path',
  'polygon',
  'polyline',
  'rect',
  'stop',
  'use',
])

const isEl = (n) => typeof n === 'object'
const pretty = (n) =>
  BLOCK.has(n.tag) &&
  n.children.length > 0 &&
  n.children.every((c) => isEl(c) && !INLINE.has(c.tag))
const kebab = (k) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escAttr = (s) => esc(s).replace(/"/g, '&quot;')

function htmlAttrs(attrs) {
  let out = ''
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue
    if (k === 'style') {
      const css = Object.entries(v)
        .map(([p, x]) => `${p.startsWith('--') ? p : kebab(p)}:${x}`)
        .join(';')
      out += ` style="${escAttr(css)}"`
    } else if (k === 'class') {
      const cls = String(v)
        .split(/\s+/)
        .filter((c) => c && !c.startsWith('$'))
        .join(' ')
      if (cls) out += ` class="${escAttr(cls)}"`
    } else out += v === true ? ` ${k}` : ` ${k}="${escAttr(v)}"`
  }
  return out
}

/** The tree as indented HTML. */
export function toHtml(node, depth = 0) {
  if (!isEl(node)) return esc(node)
  const pad = '  '.repeat(depth)
  const open = `<${node.tag}${htmlAttrs(node.attrs)}`
  if (VOID.has(node.tag)) return `${open}>`
  if (!node.children.length)
    return SVG_LEAF.has(node.tag) ? `${open} />` : `${open}></${node.tag}>`
  if (pretty(node))
    return `${open}>\n${node.children.map((c) => `${pad}  ${toHtml(c, depth + 1)}`).join('\n')}\n${pad}</${node.tag}>`
  return `${open}>${node.children.map((c) => toHtml(c, depth + 1)).join('')}</${node.tag}>`
}

const JSX_NAMES = {
  class: 'className',
  for: 'htmlFor',
  tabindex: 'tabIndex',
  srcset: 'srcSet',
  crossorigin: 'crossOrigin',
  referrerpolicy: 'referrerPolicy',
  fetchpriority: 'fetchPriority',
  autocomplete: 'autoComplete',
  enctype: 'encType',
  maxlength: 'maxLength',
  minlength: 'minLength',
  readonly: 'readOnly',
  novalidate: 'noValidate',
  inputmode: 'inputMode',
  spellcheck: 'spellCheck',
  autofocus: 'autoFocus',
  datetime: 'dateTime',
  'accept-charset': 'acceptCharset',
}
const jsxName = (k) =>
  JSX_NAMES[k] ??
  (/^(aria|data)-/.test(k)
    ? k
    : k.replace(/[-:]([a-z])/g, (_, c) => c.toUpperCase()))
const ident = (s) => /^[A-Za-z_$][\w$]*$/.test(s)

function jsxClass(value, css) {
  const parts = String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((c) =>
      c.startsWith('$')
        ? c.slice(1)
        : !css
          ? JSON.stringify(c)
          : ident(c)
            ? `${css}.${c}`
            : `${css}[${JSON.stringify(c)}]`,
    )
  if (!css && parts.every((p) => p.startsWith('"')))
    return JSON.stringify(parts.map((p) => JSON.parse(p)).join(' '))
  if (parts.length === 1) return `{${parts[0]}}`
  return `{\`${parts.map((p) => (p.startsWith('"') ? JSON.parse(p) : `\${${p}}`)).join(' ')}\`}`
}

function jsxAttrs(attrs, css) {
  let out = ''
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue
    const name = jsxName(k)
    if (k === 'style') {
      const body = Object.entries(v)
        .map(
          ([p, x]) =>
            `${ident(p) ? p : JSON.stringify(p)}: ${typeof x === 'number' ? x : JSON.stringify(String(x))}`,
        )
        .join(', ')
      out += ` style={{ ${body} }}`
    } else if (k === 'class') out += ` className=${jsxClass(v, css)}`
    else if (v === true) out += ` ${name}`
    else if (typeof v === 'number') out += ` ${name}={${v}}`
    else if (/["&\\\n{}]/.test(v)) out += ` ${name}={${JSON.stringify(v)}}`
    else out += ` ${name}="${v}"`
  }
  return out
}

// JSX text that needs no escaping: no braces, angle brackets, ampersands,
// quotes or line breaks, and no space at either end (JSX trims spaces at
// line breaks and joins lines).
const plainText = (s) =>
  /^[^{}<>&'"\s](?:[^{}<>&'"\n\r]*[^{}<>&'"\s])?$/.test(s)

/**
 * The tree as indented JSX. `css` is the name of an imported CSS module
 * object; without it, classes stay as strings.
 */
export function toJsx(node, { css, depth = 0 } = {}) {
  const pad = '  '.repeat(depth)
  if (!isEl(node)) return plainText(node) ? node : `{${JSON.stringify(node)}}`
  const open = `<${node.tag}${jsxAttrs(node.attrs, css)}`
  if (!node.children.length) return `${open} />`
  const kids = node.children.map((c) => toJsx(c, { css, depth: depth + 1 }))
  const one = kids.length === 1 && !isEl(node.children[0])
  const line = `${open}>${kids.join('')}</${node.tag}>`
  if (one && pad.length + line.length <= 100) return line
  return `${open}>\n${kids.map((k) => `${pad}  ${k}`).join('\n')}\n${pad}</${node.tag}>`
}
