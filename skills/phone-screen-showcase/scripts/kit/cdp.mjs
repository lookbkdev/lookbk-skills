// Motion Heroes kit: a small Chrome DevTools Protocol client over
// --remote-debugging-pipe. Nothing to install: it starts the Chrome,
// Chromium or Edge already on the machine (found like chrome.mjs does, or
// CHROME_PATH) and talks to it on file descriptors 3 and 4, which works the
// same on macOS, Windows and Linux.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findChrome } from '../chrome.mjs'

/** chrome.mjs's list, plus per-user installs it doesn't look in. */
export function findBrowser() {
  const found = findChrome()
  if (found) return found
  const local = process.env.LOCALAPPDATA
  const more = [
    local && join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    local && join(local, 'Chromium', 'Application', 'chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/chromium-freeworld',
    '/opt/google/chrome/chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ]
  return more.filter(Boolean).find((p) => existsSync(p))
}

/**
 * Starts headless Chrome with a window of `width`×`height` and returns
 * { send(method, params, sessionId), on(event, fn), page(), close() }.
 */
export async function launch({ width, height, bin = findBrowser(), args: extra = [] }) {
  if (!bin) throw new Error('no Chrome, Chromium or Edge found; set CHROME_PATH')
  const profile = mkdtempSync(join(tmpdir(), 'motion-hero-'))
  const args = [
    '--headless=new',
    '--remote-debugging-pipe',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--mute-audio',
    '--force-color-profile=srgb',
    '--ignore-gpu-blocklist',
    // WebGL on machines without a usable GPU (CI, virtual machines)
    '--enable-unsafe-swiftshader',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding',
    '--disable-extensions',
    `--window-size=${width},${height}`,
    ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
    ...extra,
    'about:blank',
  ]
  const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] })
  let log = ''
  proc.stderr.on('data', (d) => (log = (log + d).slice(-4000)))
  const out = proc.stdio[3]
  const inp = proc.stdio[4]
  let id = 0
  const waiting = new Map()
  const listeners = new Map()
  let buf = Buffer.alloc(0)
  let closed = false
  inp.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk])
    let end
    while ((end = buf.indexOf(0)) !== -1) {
      const msg = JSON.parse(buf.subarray(0, end).toString('utf8'))
      buf = buf.subarray(end + 1)
      if (msg.id && waiting.has(msg.id)) {
        const { ok, no, method } = waiting.get(msg.id)
        waiting.delete(msg.id)
        if (msg.error) no(new Error(`${method}: ${msg.error.message}`))
        else ok(msg.result)
      } else if (msg.method) for (const fn of listeners.get(msg.method) ?? []) fn(msg.params, msg.sessionId)
    }
  })
  const died = new Promise((_, no) =>
    proc.on('exit', (code) => {
      closed = true
      const err = new Error(`Chrome exited (${code}) ${log.split('\n').slice(-3).join(' ')}`)
      for (const w of waiting.values()) w.no(err)
      no(err)
    }),
  )
  died.catch(() => {})
  const send = (method, params = {}, sessionId) =>
    new Promise((ok, no) => {
      if (closed) return no(new Error('Chrome has exited'))
      const msg = { id: ++id, method, params }
      if (sessionId) msg.sessionId = sessionId
      waiting.set(msg.id, { ok, no, method })
      out.write(JSON.stringify(msg) + '\0')
    })
  const on = (event, fn) => listeners.set(event, [...(listeners.get(event) ?? []), fn])
  const once = (event, sessionId, ms = 30000) =>
    new Promise((ok, no) => {
      const t = setTimeout(() => no(new Error(`timed out waiting for ${event}`)), ms)
      on(event, (p, s) => {
        if (!sessionId || s === sessionId) {
          clearTimeout(t)
          ok(p)
        }
      })
    })

  /** A new tab, attached; returns a session-bound send. */
  async function page() {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const s = (method, params) => send(method, params, sessionId)
    return { sessionId, send: s, once: (event, ms) => once(event, sessionId, ms) }
  }

  async function close() {
    if (!closed) {
      await Promise.race([send('Browser.close').catch(() => {}), new Promise((r) => setTimeout(r, 3000))])
      if (!closed) proc.kill()
    }
    await new Promise((r) => setTimeout(r, 200))
    try {
      rmSync(profile, { recursive: true, force: true, maxRetries: 3 })
    } catch {}
  }
  return { send, on, page, close, bin }
}
