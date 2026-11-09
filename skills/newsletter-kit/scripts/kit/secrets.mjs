// Newsletter Kit: finds anything that looks like a secret key, so a key can
// never ship inside a public page. The build runs it over every value (and
// every key name) in letter.json and again over the finished page, and
// refuses to write when it finds one. A sign-up form only ever needs public
// identifiers (a form ID, a list's public ID, a username); anything that needs
// a secret goes through a small server function (recipes/proxy-function.mjs).

// Known key shapes. Each is [name, pattern].
export const KEY_PATTERNS = [
  ['a payment secret key (sk_live_, sk_test_, rk_live_)', /\b[rs]k_(live|test)_[0-9A-Za-z]{10,}/],
  ['a webhook signing secret (whsec_)', /\bwhsec_[0-9A-Za-z]{10,}/],
  ['an AWS access key (AKIA…)', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['a Google API key (AIza…)', /\bAIza[0-9A-Za-z_-]{30,}/],
  ['a GitHub token (ghp_, gho_, ghs_, github_pat_)', /\b(gh[pousr]_[0-9A-Za-z]{20,}|github_pat_[0-9A-Za-z_]{20,})/],
  ['a Slack token (xoxb-, xoxp-)', /\bxox[abposr]-[0-9A-Za-z-]{10,}/],
  ['an OpenAI or Anthropic style key (sk-…)', /\bsk-(ant-|proj-)?[0-9A-Za-z_-]{20,}/],
  ['a SendGrid key (SG.…)', /\bSG\.[0-9A-Za-z_-]{16,}\.[0-9A-Za-z_-]{16,}/],
  ['a mailing-list API key with a data-centre suffix (…-us12)', /\b[0-9a-f]{32}-[a-z]{2}\d{1,2}\b/],
  ['an email-API key (re_…, key-…, xkeysib-…)', /\b(re_[0-9A-Za-z]{16,}|key-[0-9a-f]{32}|xkeysib-[0-9a-f]{40,})/],
  ['a signed token (JWT)', /\beyJ[0-9A-Za-z_-]{8,}\.eyJ[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{8,}/],
  ['a private key block', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['a password or token in a URL (user:secret@)', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:@]+:[^\s/@]{6,}@/i],
  ['an "api_key=" / "token=" / "secret=" parameter', /[?&](api[_-]?key|apikey|access[_-]?token|token|secret|client[_-]?secret|password)=[^&\s]{6,}/i],
]
// Field names that only ever hold a secret.
export const KEY_NAMES = /^(api[_-]?key|apikey|secret|client[_-]?secret|access[_-]?token|auth[_-]?token|bearer|password|private[_-]?key|token)$/i

/** Shannon entropy in bits per character. */
export function entropy(s) {
  const n = new Map()
  for (const ch of s) n.set(ch, (n.get(ch) ?? 0) + 1)
  let e = 0
  for (const c of n.values()) { const p = c / s.length; e -= p * Math.log2(p) }
  return e
}

/**
 * A long run of key-like characters with high entropy and a digit in it:
 * 24+ characters, at least 3.6 bits a character, with digits and letters
 * mixed. Words, sentences, camelCase names, dates and UUIDs (split at their
 * hyphens) all fall below it.
 */
export function highEntropy(text) {
  const hits = []
  for (const m of String(text).matchAll(/[A-Za-z0-9_+/=]{24,}/g)) {
    const t = m[0]
    if (!/\d/.test(t) || !/[A-Za-z]/.test(t)) continue
    const digits = (t.match(/\d/g) ?? []).length
    if (digits < 3) continue
    if (/^[0-9a-f]{32,}$/i.test(t) || entropy(t) >= 3.6) hits.push(t)
  }
  return hits
}

/** Every secret-looking value in `text`, as messages. */
export function scanText(text, where) {
  const out = []
  for (const [name, re] of KEY_PATTERNS) {
    const m = re.exec(String(text))
    if (m) out.push(`${where}: looks like ${name} ("${mask(m[0])}")`)
  }
  for (const t of highEntropy(text)) out.push(`${where}: "${mask(t)}" looks like a secret key (a long random string)`)
  return out
}
/** Walks every key and value of a JSON value. */
export function scanJSON(value, path = 'letter.json') {
  const out = []
  const walk = (v, p) => {
    if (typeof v === 'string') out.push(...scanText(v, p))
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`))
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (KEY_NAMES.test(k) && x !== '' && x != null) out.push(`${p}.${k}: a field called "${k}" can only hold a secret; secrets never go in the page (see recipes/proxy-function.mjs)`)
        walk(x, `${p}.${k}`)
      }
  }
  walk(value, path)
  return out
}
const mask = (s) => (s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-2)}` : s)
