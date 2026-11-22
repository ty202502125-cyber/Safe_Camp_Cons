# Campus Serve — end-to-end test data

Created for the flow test on 2026-11-20. Test organizations, accounts, an activity and verified enrollments were created in PostgreSQL to exercise the approval/certificate flow.

Credential files (`credentials.csv`, `accounts.json`) are no longer committed. They remain local only and are ignored by Git. Never reuse test passwords on a deployed system.

Test records:

- 2 college organizations (Engineering, Nursing).
- 1 Admin account per college and 3 student accounts per college.
- 1 test activity with 2 verified enrollments.

The active backend now authenticates against server-owned accounts with hashed passwords; credentials are no longer readable through `GET /api/data/users`. See `BACKEND/README.md` for the current authentication flow.
