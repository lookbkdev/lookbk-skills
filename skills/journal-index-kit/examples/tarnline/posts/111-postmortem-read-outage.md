---
no: 111
title: "Postmortem: the 38-minute read outage on 19 October"
dek: A cache warm-up, a retry storm, and the flag we now leave off by default.
section: Postmortems
date: 2026-10-27
author: Priya Nandakumar
lead:
  chart: charts/read-errors.json
  caption: Read errors per minute on 19 October, 14:02 to 14:40 UTC. The flag was turned off at 14:31.
---

On 19 October, from 14:02 to 14:40 UTC, a share of read queries on the us-1 cluster failed or timed out. Writes were not affected and no data was lost. This is what happened, what we changed, and what we are still changing.

## Timeline

- **14:02** A routine deploy rolls a new query node build to us-1, with the block cache warm-up flag on.
- **14:05** Read error rate starts to climb. The warm-up is reading from object storage at full speed on every new node at once.
- **14:09** Clients start retrying. Retries add load to the nodes that are still warming.
- **14:24** On-call identifies the warm-up as the cause.
- **14:31** The flag is turned off cluster-wide. Error rate falls within two minutes.
- **14:40** Error rate is back to normal.

## What we changed

The warm-up flag is now off by default and rolls out by percentage, never cluster-wide. Our client libraries now back off with jitter after the second retry rather than the fifth.[^retry]

```go
// client/retry.go
delay := base * time.Duration(1<<attempt)
delay = delay/2 + time.Duration(rand.Int63n(int64(delay/2)))
```

We are also adding a deploy check that refuses to roll a build whose flags differ from the previous build without a named owner. That is the change we expect to matter most, and it is the one that is not finished.

[^retry]: The fifth retry was a default from a library we no longer use. Nobody chose it; it was simply never changed.
