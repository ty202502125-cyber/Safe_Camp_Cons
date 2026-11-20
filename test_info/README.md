# Campus Serve — end-to-end test accounts

Created for the flow test on 2026-11-20. All records live in PostgreSQL (`Campus_connect_db`) through `BACKEND/.env`, and were written through the same `PUT /api/data/:collection` endpoints the frontend uses.

## What was created

- 2 new college organizations (both `type: College`, `status: Active`):
  - College of Engineering
  - College of Nursing
- 1 Admin account for each college (2 admins).
- 3 student accounts under each college (6 students).
- 1 test activity (`TEST FLOW - Coastal Clean-up`, id `1`, created by Admin id `4`) with 2 verified enrollments (students id `6` and `9`) so the certificate/hours path can be inspected.

Pre-existing accounts (`superadmin@wmsu.edu.ph`, `ty202502125@wmsu.edu.ph`, `ty202502126@wmsu.edu.ph`) and the original `COLLEGE OF COMPUTING STUDIES` organization were left intact.

## Files

- `credentials.csv` — all login credentials in a spreadsheet-friendly format.
- `accounts.json` — the same accounts as machine-readable JSON.
- `test_results.md` — test matrix, bugs/errors found, flow explanation, and suggestions.

## How to see the test data in the UI

1. **Hard-reload the frontend (Ctrl+F5) before logging in.** The app mirrors the database into `localStorage` and writes the whole collection back after each change (`FRONTEND/src/hooks/useStored.js`). A stale tab can overwrite the database records created here.
2. Log in as `superadmin@wmsu.edu.ph` / `demo1234` → **Approvals** / **Monitoring** / **Students** to see the colleges, admins, students, and the test activity.
3. Log in as `eng.admin.test@wmsu.edu.ph` / `TestAdminEng#2026` or `nur.admin.test@wmsu.edu.ph` / `TestAdminNur#2026` → **My Activities**, **Requests**, **Attendance & Hours**, **Student Accounts**.
4. Log in as any test student → **My Enrollments** / **Hours & Certificate**. Students id `6` and `9` have 4 verified hours and a released certificate.

## Safety note

The passwords below are stored in plain text in the database and are returned by `GET /api/data/users`. This folder contains real credentials for a local test environment only — do not reuse these passwords on a deployed system, and do not commit this folder to a public repository.
