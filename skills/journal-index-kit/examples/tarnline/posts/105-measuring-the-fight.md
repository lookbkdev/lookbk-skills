---
no: 105
title: "Rebuilding compaction, part 2: measuring the fight"
dek: Before changing the scheduler, we had to be able to see it.
section: Storage
date: 2026-08-06
author: [Dara Quint, Yusuf Adeyemi]
series: { name: Rebuilding compaction, part: 2 }
lead:
  chart: charts/queue-depth.json
  caption: Disk queue depth on one ingest node over a day. Compaction and the morning peak overlap from 08:00.
---

Part 1 described the write cliff. This part is about seeing it clearly enough to fix it.

We added one metric to every storage node: disk queue depth, split by who issued the I/O. That was enough. On the chart above, the queue sits around four for most of the day and climbs past twenty from 08:00, when compaction at the second level starts while the morning ingest peak is still rising.

## Why it took three weeks

The metric was easy. Agreeing on what it meant was not. We spent most of the time ruling out other explanations, network stalls, a noisy neighbour on shared hardware, a slow flush path, until the only thing left was the scheduler.
