---
no: 108
title: "tarnctl trace: a flame graph for one query"
dek: Our command line tool now shows you where a slow query spent its time.
section: Tooling
date: 2026-09-18
author: Mateo Lindqvist
---

When a query is slow, the first question is always where the time went. Until this release, answering it meant asking us. Now `tarnctl trace` runs the query with tracing on and prints a flame graph in the terminal.

```bash
tarnctl trace "SELECT mean(cpu) FROM hosts WHERE region = 'eu-2' GROUP BY time(1m)"
```

Each bar is an operator, with its share of the total time and the number of rows it handled. The most common surprise so far has been a filter that runs after a join instead of before it, which the trace makes obvious in a way the query plan never did.
