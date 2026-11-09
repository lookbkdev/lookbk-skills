// Headless Chrome helpers for check.mjs and screenshot.mjs. Nothing to
// install: it drives the Chrome, Chromium or Edge already on the machine.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export function findChrome() {
  return [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    `${homedir()}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/microsoft-edge',
    '/snap/bin/chromium',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ]
    .filter(Boolean)
    .find((p) => existsSync(p))
}

/** Runs headless Chrome on a URL and returns what it printed. */
export function chrome(bin, url, args) {
  return execFileSync(
    bin,
    [
      '--headless=new',
      '--disable-gpu',
      ...(process.getuid?.() === 0 ? ['--no-sandbox'] : []),
      '--hide-scrollbars',
      '--virtual-time-budget=8000',
      ...args,
      url,
    ],
    { stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
  ).toString()
}

/**
 * Loads the page in a frame exactly `width` px wide, once per width, and
 * runs `fn` in it after its fonts have loaded. Returns fn's result for each
 * width (anything JSON can hold), or null where the page didn't finish.
 *
 * The frame is there because Chrome's window can't be narrower than 500px,
 * so a 390px phone can't be measured in the window itself.
 */
export function inFrame(bin, page, widths, fn) {
  const dir = dirname(page)
  const probe = join(dir, '.lookbook-probe.html')
  const frame = join(dir, '.lookbook-frame.html')
  const html = readFileSync(page, 'utf8')
  const script = `<script>addEventListener('load', () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => new Promise((r) => setTimeout(r, 100))).then(() => parent.postMessage({ lookbook: JSON.stringify((${fn.toString()})()) }, '*')))</script>`
  writeFileSync(
    probe,
    html.includes('</body>')
      ? html.replace('</body>', `${script}</body>`)
      : html + script,
  )
  writeFileSync(
    frame,
    `<!doctype html><meta charset="utf-8"><body style="margin:0"><script>
addEventListener('message', (e) => {
  if (!e.data || typeof e.data.lookbook !== 'string') return
  const out = document.createElement('script')
  out.type = 'application/json'
  out.id = 'lookbook-result'
  out.textContent = e.data.lookbook.replace(/</g, '\\\\u003c')
  document.body.appendChild(out)
})
const f = document.createElement('iframe')
f.src = '.lookbook-probe.html'
f.style.cssText = 'border:0;display:block;width:' + location.hash.slice(1) + 'px;height:900px'
document.body.appendChild(f)
</script>`,
  )
  try {
    return widths.map((w) => {
      const dom = chrome(bin, `${pathToFileURL(frame).href}#${w}`, [
        `--window-size=${Math.max(w, 500)},900`,
        '--dump-dom',
      ])
      const found =
        /<script type="application\/json" id="lookbook-result">([\s\S]*?)<\/script>/.exec(
          dom,
        )
      return found ? JSON.parse(found[1]) : null
    })
  } finally {
    rmSync(probe, { force: true })
    rmSync(frame, { force: true })
  }
}
