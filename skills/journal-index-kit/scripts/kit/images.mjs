// Journal Index Kit: reads an image's pixel size from its header (JPEG,
// PNG, WebP, AVIF, SVG) so every <img> gets width and height and the page
// never shifts as images arrive, and figures keep their own shape instead
// of being cropped to a fixed frame.
import { readFileSync } from 'node:fs'

export function imageSize(file) {
  const b = readFileSync(file)
  // PNG
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
  // JPEG: walk the markers to the first SOFn
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i < b.length) {
      if (b[i] !== 0xff) { i++; continue }
      const m = b[i + 1]
      const len = b.readUInt16BE(i + 2)
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: b.readUInt16BE(i + 7), h: b.readUInt16BE(i + 5) }
      i += 2 + len
    }
  }
  // WebP
  if (b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') {
    const kind = b.toString('ascii', 12, 16)
    if (kind === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) }
    if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff }
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21)
      return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) }
    }
  }
  // AVIF / HEIF: the ispe box
  const ispe = b.indexOf('ispe')
  if (b.toString('ascii', 4, 8) === 'ftyp' && ispe > 0) return { w: b.readUInt32BE(ispe + 8), h: b.readUInt32BE(ispe + 12) }
  // SVG
  const s = b.toString('utf8', 0, 2000)
  const vb = /viewBox="\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(s)
  if (vb) return { w: Math.round(+vb[1]), h: Math.round(+vb[2]) }
  return null
}
