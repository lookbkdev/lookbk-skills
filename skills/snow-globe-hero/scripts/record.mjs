#!/usr/bin/env node
// Records the built hero: node scripts/record.mjs out/index.html [--seconds 8] [--size 1920x1080] [--fps 30]
// The work is done by the Motion Heroes kit (scripts/kit/record.mjs).
import { main } from './kit/record.mjs'

await main()
