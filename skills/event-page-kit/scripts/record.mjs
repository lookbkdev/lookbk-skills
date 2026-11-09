#!/usr/bin/env node
// Event Page Kit entry point; the work is in scripts/kit/record.mjs.
import { main } from './kit/record.mjs'

await main(process.argv.slice(2))
