---
no: 110
title: Vectorised filters without rewriting the planner
dek: Four operators, SIMD where it pays, scalar where it doesn’t.
section: Query engine
date: 2026-10-15
author: Mateo Lindqvist
lead:
  chart: charts/filter-throughput.json
  caption: Scan throughput by operator, scalar against vectorised, on one core.
---

Our query engine evaluates filters one row at a time. For time-series data, where a query often scans millions of points to keep a few thousand, that leaves most of the processor idle.

We vectorised four operators: scan, filter, aggregate and join. The first two now process 1,024 values per call and use SIMD comparisons where the column type allows it. Scan went from 1.1 to 3.2 GB/s on one core, and filter from 0.7 to 2.9.

## Where it didn’t pay

Join barely moved, from 0.6 to 0.7 GB/s, because its cost is in hash lookups, not comparisons. We kept the vectorised join anyway because it simplified the interface between operators, but we would not have built it for speed alone.

The planner did not change at all. Each operator still has the same contract; only its inner loop is new. That is why this took six weeks rather than six months.
