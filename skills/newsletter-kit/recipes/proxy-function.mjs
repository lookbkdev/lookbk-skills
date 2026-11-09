// Newsletter Kit recipe: a small server function for lists that need a
// secret key. The page never holds the key. It posts JSON to this function
// (form.provider "proxy", form.action "/api/subscribe"), and the function adds
// the key from its environment, calls your list, and answers the page with
// one word it understands: {"state": "confirm" | "subscribed" | "already" | "invalid"}.
//
// It is written against the standard Request and Response objects, so the
// same code runs as a Cloudflare Worker (export default as is), a Deno or Bun
// server, or inside a Netlify or Vercel function (call handle(request, env)
// with process.env as env).
//
// Environment, set in your host's dashboard, never in the page:
//   LIST_ENDPOINT   the list's "add subscriber" API address (from its docs)
//   LIST_KEY        the secret key
//   LIST_AUTH       how the key is sent: "bearer" (Authorization: Bearer KEY,
//                   the default), "basic" (KEY as the user name), or a header
//                   name such as "X-Api-Key"
//   LIST_FIELD      the email field name in the API's JSON body (default email)
//   LIST_EXTRA      optional JSON merged into the body, for example
//                   {"double_opt_in": true} or {"list_ids": ["…"]}
//   DOUBLE_OPT_IN   "false" if the list adds people without a confirming email
//   ALLOW_ORIGIN    your site's origin, if the page and function differ
//
// Check your list's current API docs for the exact address, field name and
// the status it uses for "already subscribed" (often 409, sometimes 400 with
// a message): ALREADY below matches the common wordings.

const ALREADY = /already|exists|duplicate|member exists/i
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/

export async function handle(request, env) {
  const cors = env.ALLOW_ORIGIN ? { 'Access-Control-Allow-Origin': env.ALLOW_ORIGIN, 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' } : {}
  const reply = (status, state) => new Response(JSON.stringify({ state }), { status, headers: { 'Content-Type': 'application/json', ...cors } })
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return reply(405, 'error')

  let data
  try {
    data = (request.headers.get('content-type') ?? '').includes('json') ? await request.json() : Object.fromEntries(await request.formData())
  } catch {
    return reply(400, 'invalid')
  }
  // The spam trap: people never see this field, so anything in it is a bot.
  // Answer as if it worked, and send nothing.
  if (data.website) return reply(200, 'confirm')
  const email = String(data.email ?? '').trim()
  if (!EMAIL.test(email) || email.length > 254) return reply(422, 'invalid')

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  const auth = env.LIST_AUTH ?? 'bearer'
  if (auth === 'bearer') headers.Authorization = `Bearer ${env.LIST_KEY}`
  else if (auth === 'basic') headers.Authorization = `Basic ${btoa(`${env.LIST_KEY}:`)}`
  else headers[auth] = env.LIST_KEY
  const body = { [env.LIST_FIELD ?? 'email']: email, ...(env.LIST_EXTRA ? JSON.parse(env.LIST_EXTRA) : {}) }

  let res, text
  try {
    res = await fetch(env.LIST_ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })
    text = await res.text()
  } catch {
    return reply(502, 'error')
  }
  if (res.status === 409 || (res.status >= 400 && res.status < 500 && ALREADY.test(text))) return reply(409, 'already')
  if (res.status === 400 || res.status === 422) return reply(422, 'invalid')
  if (!res.ok) return reply(502, 'error')
  return reply(200, env.DOUBLE_OPT_IN === 'false' ? 'subscribed' : 'confirm')
}

export default { fetch: (request, env) => handle(request, env) }
