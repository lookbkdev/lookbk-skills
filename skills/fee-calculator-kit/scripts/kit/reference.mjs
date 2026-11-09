// Fee Calculator Kit: an independent second implementation of the sum, used
// only by check.mjs. It shares no code with kit/engine.js: every quantity is
// an exact fraction (BigInt numerator and denominator), rounding happens once
// at the end of each line, and the page's figures must match it exactly.

const g = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a }
class Q {
  constructor(n, d = 1n) { if (d < 0n) { n = -n; d = -d } const k = g(n, d) || 1n; this.n = n / k; this.d = d / k }
  static of(s) { const [i, f = ''] = String(s).split('.'); return new Q(BigInt(i + f), 10n ** BigInt(f.length)) }
  add(o) { return new Q(this.n * o.d + o.n * this.d, this.d * o.d) }
  sub(o) { return new Q(this.n * o.d - o.n * this.d, this.d * o.d) }
  mul(o) { return new Q(this.n * o.n, this.d * o.d) }
  div(o) { return new Q(this.n * o.d, this.d * o.n) }
  /** to an integer count of 10^-dp units, by rule */
  round(dp, mode) {
    const s = 10n ** BigInt(dp)
    const n = this.n * s, d = this.d
    const neg = n < 0n
    const a = neg ? -n : n
    let q = a / d
    const r2 = (a % d) * 2n
    if (mode === 'half-up' && r2 >= d && a % d !== 0n) q += 1n
    if (mode === 'half-even' && (r2 > d || (r2 === d && q % 2n === 1n))) q += 1n
    if (mode === 'ceil' && a % d !== 0n) q += 1n
    return neg ? -q : q
  }
}
const pow = (n) => 10n ** BigInt(n)

function pick(row, toggles) {
  for (const k of row.cases) if (Object.entries(k.when ?? {}).every(([id, v]) => toggles[id] === v)) return k
  return null
}

function oneSide(c, A, toggles, rows, marginPct) {
  const fd = c.from.decimals, td = c.to.decimals
  const fees = rows.map((row) => {
    const k = pick(row, toggles)
    if (!k) return 0n
    let q = new Q(0n)
    if (k.fixed) q = q.add(Q.of(k.fixed))
    if (k.percent) q = q.add(A.mul(Q.of(k.percent)).div(new Q(100n)))
    return q.round(fd, c.rounding)
  })
  const feeTotal = fees.reduce((a, b) => a + b, 0n)
  const amountMinor = A.round(fd, 'down')
  let net = amountMinor - feeTotal
  if (net < 0n) net = 0n
  const netQ = new Q(net, pow(fd))
  const same = c.from.code === c.to.code
  const mid = same ? new Q(1n) : Q.of(c.rate.mid)
  const m = same ? new Q(0n) : Q.of(marginPct)
  const rateUnits = mid.mul(new Q(100n).sub(m)).div(new Q(100n)).round(c.rate.decimals, 'down')
  const rate = new Q(rateUnits, pow(c.rate.decimals))
  const recv = netQ.mul(rate).round(td, c.receiveRounding)
  const margin = same ? 0n : netQ.mul(mid.sub(rate)).div(mid).round(fd, c.rounding)
  return { fees, feeTotal, rate, rateUnits, recv, margin, total: feeTotal + margin }
}

/** every number the section shows for one amount, as integers in their own units */
export function reference(c, amountMinor, toggles) {
  const fd = c.from.decimals, td = c.to.decimals
  const A = new Q(amountMinor, pow(fd))
  const us = oneSide(c, A, toggles, c.fees, c.rate.margin)
  const bk = c.compare ? oneSide(c, A, toggles, c.compare.fees, c.compare.margin) : null
  const pct = (x) => new Q(x, pow(fd)).div(A).mul(new Q(100n)).round(2, 'half-up') // hundredths of a per cent
  const per = (x) => new Q(x, pow(fd)).div(A).mul(new Q(100n)).round(fd, 'half-up') // per 100 of the sending currency
  const pf = per(us.feeTotal), pm = per(us.margin)
  const out = {
    us, bk,
    totalBp: pct(us.total),
    per100: { fees: pf, margin: pm, arrive: 100n * pow(fd) - pf - pm, zoom: Number(new Q(pf + pm, pow(fd)).round(0, 'ceil')) + 1 },
  }
  if (bk) {
    out.bkTotalBp = pct(bk.total)
    out.diff = us.recv - bk.recv
    const mag = out.diff < 0n ? -out.diff : out.diff
    out.diffSend = c.from.code === c.to.code ? null : new Q(mag, pow(td)).div(us.rate).round(fd, 'half-up')
  }
  return out
}
