// Journal Index Kit: finds the Chrome, Chromium or Edge already on the
// machine for check.mjs and record.mjs. Nothing to install. Set CHROME_PATH
// to use another browser binary.
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'

export function findChrome() {
  return [
    process.env.CHROME_PATH,
    process.env.CHROMIUM_PATH,
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
