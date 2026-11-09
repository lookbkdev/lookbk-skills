#!/usr/bin/env node
// Itinerary Kit: measures a route before you write trip.json, the same way
// the build does (distance along the points; climb from elevation sampled
// every 100 m and averaged over 700 m). Also turns GPX tracks, one file per
// day in order, into the route.geojson the build reads.
//
//   node scripts/measure.mjs route.geojson
//   node scripts/measure.mjs --gpx day1.gpx day2.gpx ... --out route.geojson
import { readFileSync, writeFileSync } from 'node:fs'
import { measure } from './kit/geo.mjs'
import { effortOf, naismith } from './kit/schema.mjs'

const argv = process.argv.slice(2)
let route
if (argv[0] === '--gpx') {
  const o = argv.indexOf('--out')
  const files = argv.slice(1, o < 0 ? undefined : o)
  route = { type: 'FeatureCollection', features: files.map((f, i) => {
    const xml = readFileSync(f, 'utf8')
    const pts = [...xml.matchAll(/<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>|<trkpt[^>]*lon="([-\d.]+)"[^>]*lat="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g)].map((m) => {
      const lat = +(m[1] ?? m[5]), lon = +(m[2] ?? m[4]), ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3] ?? m[6] ?? '')
      return [lon, lat, ele ? +ele[1] : NaN]
    })
    if (pts.some((p) => isNaN(p[2]))) console.warn(`${f}: some points have no <ele>; add elevation before building`)
    return { type: 'Feature', properties: { day: i + 1 }, geometry: { type: 'LineString', coordinates: pts } }
  }) }
  if (o >= 0) { writeFileSync(argv[o + 1], JSON.stringify(route)); console.log(`wrote ${argv[o + 1]} (${files.length} days)`) }
} else if (argv[0]) route = JSON.parse(readFileSync(argv[0], 'utf8'))
else { console.log('usage: node scripts/measure.mjs route.geojson\n       node scripts/measure.mjs --gpx day1.gpx day2.gpx --out route.geojson'); process.exit(1) }
const lines = route.features.filter((f) => f.geometry?.type === 'LineString').sort((a, b) => (a.properties?.day ?? 0) - (b.properties?.day ?? 0))
let total = 0
for (const [i, f] of lines.entries()) {
  const m = measure(f.geometry.coordinates)
  total += m.km
  const e = effortOf(m.km, m.up)
  console.log(`day ${i + 1}: ${m.km.toFixed(1)} km, +${Math.round(m.up)} m, -${Math.round(m.down)} m, ${Math.round(m.min)} to ${Math.round(m.max)} m; on foot ${naismith(m.km, m.up)}, ${e.word} on a good path (${e.points} points)`)
}
console.log(`total ${total.toFixed(1)} km`)
