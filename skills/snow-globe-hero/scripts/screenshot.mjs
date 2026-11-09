#!/usr/bin/env node
// Full-page screenshots of the built page at desktop and phone width, to
// look over before handing off:
//
//   node scripts/screenshot.mjs out/index.html [--scale=1]
//
// Writes out/screens/desktop.png (1440 wide) and out/screens/mobile.png
// (390 wide). Set CHROME_PATH if Chrome isn't found.
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chrome, findChrome, inFrame } from './chrome.mjs'

const SIZES = { desktop: 1440, mobile: 390 }

const args = process.argv.slice(2)
const input = resolve(args.find((a) => !a.startsWith('--')) || 'out/index.html')
const scale = Number(
  args.find((a) => a.startsWith('--scale='))?.split('=')[1] ?? 1,
)
if (!existsSync(input)) {
  console.error(`screenshot: ${input} not found; build the page first`)
  process.exit(1)
}
const bin = findChrome()
if (!bin) {
  console.error(
    'screenshot: no Chrome, Chromium or Edge found; set CHROME_PATH',
  )
  process.exit(1)
}

// Chrome's command line only shoots the window, so first measure how tall
// the page is at each width, then shoot a window that tall.
const widths = Object.values(SIZES)
const heights = inFrame(
  bin,
  input,
  widths,
  () => document.documentElement.scrollHeight,
)
const dir = join(dirname(input), 'screens')
mkdirSync(dir, { recursive: true })
for (const [i, [name, w]] of Object.entries(SIZES).entries()) {
  const height = Math.min(heights[i] ?? 900, 16000)
  const file = join(dir, `${name}.png`)
  chrome(bin, pathToFileURL(input).href, [
    `--window-size=${w},${height}`,
    `--force-device-scale-factor=${scale}`,
    `--screenshot=${file}`,
  ])
  const shown = relative(process.cwd(), file)
  console.log(`  ${shown.startsWith('..') ? file : shown}  ${w}×${height}`)
}
