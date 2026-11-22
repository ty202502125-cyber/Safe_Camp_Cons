import { useState } from "react";
import SuperAdminHomePage, { PendingActivityTable } from "./HomePage.jsx";
import {
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
    createUser,
    resendAdminPassword,
    setUserStatus,
    removeUser,
    acts,
    setActs,
    enr,
    flash,
    organizations,
    setOrganizations,
  } = d;
  const [page, setPage] = useState(start || "Overview");
  const [openOrgAction, setOpenOrgAction] = useState(null);
  const [openAdminAction, setOpenAdminAction] = useState(null);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [showTemporaryPassword, setShowTemporaryPassword] = useState(false);
  const [createdAdmin, setCreatedAdmin] = useState(null);
  const [resendingEmail, setResendingEmail] = useState(false);
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
  function generateTemporaryPassword() {
    const alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    try {
      const randomBytes = new Uint8Array(32);
      window.crypto.getRandomValues(randomBytes);
      setTemporaryPassword(
        Array.from(randomBytes, (byte) => alphabet[byte & 63]).join(""),
      );
      setShowTemporaryPassword(false);
    } catch {
      flash("Secure password generation is unavailable in this browser.", true);
    }
  }
  async function addAdmin(e) {
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
    if (users.some((u) => u.email.toLowerCase() === email))
      return flash("An account with this email already exists.", true);
    if (!temporaryPassword)
      return flash("Generate a temporary password before creating the account.", true);
    setCreatingAdmin(true);
    try {
      const result = await createUser({
        email,
        password: temporaryPassword,
        last: f.last.trim(),
        first: f.first.trim(),
        mi: f.mi.trim(),
        college: organization.name,
      });
      e.target.reset();
      // Keep the one generated copy on screen. Email can be delayed, filtered
      // or misconfigured, so the Super Admin must always be able to hand it over.
      setCreatedAdmin({
        email,
        password: temporaryPassword,
        emailed: result.emailSent !== false,
      });
      setTemporaryPassword("");
      setShowTemporaryPassword(false);
      if (result.emailSent !== false)
        flash(
          `Admin account created for ${organization.name}. The temporary password was emailed to ${email}; if it is not in the inbox, check Spam or copy it below.`,
        );
      else
        flash(
          `Account created, but the email could not be delivered. Copy the password below and give it to the Admin directly.`,
          true,
        );
    } catch (error) {
      flash(error.message, true);
    } finally {
      setCreatingAdmin(false);
    }
  }
  async function copyCreatedPassword() {
    try {
      await navigator.clipboard.writeText(createdAdmin.password);
      flash("Temporary password copied. Share it securely.");
    } catch {
      flash("Copy failed. Select the password and copy it manually.", true);
    }
  }
  async function resendCreatedPassword() {
    setResendingEmail(true);
    try {
      await resendAdminPassword(createdAdmin.email, createdAdmin.password);
      setCreatedAdmin((current) => ({ ...current, emailed: true }));
      flash(`Password emailed again to ${createdAdmin.email}. Check the inbox and Spam folder.`);
    } catch (error) {
      flash(error.message, true);
    } finally {
      setResendingEmail(false);
    }
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
  async function deleteOrganization(name) {
    if (!organizations.some((org) => org.name === name)) return;
    const orgAdmins = users.filter(
      (u) => u.role === "Admin" && u.college === name,
    );
    const warning = orgAdmins.length
      ? ` This also permanently deletes ${orgAdmins.length} Admin account${orgAdmins.length === 1 ? "" : "s"} assigned to it.`
      : "";
    if (!window.confirm(`Permanently delete ${name}?${warning}`)) return;
    try {
      for (const admin of orgAdmins) await removeUser(admin.id);
      setOrganizations(organizations.filter((org) => org.name !== name));
      setOpenOrgAction(null);
      flash(
        `${name} deleted.${orgAdmins.length ? " Assigned Admin accounts were also removed." : ""}`,
      );
    } catch (error) {
      flash(error.message, true);
    }
  }
  async function toggle(id) {
    const account = users.find((u) => u.id === id);
    if (!account || account.role !== "Admin") return;
    const nextStatus = account.status === "Active" ? "Inactive" : "Active";
    try {
      await setUserStatus(id, nextStatus);
    } catch (error) {
      flash(error.message, true);
      return;
    }
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
  async function deleteAdmin(id) {
    const account = users.find((u) => u.id === id && u.role === "Admin");
    if (!account) return;
    if (
      !window.confirm(
        `Permanently delete ${fullName(account)} (${account.email})? This removes the Admin account.`,
      )
    )
      return;
    try {
      await removeUser(id);
    } catch (error) {
      flash(error.message, true);
      return;
    }
    setOpenAdminAction(null);
    setOpenOrgAction(null);
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
          sub="Manage the organizations students can join and assign activity admins to. From the Action column you can activate, deactivate, or permanently delete the Admin account assigned to an organization, or delete the organization itself. A college is available for student sign-up after it has an active Admin account."
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
                  <th>ADMIN STATUS</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => {
                  const orgAdmins = admins.filter(
                    (u) => u.college === org.name,
                  );
                  return (
                    <tr key={org.name}>
                      <td>
                        <strong>{org.name}</strong>
                      </td>
                      <td>{org.type}</td>
                      <td>
                        {orgAdmins.length ? (
                          <>
                            <span className="bd ok">Assigned</span>
                            <small>
                              {fullName(orgAdmins[0])}
                              {orgAdmins[0].status !== "Active" &&
                                " · inactive"}
                            </small>
                          </>
                        ) : (
                          <>
                            <span className="bd no">Unassigned</span>
                            <small>Needs an Admin account</small>
                          </>
                        )}
                      </td>
                      <td>
                        <Badge
                          s={org.status === "Active" ? "Open" : "Rejected"}
                        />
                      </td>
                      <td>
                        {openOrgAction === org.name ? (
                          <div className="org-action-menu">
                            <div className="org-action-choices">
                              <div className="org-action-group">
                                <button
                                  type="button"
                                  className="tb"
                                  onClick={() => {
                                    toggleOrganization(org.name);
                                    setOpenOrgAction(null);
                                  }}
                                >
                                  {org.status === "Active"
                                    ? "Deactivate Org"
                                    : "Activate Org"}
                                </button>
                              </div>
                              {orgAdmins.map((admin) => (
                                <div
                                  className="org-action-group"
                                  key={admin.id}
                                >
                                  <button
                                    type="button"
                                    className="tb"
                                    onClick={() => {
                                      toggle(admin.id);
                                      setOpenOrgAction(null);
                                    }}
                                  >
                                    {admin.status === "Active"
                                      ? "Deactivate Admin"
                                      : "Activate Admin"}
                                  </button>
                                  <button
                                    type="button"
                                    className="tb bad"
                                    onClick={() => {
                                      deleteAdmin(admin.id);
                                      setOpenOrgAction(null);
                                    }}
                                  >
                                    Delete Admin
                                  </button>
                                </div>
                              ))}
                              <div className="org-action-group">
                                <button
                                  type="button"
                                  className="tb bad"
                                  onClick={() => deleteOrganization(org.name)}
                                >
                                  Delete Org
                                </button>
                              </div>
                              <div className="org-action-group">
                                <button
                                  type="button"
                                  className="tb"
                                  onClick={() => setOpenOrgAction(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                            {orgAdmins.length > 0 && (
                              <div className="org-action-owner">
                                <small>Assigned Admin</small>
                                {orgAdmins.map((admin) => (
                                  <strong key={admin.id}>
                                    {fullName(admin)}
                                  </strong>
                                ))}
                              </div>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="tb"
                            onClick={() => setOpenOrgAction(org.name)}
                          >
                            Actions
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
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
          sub="Each college or office can have one Admin account. The Students column shows how many students are registered under that Admin’s college or office. A random temporary password is shown here once and emailed to the Admin, who must change it at first sign-in. Deactivating suspends access but keeps the organization assigned; deleting the account makes it available again."
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
            <p className="sub w">
              Generate a strong temporary password, then send it to the Admin’s
              email. They must change it at first sign-in.
            </p>
            <label className="w">
              Temporary password
              <div className="row" style={{ gap: 8 }}>
                <input
                  type={showTemporaryPassword ? "text" : "password"}
                  value={temporaryPassword}
                  readOnly
                  placeholder="Generate a password first"
                  autoComplete="new-password"
                />
                <button
                  className="tb"
                  type="button"
                  onClick={generateTemporaryPassword}
                  disabled={creatingAdmin}
                >
                  Generate
                </button>
                {temporaryPassword && (
                  <button
                    className="tb"
                    type="button"
                    onClick={() =>
                      setShowTemporaryPassword((visible) => !visible)
                    }
                    disabled={creatingAdmin}
                  >
                    {showTemporaryPassword ? "Hide" : "Show"}
                  </button>
                )}
              </div>
            </label>
            <button
              className="btn sm"
              type="submit"
              disabled={creatingAdmin || !temporaryPassword}
            >
              {creatingAdmin ? "Creating…" : "Create Admin"}
            </button>
          </form>
          {createdAdmin && (
            <div className="card w" style={{ marginTop: 16 }}>
              <strong>
                One-time temporary password for {createdAdmin.email}
              </strong>
              <p className="sub">
                {createdAdmin.emailed
                  ? "This was also emailed to the Admin. If it is not in the inbox, check Spam or use Resend email."
                  : "Email delivery failed. Use Resend email, or copy this password and give it to the Admin another way."}
                {" "}They must change it at first sign-in.
              </p>
              <div className="row" style={{ gap: 8, alignItems: "center" }}>
                <code
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    wordBreak: "break-all",
                    background: "var(--soft, #f4f4f5)",
                    borderRadius: 6,
                  }}
                >
                  {createdAdmin.password}
                </code>
                <button
                  className="tb"
                  type="button"
                  onClick={copyCreatedPassword}
                >
                  Copy
                </button>
                <button
                  className="tb"
                  type="button"
                  onClick={resendCreatedPassword}
                  disabled={resendingEmail}
                >
                  {resendingEmail ? "Sending…" : "Resend email"}
                </button>
                <button
                  className="tb"
                  type="button"
                  onClick={() => setCreatedAdmin(null)}
                >
                  Done
                </button>
              </div>
            </div>
          )}
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>ADMIN</th>
                  <th>COLLEGE / OFFICE</th>
                  <th>STUDENTS</th>
                  <th>ACTIVITIES</th>
                  <th>STATUS</th>
                  <th>ACCOUNT ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((u) => {
                  const managedStudents = students.filter(
                    (student) => student.college === u.college,
                  );
                  return (
                  <tr key={u.id}>
                    <td>
                      <strong>{fullName(u)}</strong>
                      <small>{u.email}</small>
                    </td>
                    <td>{u.college}</td>
                    <td>
                      <strong>{managedStudents.length}</strong>
                      <small>
                        {
                          managedStudents.filter(
                            (student) => student.status === "Active",
                          ).length
                        }{" "}
                        active
                      </small>
                    </td>
                    <td>{acts.filter((a) => a.by === u.id).length}</td>
                    <td>
                      <Badge s={u.status === "Active" ? "Open" : "Rejected"} />
                    </td>
                    <td>
                      {openAdminAction === u.id ? (
                        <div className="org-action-menu">
                          <div className="org-action-choices">
                            <div className="org-action-group">
                              <button
                                type="button"
                                className="tb"
                                onClick={() => {
                                  toggle(u.id);
                                  setOpenAdminAction(null);
                                }}
                              >
                                {u.status === "Active"
                                  ? "Deactivate"
                                  : "Activate"}
                              </button>
                            </div>
                            <div className="org-action-group">
                              <button
                                type="button"
                                className="tb bad"
                                onClick={() => deleteAdmin(u.id)}
                              >
                                Delete
                              </button>
                            </div>
                            <div className="org-action-group">
                              <button
                                type="button"
                                className="tb"
                                onClick={() => setOpenAdminAction(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          <div className="org-action-owner">
                            <small>Admin</small>
                            <strong>{fullName(u)}</strong>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="tb"
                          onClick={() => setOpenAdminAction(u.id)}
                        >
                          Actions
                        </button>
                      )}
                    </td>
                  </tr>
                  );
                })}
                {admins.length === 0 && (
                  <Empty cols={6} text="No admin accounts yet." />
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
