#!/usr/bin/env node
// Builds the hero from hero.json: node scripts/build.mjs hero.json out
// The work is done by the Motion Heroes kit (scripts/kit/build.mjs) with
// this package's effect (scripts/effect/).
import { main } from './kit/build.mjs'

await main()
