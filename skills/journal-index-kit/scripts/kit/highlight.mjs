// Journal Index Kit: build-time syntax colouring, so code needs no script
// in the page. A small tokenizer, not a parser: comments, strings,
// numbers, keywords, types (capitalised names and the language's built-in
// types) and called functions. Unknown languages are set plain.
// Output is one <span class="ji-l"> per line so lines can be numbered and
// marked.

const KW = {
  rust: 'as async await break const continue crate else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while dyn',
  go: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false',
  js: 'async await break case catch class const continue default delete do else export extends finally for from function if import in instanceof let new of return static super switch this throw try typeof var void while yield null undefined true false',
  python: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield None True False',
  sql: 'select from where group by order having limit offset join left right inner outer on as and or not null insert into values update set delete create table index with union all distinct case when then else end interval',
  bash: 'if then else elif fi for in do done while case esac function return export local echo',
}
KW.ts = KW.js + ' interface type enum implements readonly declare namespace'
KW.sh = KW.bash
KW.shell = KW.bash
KW.javascript = KW.js
KW.typescript = KW.ts
KW.py = KW.python
const TYPES = {
  rust: 'u8 u16 u32 u64 u128 usize i8 i16 i32 i64 i128 isize f32 f64 bool char str String Vec Option Result Some None Ok Err Box Arc',
  go: 'int int8 int16 int32 int64 uint uint8 uint16 uint32 uint64 float32 float64 string bool byte rune error any',
  ts: 'string number boolean unknown never any void bigint',
}
const COMMENT = { python: ['#'], bash: ['#'], sh: ['#'], shell: ['#'], sql: ['--'], py: ['#'] }

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const knownLanguage = (lang) => !!KW[String(lang).toLowerCase()]

/** Returns an array of line HTML strings. */
export function highlight(code, lang) {
  const l = String(lang).toLowerCase()
  const kw = KW[l] ? new Set(KW[l].split(' ')) : null
  if (!kw) return code.split('\n').map(esc)
  const types = new Set((TYPES[l] ?? TYPES[l === 'js' ? '' : l] ?? '').split(' ').filter(Boolean))
  const line = COMMENT[l] ?? ['//']
  const block = l === 'python' || l === 'bash' || l === 'sh' || l === 'sql' ? null : ['/*', '*/']
  const ci = l === 'sql'
  const toks = []
  let i = 0
  const push = (cls, text) => toks.push({ cls, text })
  while (i < code.length) {
    const rest = code.slice(i)
    const lc = line.find((c) => rest.startsWith(c))
    if (lc) { const e = code.indexOf('\n', i); const end = e < 0 ? code.length : e; push('c', code.slice(i, end)); i = end; continue }
    if (block && rest.startsWith(block[0])) { const e = code.indexOf(block[1], i + 2); const end = e < 0 ? code.length : e + 2; push('c', code.slice(i, end)); i = end; continue }
    const q = rest[0]
    if (q === '"' || q === '`' || (q === "'" && l !== 'rust')) {
      let j = i + 1
      while (j < code.length && code[j] !== q && code[j] !== '\n') j += code[j] === '\\' ? 2 : 1
      push('s', code.slice(i, j + 1)); i = j + 1; continue
    }
    let m
    if ((m = /^\d[\d_]*(\.\d+)?([eE][+-]?\d+)?[a-z]*/.exec(rest)) && !/\w/.test(code[i - 1] ?? '')) { push('n', m[0]); i += m[0].length; continue }
    if ((m = /^[A-Za-z_][\w]*/.exec(rest))) {
      const w = m[0]
      const next = code.slice(i + w.length).match(/^\s*(\(|!\()/)
      if (kw.has(ci ? w.toLowerCase() : w)) push('k', w)
      else if (types.has(w) || (/^[A-Z]/.test(w) && !ci)) push('t', w)
      else if (next) push('f', w)
      else push('', w)
      i += w.length
      continue
    }
    push('', code[i]); i++
  }
  // into lines, closing and reopening spans at each newline
  const lines = ['']
  for (const t of toks)
    t.text.split('\n').forEach((part, k) => {
      if (k > 0) lines.push('')
      if (part) lines[lines.length - 1] += t.cls ? `<span class="ji-h${t.cls}">${esc(part)}</span>` : esc(part)
    })
  return lines
}
