# Page Inventory

**Status:** Review candidate

## Status definitions

- **Inventoried:** Route and intent only.
- **Partially Specified:** Some UX contract exists; implementation is blocked
  by missing product/API/security detail.
- **Specified:** Implementation-grade purpose, hierarchy, actions, states,
  access, responsive, and accessibility contract exists.
- **Deferred:** Outside current delivery scope; no UI should be shipped.

None of these statuses means implemented.

## Public routes

| Page                     | Suggested route                           | Priority | Status              | Access/dependency                                           |
| ------------------------ | ----------------------------------------- | -------: | ------------------- | ----------------------------------------------------------- |
| Home                     | `/`                                       |       P0 | Specified           | Public managed content                                      |
| Course catalog           | `/courses`                                |       P0 | Specified           | Published courses                                           |
| Course detail            | `/courses/:slug`                          |       P0 | Partially Specified | Module #8 personalized resume DTO pending                   |
| Login                    | `/login`                                  |       P0 | Specified           | Authentication                                              |
| Registration             | `/register`                               |       P1 | Specified           | Capability-gated; disabled at launch                        |
| Forgot password          | `/forgot-password`                        |       P0 | Specified           | Recovery                                                    |
| Reset password           | `/reset-password`                         |       P0 | Specified           | One-time token                                              |
| Step-up verification     | `/verify-action`                          |       P1 | Partially Specified | Module 8.6A Review Candidate; architecture approval pending |
| Certificate verification | `/verify/certificates/:verificationToken` |       P1 | Partially Specified | Module 8.6A and privacy-disclosure approval pending         |
| About                    | `/about`                                  |       P2 | Partially Specified | Managed content model pending                               |
| FAQ                      | `/faq`                                    |       P1 | Partially Specified | Managed content model/search pending                        |
| Support                  | `/support`                                |       P1 | Partially Specified | Support channels/SLA pending                                |
| Privacy                  | `/legal/privacy`                          |       P1 | Partially Specified | Legal approval/versioning pending                           |
| Terms                    | `/legal/terms`                            |       P1 | Partially Specified | Legal approval/versioning pending                           |

## Student routes

| Page               | Suggested route                          | Priority | Status              | Access/dependency                             |
| ------------------ | ---------------------------------------- | -------: | ------------------- | --------------------------------------------- |
| Dashboard          | `/app`                                   |       P0 | Partially Specified | Module #8 resume/progress DTO pending         |
| My courses         | `/app/courses`                           |       P0 | Partially Specified | Module #8 resume/progress DTO pending         |
| Course player      | `/learn/:enrollmentId/lessons/:lessonId` |       P0 | Partially Specified | Module #8 completion/resume DTO pending       |
| Jarayonim          | `/app/progress`                          |       P1 | Partially Specified | Module #8 contract approval                   |
| Achievements       | `/app/achievements`                      |       P3 | Deferred            | Excluded from initial Module #8               |
| Notifications      | `/app/notifications`                     |       P2 | Deferred            | Notification module contract                  |
| Profile            | `/app/profile`                           |       P1 | Specified           | Self profile                                  |
| Settings           | `/app/settings`                          |       P1 | Partially Specified | Preferences/notification DTO pending          |
| Certificate detail | `/app/certificates/:certificateId`       |       P1 | Partially Specified | Module 8.6A approval and 8.6E runtime pending |

## Teacher routes

| Page                  | Suggested route                                          | Priority | Status              | Access/dependency                             |
| --------------------- | -------------------------------------------------------- | -------: | ------------------- | --------------------------------------------- |
| Dashboard             | `/teacher`                                               |       P1 | Partially Specified | Module #8 learning-signal DTO pending         |
| Course list           | `/teacher/courses`                                       |       P1 | Specified           | Scoped course read                            |
| Course creation       | `/teacher/courses/new`                                   |       P1 | Specified           | Scoped course create                          |
| Course builder        | `/teacher/courses/:courseId/builder`                     |       P1 | Specified           | Scoped edit                                   |
| Media                 | `/teacher/media`                                         |       P1 | Partially Specified | Media quotas/reuse contract pending           |
| Enrollments           | `/teacher/courses/:courseId/enrollments`                 |       P1 | Specified           | Scoped enrollment read                        |
| Course O‘zlashtirish  | `/teacher/courses/:courseId/progress`                    |       P1 | Partially Specified | Module #8 contract approval                   |
| Student O‘zlashtirish | `/teacher/courses/:courseId/progress/:enrollmentId`      |       P1 | Partially Specified | Module #8 contract approval                   |
| Analytics             | `/teacher/analytics`                                     |       P2 | Deferred            | Statistics module                             |
| Settings              | `/teacher/settings`                                      |       P2 | Partially Specified | Preference contract pending                   |
| Certificate detail    | `/teacher/courses/:courseId/certificates/:certificateId` |       P1 | Partially Specified | Module 8.6A approval and 8.6E runtime pending |

## Admin routes

| Page               | Suggested route                                        | Priority | Status              | Access/dependency                                                                                                                                                                                                                                         |
| ------------------ | ------------------------------------------------------ | -------: | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard          | `/admin`                                               |       P1 | Specified           | Admin capabilities                                                                                                                                                                                                                                        |
| Users              | `/admin/users`                                         |       P1 | Partially Specified | Step-up protected-action dependency: challenge API; recent-auth determination; short-lived proof contract; proof binding to the protected action; verification and expiry errors; return-to-action context; and audit events.                             |
| User detail        | `/admin/users/:userId`                                 |       P1 | Partially Specified | Step-up protected-action dependency: challenge API; recent-auth determination; short-lived proof contract; proof binding to the protected action; verification and expiry errors; return-to-action context; and audit events.                             |
| Roles              | `/admin/access/roles`                                  |       P1 | Partially Specified | Step-up and role API detail pending                                                                                                                                                                                                                       |
| Permission matrix  | `/admin/access/permissions`                            |       P1 | Partially Specified | Matrix/API contract pending                                                                                                                                                                                                                               |
| Courses            | `/admin/courses`                                       |       P1 | Partially Specified | Consolidated moderation list pending                                                                                                                                                                                                                      |
| Course moderation  | `/admin/courses/:courseId/moderation`                  |       P1 | Specified           | Publish/moderate                                                                                                                                                                                                                                          |
| Enrollments        | `/admin/enrollments`                                   |       P1 | Specified           | Enrollment management                                                                                                                                                                                                                                     |
| Enrollment detail  | `/admin/enrollments/:enrollmentId`                     |       P1 | Specified           | Enrollment management                                                                                                                                                                                                                                     |
| Media              | `/admin/media`                                         |       P1 | Partially Specified | Global quota/retention policy pending                                                                                                                                                                                                                     |
| O‘zlashtirish      | `/admin/progress`                                      |       P2 | Partially Specified | Module #8 contract approval                                                                                                                                                                                                                               |
| Audit log          | `/admin/audit`                                         |       P1 | Partially Specified | Step-up protected-action dependency for large personal-data export: challenge API; recent-auth determination; short-lived proof contract; proof binding to the export action; verification and expiry errors; return-to-action context; and audit events. |
| System analytics   | `/admin/analytics`                                     |       P2 | Deferred            | Statistics module                                                                                                                                                                                                                                         |
| Settings           | `/admin/settings`                                      |       P2 | Partially Specified | Typed settings schemas pending                                                                                                                                                                                                                            |
| Certificate detail | `/admin/courses/:courseId/certificates/:certificateId` |       P1 | Partially Specified | Module 8.6A approval and phased 8.6C–8.6F runtime pending                                                                                                                                                                                                 |

## Traceability requirements

Before a page becomes **Specified**, its contract must define:

- purpose, route title, hierarchy, and primary/secondary actions;
- API capability, role, permission, and data-scope behavior;
- initial load, refresh, empty, error, offline, success, forbidden, and conflict
  states as applicable;
- 320 px through wide-layout behavior and long localization;
- focus/keyboard/screen-reader acceptance journey;
- owner-editable and developer-owned boundaries;
- route loading/bundle boundary;
- audit and step-up behavior for sensitive actions.
