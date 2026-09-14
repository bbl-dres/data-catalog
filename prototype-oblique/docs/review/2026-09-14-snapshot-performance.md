# Catalog load timeouts: investigation

The failure occurs in the Supabase snapshot request. PostgreSQL logs confirm `canceling statement due to statement timeout` for the API-inclusive `read_snapshot` RPC at 13:15:00 and 13:16:46 UTC on 14 September 2026. One gateway response was HTTP 500 with `PostgREST; error=57014`. A successful later request does not resolve this intermittent failure.

## Findings

- Initial loading assembles approximately 10.5 MB of JSON across all catalog collections. The 2,243 history records contribute 6.86 MB, about 65%. This is serialized JSON size before HTTP gzip compression, not network transfer size.
- The request includes complete `before` and `after` history states. The frontend history view only displays dates, action, summary and actor; it does not use those state copies. Together the states account for about 4.26 MB.
- The latest MMB batch event is 0.408 MB. Its commit timestamp is 13:15:51 UTC, after the first confirmed timeout. It increased payload size but cannot explain the earlier failure by itself. The earlier rollback preview and other investigative queries also consumed database resources during this period.
- A fresh browser load succeeded in 2.20 seconds: about 1.95 seconds until response headers and 0.25 seconds for the remaining response. Re-projecting the complete snapshot into frontend objects took 16.9 ms. Browser-side projection is not the measured bottleneck.
- A normal SQL snapshot measured 1.63 seconds and wrote 1,824 temporary blocks, approximately 14.25 MiB. `work_mem` is 2,184 kB. An inner query plan identifies history sorting as an external merge sort. Queries spill intermediate data despite the catalog's modest record count.
- PostgreSQL statement statistics include a snapshot/hash read lasting 19.19 seconds. That was an administrative verification query, distinct from the timed-out browser RPC. Completed API-inclusive RPCs had previously averaged 1.48 seconds, with a 2.67-second maximum; canceled requests are not represented as successful executions in that statistic.
- Role configuration is `statement_timeout=3s` for `anon` and `8s` for `authenticated`; `authenticator` also has an 8-second setting. The frontend aborts after 20 seconds, including response-body consumption. These are separate deadlines; changing only the browser deadline does not prevent database cancellations.
- The activity snapshot showed no blocked queries or idle-in-transaction sessions. Transient CPU/resource contention at the exact failure times was not captured. JIT is off. The performance advisor's missing foreign-key indexes do not explain a read that aggregates entire tables.

## Read-only experiments

All session settings below were rolled back. Production functions and settings were not changed.

| Experiment | Execution time | Observation |
| --- | ---: | --- |
| Existing function, default memory | 3,540 ms | 1,824 temporary blocks written |
| Same function, session-local 16 MB work_mem | 2,736 ms | No temporary blocks; still substantial CPU/serialization work |
| Query body with API-inclusive condition constant | 705 ms | Avoids some generic compatibility-query overhead |
| Same constant query, excluding history before/after values | 440 ms | Smaller output and less history conversion work |
| Query body forced to use a generic parameterized plan | 1,502 ms | Consistent with further overhead in the shared compatibility query |

These single runs on a shared database are directional comparisons, not a controlled performance benchmark. Omitting null-valued history keys as well as state copies would shrink history JSON from about 6.86 MB to 1.27 MB. Completely deferring history would remove roughly 65% of the initial snapshot payload.

## Recommended change

1. Introduce a lean initial-load response containing current catalog data and compact history summaries/counts. Fetch full historical before/after states only when needed. Preserve every stored history record and the single MMB batch entry; retain the complete snapshot contract for administrative import verification and any consumers that require it.
2. Separate the API-inclusive query path from legacy field filtering so the common request does not carry unnecessary generic compatibility conditions.
3. Measure public and authenticated RPC execution plus cold browser loads after the change. Use normal and representative concurrent traffic to check timeout headroom. Consider narrowly scoped query memory only if the lean query still spills.

Increasing the browser timeout alone would leave the database deadline and excess serialization work in place.

Evidence: [SQL measurements](2026-09-14-snapshot-performance/measurements.json), [browser measurements](2026-09-14-snapshot-performance/browser.json). Diagnostic command: `node scripts/diagnose-snapshot-performance.cjs` with the existing browser dependency environment.

The advisors also reported two uncovered compound foreign keys, unused indexes and existing security notices. They were not changed as part of this investigation. Reference: [Supabase foreign-key index advisory](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). These notices are separate from the measured snapshot bottleneck.
