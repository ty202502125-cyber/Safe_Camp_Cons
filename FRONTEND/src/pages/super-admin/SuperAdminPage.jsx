import { useState } from "react";
import SuperAdminHomePage, { PendingActivityTable } from "./HomePage.jsx";
import {
  nid,
  fullName,
  fmtDate,
  Badge,
  accepted,
  hoursOf,
  Panel,
  Empty,
  Shell,
  Profile,
} from "../../shared/appCommon.jsx";

export function SuperAdminPage({ d, start }) {
  const {
    users,
    setUsers,
    acts,
    setActs,
    enr,
    flash,
    organizations,
    setOrganizations,
  } = d;
  const [page, setPage] = useState(start || "Overview");
  const [adminDeactivationChoice, setAdminDeactivationChoice] = useState(null);
  const admins = users.filter((u) => u.role === "Admin"),
    students = users.filter((u) => u.role === "User");
  // An organization stays assigned while its Admin is inactive; deleting that account frees it.
  const assignedOrganizations = new Set(admins.map((admin) => admin.college));
  const availableOrganizations = organizations.filter(
    (org) => org.status === "Active" && !assignedOrganizations.has(org.name),
  );
  const pending = acts.filter((a) => a.status === "Pending");
  const owner = (a) => users.find((u) => u.id === a.by);
  const totalHours = enr
    .filter((e) => e.attended)
    .reduce((s, e) => s + Number(e.hours || 0), 0);

  function decide(id, status) {
    setActs(acts.map((a) => (a.id === id ? { ...a, status } : a)));
    flash(
      status === "Open"
        ? "Activity approved and published to students."
        : "Activity request rejected.",
      status !== "Open",
    );
  }
  function addAdmin(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const email = f.email.trim().toLowerCase();
    const organization = organizations.find(
      (org) => org.name === f.organization && org.status === "Active",
    );
    if (!organization)
      return flash(
        "Choose an active college or office from the organization list.",
        true,
      );
    if (admins.some((admin) => admin.college === organization.name))
      return flash(`${organization.name} already has an Admin account.`, true);
    if (!/^[^\s@]+@wmsu\.edu\.ph$/.test(email))
      return flash("Use a WMSU email (name@wmsu.edu.ph).", true);
    if (f.pw !== f.pw2)
      return flash("The initial passwords do not match.", true);
    if (users.some((u) => u.email.toLowerCase() === email))
      return flash("An account with this email already exists.", true);
    setUsers([
      ...users,
      {
        id: nid(users),
        role: "Admin",
        last: f.last.trim(),
        first: f.first.trim(),
        mi: f.mi.trim().replace(/\./g, ""),
        idno: "OFF-" + String(nid(users)).padStart(4, "0"),
        email,
        college: organization.name,
        orgType: organization.type,
        pw: f.pw,
        status: "Active",
      },
    ]);
    e.target.reset();
    flash(
      `Admin account created for ${organization.name}. They sign in with the WMSU email and password you set.`,
    );
  }
  function addOrganization(e) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target));
    const name = f.name.trim();
    if (!name) return flash("Enter a college or office name.", true);
    if (
      organizations.some((org) => org.name.toLowerCase() === name.toLowerCase())
    )
      return flash("That college or office already exists.", true);
    setOrganizations([
      ...organizations,
      { name, type: f.type, status: "Active" },
    ]);
    e.target.reset();
    flash(`${f.type} added. You can now assign an Admin account to it.`);
  }
  function toggleOrganization(name) {
    setOrganizations(
      organizations.map((org) =>
        org.name === name
          ? { ...org, status: org.status === "Active" ? "Inactive" : "Active" }
          : org,
      ),
    );
    flash("Organization status updated.");
  }
  function toggle(id) {
    const account = users.find((u) => u.id === id);
    if (!account || account.role !== "Admin") return;
    const nextStatus = account.status === "Active" ? "Inactive" : "Active";
    setUsers(
      users.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)),
    );
    const isCollegeAdmin = organizations.some(
      (org) => org.name === account.college && org.type === "College",
    );
    if (
      account.role === "Admin" &&
      nextStatus === "Inactive" &&
      isCollegeAdmin &&
      !users.some(
        (u) =>
          u.id !== id &&
          u.role === "Admin" &&
          u.status === "Active" &&
          u.college === account.college,
      )
    ) {
      flash(
        `Admin deactivated. Students in ${account.college} can’t sign in until an active Admin is assigned.`,
      );
    } else flash("Account status updated.");
  }
  function deleteAdmin(id) {
    const account = users.find((u) => u.id === id && u.role === "Admin");
    if (!account) return;
    if (
      !window.confirm(
        `Permanently delete ${fullName(account)} (${account.email})? This removes the Admin account.`,
      )
    )
      return;
    setUsers(users.filter((u) => u.id !== id));
    setAdminDeactivationChoice(null);
    const anotherActiveAdmin = users.some(
      (u) =>
        u.id !== id &&
        u.role === "Admin" &&
        u.status === "Active" &&
        u.college === account.college,
    );
    const isCollegeAdmin = organizations.some(
      (org) => org.name === account.college && org.type === "College",
    );
    if (isCollegeAdmin && !anotherActiveAdmin)
      flash(
        `Admin deleted. Students in ${account.college} can’t sign in until an active Admin is assigned.`,
      );
    else flash("Admin account permanently deleted.");
  }
  return (
    <Shell
      d={d}
      page={page}
      setPage={setPage}
      nav={[
        ["Overview"],
        ["Approvals", pending.length],
        ["Colleges & Offices"],
        ["Admin Accounts"],
        ["Monitoring"],
        ["Students"],
        ["My Profile"],
      ]}
    >
      {page === "Overview" && (
        <SuperAdminHomePage
          users={users}
          activities={acts}
          pending={pending}
          adminCount={admins.length}
          studentCount={students.length}
          totalHours={totalHours}
          onNavigate={setPage}
          onDecide={decide}
        />
      )}
      {page === "Approvals" && (
        <Panel
          eyebrow="REVIEW QUEUE"
          title="Activity requests"
          sub="Approved activities are published so students can enroll."
        >
          <PendingActivityTable
            list={pending}
            users={users}
            onDecide={decide}
          />
        </Panel>
      )}
      {page === "Colleges & Offices" && (
        <Panel
          eyebrow="ORGANIZATION DIRECTORY"
          title="Colleges and offices"
          sub="Manage the organizations students can join and assign activity admins to. A college is available for student sign-up after it has an active Admin account."
        >
          <form className="form" onSubmit={addOrganization}>
            <label className="w">
              College or office name
              <input
                name="name"
                required
                placeholder="e.g. College of Nursing"
              />
            </label>
            <label>
              Organization type
              <select name="type" defaultValue="College">
                <option>College</option>
                <option>Office</option>
              </select>
            </label>
            <button className="btn sm" type="submit">
              {" "}
              Add organization
            </button>
          </form>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>ORGANIZATION</th>
                  <th>TYPE</th>
                  <th>ADMIN ACCOUNTS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.name}>
                    <td>
                      <strong>{org.name}</strong>
                    </td>
                    <td>{org.type}</td>
                    <td>
                      {admins.filter((u) => u.college === org.name).length}
                    </td>
                    <td>
                      <Badge
                        s={org.status === "Active" ? "Open" : "Rejected"}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="tb"
                        onClick={() => toggleOrganization(org.name)}
                      >
                        {org.status === "Active" ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
                {!organizations.length && (
                  <Empty
                    cols={5}
                    text="No colleges or offices have been added."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "Admin Accounts" && (
        <Panel
          eyebrow="SUPER ADMIN CONSOLE"
          title="Admin accounts"
          sub="Each college or office can have one Admin account. Deactivating suspends access but keeps the organization assigned; deleting the account makes it available again. Students in a college can sign in only while that college has an active Admin."
        >
          <form className="form" onSubmit={addAdmin}>
            <label>
              Last name
              <input name="last" required />
            </label>
            <label>
              First name
              <input name="first" required />
            </label>
            <label>
              Middle initial (optional)
              <input name="mi" maxLength={2} />
            </label>
            <label className="w">
              Assigned college or office
              <select
                name="organization"
                defaultValue=""
                required
                disabled={!availableOrganizations.length}
              >
                <option value="">
                  {availableOrganizations.length
                    ? "Select an organization"
                    : "All active colleges and offices have an Admin"}
                </option>
                {availableOrganizations.map((org) => (
                  <option key={org.name} value={org.name}>
                    {org.name} · {org.type}
                  </option>
                ))}
              </select>
              {!availableOrganizations.length && (
                <small>
                  Add a new college or office, or delete an Admin account to
                  make an organization available again.
                </small>
              )}
            </label>
            <label>
              WMSU email
              <input
                name="email"
                type="email"
                required
                placeholder="office@wmsu.edu.ph"
              />
            </label>
            <label>
              Initial password
              <input
                name="pw"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <label>
              Confirm initial password
              <input
                name="pw2"
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </label>
            <button className="btn sm" type="submit">
              Create Admin
            </button>
          </form>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>ADMIN</th>
                  <th>COLLEGE / OFFICE</th>
                  <th>ACTIVITIES</th>
                  <th>STATUS</th>
                  <th>ACCOUNT ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{fullName(u)}</strong>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.college}</td>
                    <td>{acts.filter((a) => a.by === u.id).length}</td>
                    <td>
                      <Badge s={u.status === "Active" ? "Open" : "Rejected"} />
                    </td>
                    <td>
                      {u.status === "Active" ? (
                        adminDeactivationChoice === u.id ? (
                          <>
                            <button
                              type="button"
                              className="tb"
                              onClick={() => {
                                toggle(u.id);
                                setAdminDeactivationChoice(null);
                              }}
                            >
                              Confirm deactivate
                            </button>
                            <button
                              type="button"
                              className="tb bad"
                              onClick={() => deleteAdmin(u.id)}
                            >
                              Delete instead
                            </button>
                            <button
                              type="button"
                              className="tb"
                              onClick={() => setAdminDeactivationChoice(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="tb"
                            onClick={() => setAdminDeactivationChoice(u.id)}
                          >
                            Deactivate
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="tb"
                          onClick={() => toggle(u.id)}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {admins.length === 0 && (
                  <Empty cols={5} text="No admin accounts yet." />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "Monitoring" && (
        <Panel
          eyebrow="LIVE MONITORING"
          title="All volunteer activities"
          sub="Track status, enrollment and attendance for every office."
        >
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>ACTIVITY</th>
                  <th>OFFICE</th>
                  <th>DATE</th>
                  <th>ENROLLED</th>
                  <th>REQUESTS</th>
                  <th>ATTENDED</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {acts.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.title}</strong>
                      <small>{a.category}</small>
                    </td>
                    <td>{owner(a)?.college}</td>
                    <td>{fmtDate(a.date)}</td>
                    <td>
                      {accepted(enr, a)} / {a.slots}
                    </td>
                    <td>
                      {
                        enr.filter(
                          (e) => e.actId === a.id && e.status === "Pending",
                        ).length
                      }
                    </td>
                    <td>
                      {enr.filter((e) => e.actId === a.id && e.attended).length}
                    </td>
                    <td>
                      <Badge s={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "Students" && (
        <Panel
          eyebrow="VOLUNTEER REGISTRY"
          title="Students"
          sub="Verified volunteer hours per student."
        >
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>ID NUMBER</th>
                  <th>COLLEGE</th>
                  <th>ACTIVITIES</th>
                  <th>HOURS</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {students.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong>{fullName(u)}</strong>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.idno}</td>
                    <td>{u.college}</td>
                    <td>
                      {
                        enr.filter(
                          (e) => e.userId === u.id && e.status === "Accepted",
                        ).length
                      }
                    </td>
                    <td>
                      <b>{hoursOf(enr, u.id)}</b>
                    </td>
                    <td>
                      <Badge s={u.status === "Active" ? "Open" : "Rejected"} />
                    </td>
                  </tr>
                ))}
                {students.length === 0 && (
                  <Empty cols={6} text="No students registered yet." />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "My Profile" && <Profile d={d} />}
    </Shell>
  );
}

export default SuperAdminPage;
