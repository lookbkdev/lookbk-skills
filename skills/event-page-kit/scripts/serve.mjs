#!/usr/bin/env node
// Event Page Kit entry point; the work is in scripts/kit/serve.mjs.
import { main } from './kit/serve.mjs'

await main(process.argv.slice(2))
