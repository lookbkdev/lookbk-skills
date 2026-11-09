---
no: 109
title: Fuzzing the WAL until it told us the truth
dek: Two years of torn-write bugs, found in eleven hours of CPU.
section: Reliability
date: 2026-09-30
author: Yusuf Adeyemi
lead:
  chart: charts/fuzz-crashes.json
  caption: Unique crashes found per hour across eleven hours of fuzzing the write-ahead log.
---

The write-ahead log is the part of the database that must survive a power cut halfway through a write. We had tests for it. We did not have a fuzzer, and the fuzzer found 61 unique crashes in its first eleven hours, most of them in the first three.

The harness writes records, cuts power at a random byte, replays the log and checks that every acknowledged write is still there. Each crash it found was a sequence of record sizes and cut points we had never thought to test.

```bash
cargo fuzz run wal_replay -- -max_total_time=39600 -jobs=16
```

Every one of the 61 is now a regression test. The fuzzer runs for an hour on every change to the log, and it has found nothing new in seven weeks, which is the result we were hoping for.
