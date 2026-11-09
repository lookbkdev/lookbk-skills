---
no: 106
title: What we learned running 400 nodes on spot capacity
dek: Interruption notices, drain budgets, and one bad Tuesday.
section: Reliability
date: 2026-08-20
author: Priya Nandakumar
---

Since March, the query tier on three of our clusters has run on spot capacity: cheaper machines that the provider can take back with two minutes’ notice. Four hundred nodes, eight months, and one bad Tuesday.

The two minutes are enough if you plan for them. Each node listens for the interruption notice, stops taking new queries, finishes or hands off the ones it has, and leaves. We budget how many nodes can be draining at once per cluster, and new spot nodes are requested before old ones go.

The bad Tuesday was a region-wide reclaim: a third of a cluster’s nodes got notices within a minute of each other. The drain budget held, queries slowed but did not fail, and we have since added a floor of on-demand nodes that spot can never take below.
