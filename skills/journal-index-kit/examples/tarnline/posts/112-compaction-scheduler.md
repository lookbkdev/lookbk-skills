---
no: 112
title: The compaction scheduler that stopped fighting our writes
dek: Compaction and ingest shared one disk and one opinion about who goes first. We gave the scheduler a token bucket per tier, and p99 write latency fell from 41 ms to 6.
section: Storage
date: 2026-11-04
author: [Dara Quint, Yusuf Adeyemi]
series: { name: Rebuilding compaction, part: 3 }
featured: true
lead:
  chart: charts/p99-write-latency.json
  caption: p99 write latency on the eu-2 ingest tier over 14 days. The new scheduler shipped on day 8.
---

For two years, the busiest hour of the day on our ingest tier was also the hour our storage engine chose to reorganise itself. Compaction is how an LSM tree stays readable, and it is not optional. But it was taking the disk at exactly the moment writes needed it most.

The old scheduler had one rule: compact a level once it passes its size threshold. That rule knows nothing about what else the disk is doing.[^default] In part 2 we measured the result. This part is about the fix.

## One bucket per tier

The new scheduler hands out disk time as tokens. Each tier of work gets a bucket: ingest, flushes, and compaction at each level. Ingest refills first, and compaction spends what is left. When writes spike, compaction slows down rather than stopping, so read amplification stays bounded.[^bounded]

```rust scheduler/budget.rs {3-4}
pub fn grant(&mut self, tier: Tier, want: u64) -> u64 {
    // ingest refills first; compaction spends what is left
    let bucket = &mut self.buckets[tier as usize];
    bucket.refill(self.clock.now());
    let granted = want.min(bucket.tokens);
    bucket.tokens -= granted;
    granted
}
```

Granting partial budgets matters more than it looks. A compaction job that receives half of what it asked for still makes progress, so the backlog never builds into the cliff we started with. The old scheduler was all or nothing, and nothing was what compaction got during the morning peak, until the backlog forced its hand at the worst moment.

## Choosing the refill rate

A token bucket is only as good as its refill rate, and we did not want another constant that someone would have to tune by hand on every cluster. The scheduler measures the disk instead. Every second it reads the device’s completed I/O and queue depth, and sets the refill rate so that the queue stays below a target depth.

```rust scheduler/refill.rs
let observed = disk.queue_depth();
let error = TARGET_DEPTH - observed;
self.rate = (self.rate + GAIN * error).clamp(MIN_RATE, MAX_RATE);
```

It is a plain proportional controller, and we were tempted to make it cleverer. We didn’t. The simple version settled within ten seconds on every disk type we run, and it is easy to reason about at three in the morning, which is when someone will have to.[^pid]

> !pull Compaction should slow down when the disk is busy, _not stop._
> cite: Design note, March

## Results on eu-2

We shipped to the eu-2 ingest tier first because it has the spikiest traffic we serve. The chart below is the same data as the one at the top of this post, from the day before the change to six days after.

![p99 write latency over 14 days](charts/p99-write-latency.json "Fig. 2 | p99 write latency on eu-2. The shaded area is the new scheduler.")

Median p99 write latency fell from 41 ms to 6 ms and has stayed there. Read amplification rose slightly at peak and returned to its old level within twenty minutes each time. Disk utilisation went up by about four per cent overall, which is the point: the disk now spends its quiet minutes compacting instead of sitting idle and then panicking.

## What we would do again

Measure before changing anything. Part 2 of this series took three weeks and produced no code that shipped, and it is the reason this part took two. We also kept the old scheduler behind a flag for a month, which we never needed, and which let everyone sleep.

The last part of this series compares leveled and tiered compaction under the new scheduler, with real workloads rather than benchmarks.

[^default]: This is the default in most LSM engines, including the one we forked in 2021. It is a fine default until ingest is spiky.
[^bounded]: Bounded, not fixed. Under a sustained spike, read amplification rose from 4.1 to 5.3 and came back within twenty minutes.
[^pid]: We did try adding integral and derivative terms on a test cluster. They made the graphs prettier and the behaviour no better.
