#!/usr/bin/env node
// Event Page Kit entry point; the work is in scripts/kit/check.mjs.
import { main } from './kit/check.mjs'

await main(process.argv.slice(2))
