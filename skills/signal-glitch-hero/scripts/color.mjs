// Colour helpers: mixing, WCAG contrast, and nudging a colour until it reads.

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export const isHex = (c) => HEX.test(c)

export function rgb(hex) {
  let h = hex.slice(1)
  if (h.length === 3) h = h.replace(/(.)/g, '$1$1')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
}
const toHex = (c) =>
  '#' +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

/** a moved t of the way to b. */
export const mix = (a, b, t) => {
  const [x, y] = [rgb(a), rgb(b)]
  return toHex(x.map((v, i) => v + (y[i] - v) * t))
}
export function lum(hex) {
  const l = rgb(hex).map((v) => {
    v /= 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
export const isDark = (c) => lum(c) < 0.2

/** `color`, moved toward white or black (whichever helps) until it reads on every one of `grounds`. */
export function readable(color, grounds, ratio = 4.5) {
  const list = [grounds].flat()
  const to = isDark(list[0]) ? '#ffffff' : '#000000'
  let c = color
  for (
    let t = 0.04;
    list.some((g) => contrast(c, g) < ratio) && t <= 1;
    t += 0.04
  )
    c = mix(color, to, t)
  return c
}
