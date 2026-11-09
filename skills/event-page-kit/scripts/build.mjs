#!/usr/bin/env node
// Event Page Kit entry point; the work is in scripts/kit/build.mjs.
import { main } from './kit/build.mjs'

await main(process.argv.slice(2))
