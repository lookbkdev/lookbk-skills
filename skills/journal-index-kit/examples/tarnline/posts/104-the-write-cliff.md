---
no: 104
title: "Rebuilding compaction, part 1: the write cliff"
dek: Why p99 write latency fell off a cliff at the same time every morning.
section: Storage
date: 2026-07-21
author: Dara Quint
series: { name: Rebuilding compaction, part: 1 }
---

Every weekday at about eight in the morning, p99 write latency on our busiest clusters jumped from single milliseconds to forty and stayed there until eleven. Customers noticed before we did.

This series is about finding out why and fixing it. The short version is that our storage engine reorganises its files in the background, and its scheduler had no idea what else was happening on the disk. The long version takes three parts.
