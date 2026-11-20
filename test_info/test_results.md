# Campus Serve — flow test report

Date: 2026-11-20  
Environment: backend `http://127.0.0.1:5000`, frontend Vite dev server, PostgreSQL `Campus_connect_db`.

## 1. Scope and setup

Created, without deleting any pre-existing record:

- 2 active College organizations: `College of Engineering`, `College of Nursing`.
- 2 Admin accounts (one per college) and 6 student accounts (three per college). See `credentials.csv`.
- 1 complete activity lifecycle: admin request → super-admin approval → two enrollments (one student from each college) → admin acceptance → attendance logged → admin verification → certificate released.

The backend restarted once during the run (the original `npm start` shell was cancelled). No data was lost: PostgreSQL retained all records and `/api/health` stayed `{"success":true,"database":"connected"}`.

## 2. Test results

All **24 main checks passed functionally**, plus 2 extra checks that confirmed two defects. Key evidence:

| Check | Result | Evidence |
| --- | --- | --- |
| Login: superadmin + 2 admins + 6 students | PASS | `200` with correct `userId` and `role` for all 9 accounts |
| Wrong password / unknown email / missing email | PASS | `401`, `401`, `400` respectively |
| Inactive student cannot log in | PASS | `401 {"error":"Email or password is incorrect."}` |
| Both new colleges pass student sign-up gate | PASS | `collegeHasActiveAdmin(...)` = `true` for both |
| Gate drops a college when its admin is inactive | PASS | predicate = `false` |
| Admin submits activity | PASS | activity id `1`, `status: Pending`, `by: 4` |
| Super admin approves | PASS | `Pending -> Open` |
| One student from each college enrolls | PASS | enrollment ids `1` (user 6) and `2` (user 9), both `Pending` |
| Admin accepts requests | PASS | both `Pending -> Accepted` |
| Activity completed + 4 hours logged + verified | PASS | both enrollments `attended:true, hours:4, verified:true` |
| Certificate release condition | PASS | `Accepted + attended + verified + Completed + hours >= 4` true for both |
| Unauthenticated write to `/api/data/organizations` | **VULNERABILITY CONFIRMED** | `PUT` with no credentials succeeded; temporary org was readable; removed afterwards |
| Password reset request | **DEFECT CONFIRMED** | `503 {"error":"Password reset email is not configured..."}` |
| Student login while college admin is Inactive | **DEFECT CONFIRMED** | `200 {"userId":6,"role":"User"}` even though the UI would hide the portal |

No unhandled 500 errors, crashes, or database errors occurred during any API call.

## 3. Bugs and errors found

### Critical

1. **No server-side authorization.** `PUT /api/data/:collection` accepts unauthenticated writes and replaces an entire collection. I added a temporary organization with no credentials and read it back successfully. Any client can therefore create Admin/Super Admin users, change roles, passwords, statuses, or wipe records.
   - Location: `BACKEND/src/routes/data.js` lines 26–75.
2. **Plaintext passwords are stored and exposed.** `GET /api/data/users` returns the `pw` field (e.g. `"pw":"demo1234"`). `POST /api/auth/login` compares the submitted password directly to that field.
   - Location: `BACKEND/src/routes/auth.js` line 27, `app_records.data` in PostgreSQL.
3. **No real session or token.** Login only returns `{userId, role}`; the frontend stores the current user in `localStorage["campus_serve_current_user"]` and trusts it for routing. Editing that value in DevTools gives any role without a password.
   - Locations: `FRONTEND/src/pages/auth/LoginForm.jsx` lines 28–34, `FRONTEND/src/App.jsx` lines 33–55.
4. **Admin-presence gate is client-side only.** `studentHasActiveCollegeAdmin` / `collegeHasActiveAdmin` are used only in the UI. When I set Admin id 4 to `Inactive`, student id 6 could still log in via the API (`200`), even though the UI hides the portal and sign-up for that college.
   - Locations: `FRONTEND/src/utils/appUtils.jsx` lines 90–102, `FRONTEND/src/App.jsx` lines 49–55, `BACKEND/src/routes/auth.js`.

### High

5. **Last-write-wins data loss risk.** `useStored` saves the whole collection 250 ms after any change; two admins/students editing different records can silently overwrite each other's work. There are no per-record endpoints or version checks.
   - Location: `FRONTEND/src/hooks/useStored.js` lines 75–88, `BACKEND/src/routes/data.js`.
6. **Password reset is unusable.** `SMTP_USER`, `SMTP_APP_PASSWORD`, and `SMTP_FROM` are blank in `BACKEND/.env`, so `/api/auth/password-reset/request` returns `503`. Reset codes are kept in an in-memory `Map`, so a backend restart loses pending codes and resets the one-minute cooldown.
   - Location: `BACKEND/src/routes/auth.js` lines 7, 42–46, 75–80.
7. **Predictable super-admin password.** `SUPER_ADMIN_START_PASSWORD = "demo1234"` is hardcoded in the frontend seed and is the current production-like credential.
   - Location: `FRONTEND/src/data/appData.js` lines 38–53.

### Medium

8. **No schema validation on writes.** The API only checks that each record is an object with an `id` or `name`. Duplicate admins per college, malformed fields, and arbitrary properties can be injected through the API even though the UI blocks them.
9. **ID reuse / collisions.** `nid()` is `max(id)+1`; deleting the highest record allows its ID to be reused. Admin `idno` is derived from the user count (`OFF-0004`), so concurrent creations from stale tabs can collide.
10. **Certificate depends on a manual status.** Verified hours alone do not release a certificate; an admin must also mark the activity `Completed`. In this test I set that status explicitly.
11. **Silent student lockout.** Deactivating a college admin makes students' `currentUser` undefined on reload with no explanatory message.
12. **Documentation drift.** `README.md` says the default DB is `campus_connect` (actual: `Campus_connect_db`) and tells you to copy `.env.example`, which does not exist. `npm run dev` now runs `node` instead of `nodemon`, so there is no auto-reload.

## 4. How the process works: Super Admin → Admin → User

### Super Admin

- Logs in with a WMSU email and password; `App.jsx` routes `role === "Super Admin"` to `SuperAdminPage`.
- **Colleges & Offices:** adds an organization (`name`, `type`, `status: Active`). A college is not available to students until it has an active Admin.
- **Admin Accounts:** selects an active, unassigned organization, enters the admin's name, WMSU email (`name@wmsu.edu.ph`), and initial password (twice). This creates a user with `role: "Admin"`, `college`, `orgType`, `idno: OFF-xxxx`, `status: Active`. The UI allows one Admin per organization; deactivating suspends access but keeps the org assigned, deleting frees it.
- **Approvals:** reviews activities submitted by Admins (`Pending`) and sets them to `Open` or rejects them.
- **Monitoring / Students:** read-only oversight of activities, enrollment counts, hours, and student accounts. There is no Super Admin form to create students.

### Admin (college coordinator)

- Logs in with the WMSU email/password set by the Super Admin; routed to `AdminPage`. Only sees students and activities for their own college.
- **My Activities → Add activity:** fills title, description, photo (optional, compressed client-side), category, location, date, start/end time (service hours auto-calculated), slots, and participating colleges. Only colleges with an active Admin can be selected; the admin's own college is always included and cannot be unchecked. Saving creates the activity with `status: Pending` and `by: <admin id>`.
- **Requests:** accepts or declines student enrollment requests. The UI blocks approvals after the activity ended or when slots are full.
- **Attendance & Hours:** verifies or rejects the hours students submit after the activity ends.
- **Student Accounts:** can deactivate/delete students in their own college (deletion also removes that student's enrollments). Admins cannot create student accounts.

### User (student)

- Uses **Student sign-up** on the login screen. Only colleges with an active Admin are listed; email must be `@wmsu.edu.ph`, ID number must be unique, and password confirmation must match. The new account has `role: "User"`, `status: Active`, and the chosen `college`.
- Browses activities that are `Open`/`Ongoing`, not yet ended, and accessible to their college (owner college or listed in `colleges`).
- Enrolls → request is `Pending` until the activity's Admin accepts it. A student cannot enroll twice in the same activity.
- After the scheduled end time, submits attendance date (must equal the activity date) and hours (0 < hours ≤ activity hours). The Admin then verifies the entry.
- A certificate is released only when: enrollment `Accepted` + `attended` + `verified` + activity `Completed` + logged hours ≥ activity hours. Students can print or download a PDF from **Hours & Certificate**.

## 5. Suggestions

1. **Move trust to the backend.** Add JWT/session auth with httpOnly cookies, enforce role and ownership on every endpoint, and stop using `localStorage` as the source of authority for the current role.
2. **Hash passwords server-side** with bcrypt/argon2, never return `pw` from any endpoint, and rotate the hardcoded `demo1234` super-admin password. The `app_users` view already omits `pw`; keep it that way.
3. **Replace whole-collection `PUT`** with granular `POST /users`, `PATCH /users/:id`, `DELETE /users/:id` (and equivalents for other collections), plus optimistic concurrency via `updated_at`/version so concurrent edits cannot silently overwrite.
4. **Enforce business rules in the API:** one Admin per active organization, WMSU email regex, unique email/ID number, student college activity gate, slot limits, attendance date/hour bounds, and certificate conditions. The UI checks are good UX but must be repeated server-side.
5. **Persist password-reset codes** in the database with expiry/attempts, configure SMTP in `BACKEND/.env`, and add rate limiting by email + IP.
6. **Use the existing `audit_logs` table** to record account creation, role/status changes, approvals, enrollment decisions, and hour verifications.
7. **Add automated regression tests.** The scripts used here (`campus_test_setup.mjs`, `campus_test_flow.mjs`) can be turned into a repeatable test suite; add a seed script instead of relying on browser `localStorage` initialization.
8. **Show a clear message** to students when their college has no active Admin instead of silently dropping them to the login screen.
9. **Fix the docs and tooling:** add `.env.example`, correct the database name in the README, and restore `nodemon` for `npm run dev` if hot reload is desired.
