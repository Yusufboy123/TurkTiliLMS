# Module 9.4B Admin Dashboard Query-Plan Review

- **Review date:** 2026-08-01
- **Database:** local PostgreSQL development database with all 13 migrations
- **Scope:** `GET /api/v1/admin/dashboard/summary`
- **Result:** Current indexes and bounded scans are adequate for the present data scale. No migration is required.

## Aggregate snapshot query

`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` was executed against the exact
repository aggregate query.

| Measurement         |    Result |
| ------------------- | --------: |
| Planning time       | 34.535 ms |
| Execution time      |  0.561 ms |
| Root estimated cost |     19.22 |

The plan scanned these small current relations once each:

| Relation                    | Current rows visited | Plan choice     |
| --------------------------- | -------------------: | --------------- |
| `users`                     |                   11 | Sequential scan |
| `user_roles`                |                    8 | Sequential scan |
| `roles`                     |                    3 | Sequential scan |
| `courses`                   |                    4 | Sequential scan |
| `course_enrollments`        |                    5 | Sequential scan |
| `enrollment_progress_roots` |                    1 | Sequential scan |
| `certificates`              |                    0 | Sequential scan |

At this scale PostgreSQL correctly prefers bounded sequential scans over index
startup overhead. The query contains no row-by-row application loop and returns
one fixed-size row. Module 9.4B integration coverage also executes the plan in
an isolated migrated schema and asserts that all six domain source relations
remain represented.

## Shared rate-limit count

The rolling actor/action/time/IP query used by the PostgreSQL-backed limiter was
also checked with `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`.

| Measurement         |                              Result |
| ------------------- | ----------------------------------: |
| Planning time       |                            2.750 ms |
| Execution time      |                            0.057 ms |
| Root estimated cost |                                8.32 |
| Selected index      | `audit_logs_action_occurred_at_idx` |

The rate-limit path therefore uses an existing index and requires no new table,
index, package, or migration. Production monitoring should continue tracking
latency and audit-log retention as table cardinality grows; any future index
change requires its own reviewed migration.

## User-lifecycle preflight

The non-mutating release preflight checked both unsupported mismatch directions:

- `status = DELETED` with `deleted_at IS NULL`: `0`
- `status <> DELETED` with `deleted_at IS NOT NULL`: `0`

No user data was modified by the preflight.
