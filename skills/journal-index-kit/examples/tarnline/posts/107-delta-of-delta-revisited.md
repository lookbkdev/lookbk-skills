---
no: 107
title: Delta-of-delta, revisited
dek: Timestamp compression, and the bytes we were leaving on disk for jittered series.
section: Storage
date: 2026-09-02
author: Dara Quint
lead:
  chart: charts/bytes-per-point.json
  caption: Bytes per stored point by series type, before and after the new bit packing.
---

We store timestamps as the difference between consecutive differences, which is close to zero for series that report on a regular clock. It is a well-known scheme and it works very well, for regular series.

Real series jitter. A host that reports every ten seconds actually reports at 9.98, 10.03, 10.01 seconds. Our encoding spent a whole extra byte on most of those points. We changed the bit packing so that small jitter fits in the same bucket as zero, and jittered series fell from 2.9 to 2.1 bytes per point.

Regular and sparse series barely moved, which is what we expected. Across our largest cluster the change saved about eleven per cent of timestamp storage.
