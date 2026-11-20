import { useEffect, useState } from "react";
import StudentHomePage from "./HomePage.jsx";
import StudentActivityCard from "../../components/student/StudentActivityCard.jsx";
import {
  CATEGORIES,
  nid,
  fullName,
  initials,
  fmtDate,
  fmtTime,
  timeRange,
  hasActivityEnded,
  activityStatus,
  Badge,
  Logo,
  ThemeToggle,
  ActivityDetails,
  Panel,
  Empty,
  pdfFromCanvas,
  drawCertificate,
  saveBlob,
  Profile,
} from "../../shared/appCommon.jsx";

export function StudentPage({ d, start }) {
  const { acts, enr, setEnr, flash, me, users, organizations } = d;
  const [page, setPage] = useState(start || "Home");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [st, setSt] = useState("All");
  const [logId, setLogId] = useState(null);
  const [log, setLog] = useState({ date: "", hours: "" });
  const [clockNow, setClockNow] = useState(() => new Date());
  const [certKey, setCertKey] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const act = (id) => acts.find((a) => a.id === id);
  const studentCollegeActive = organizations.some(
    (org) =>
      org.name === me.college &&
      org.type === "College" &&
      org.status === "Active",
  );
  const canAccessActivity = (activity) => {
    const owner = users.find((user) => user.id === activity.by);
    return (
      studentCollegeActive &&
      (owner?.college === me.college ||
        !activity.colleges?.length ||
        activity.colleges.includes(me.college))
    );
  };
  const mine = enr.filter((e) => e.userId === me.id && act(e.actId));
  const visible = acts.filter(
    (a) =>
      ["Open", "Ongoing"].includes(activityStatus(a, clockNow)) &&
      !hasActivityEnded(a, clockNow) &&
      canAccessActivity(a),
  );
  const logged = mine.filter((e) => e.attended);
  const total = logged.reduce((s, e) => s + Number(e.hours || 0), 0);
  const done = (e) => {
    const a = act(e.actId);
    return (
      e.status === "Accepted" &&
      e.attended &&
      e.verified &&
      activityStatus(a, clockNow) === "Completed" &&
      e.hours >= a.hours
    );
  };
  const released = mine.filter(done);
  const doneHours = released.reduce((s, e) => s + Number(e.hours), 0);
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const certs = [
    ...released.map((e) => {
      const a = act(e.actId);
      return {
        key: "e" + e.id,
        label: a.title,
        heading: "Certificate of Completion",
        body: `has successfully completed the volunteer activity “${a.title}”, rendering ${plural(e.hours, "hour")} of service on ${fmtDate(e.logDate || a.date)}.`,
      };
    }),
    ...(released.length
      ? [
          {
            key: "all",
            label: `Accumulated hours (${doneHours} h)`,
            heading: "Certificate of Volunteer Service",
            body: `has rendered ${plural(doneHours, "hour")} of volunteer and community service across ${plural(released.length, "completed activity").replace("activitys", "activities")}.`,
          },
        ]
      : []),
  ];
  const cert = certs.find((c) => c.key === certKey) || certs[0];
  const list = visible.filter(
    (a) =>
      (cat === "All" || a.category === cat) &&
      (st === "All" || activityStatus(a, clockNow) === st) &&
      [a.title, a.desc, a.location].some((f) =>
        f.toLowerCase().includes(q.trim().toLowerCase()),
      ),
  );

  function enroll(a) {
    if (!canAccessActivity(a))
      return flash("This activity is not open to your college.", true);
    if (hasActivityEnded(a))
      return flash(
        "This activity has ended and is no longer open for enrollment.",
        true,
      );
    if (mine.some((e) => e.actId === a.id))
      return flash(
        "You already have an enrollment request for this activity.",
        true,
      );
    setEnr([
      ...enr,
      {
        id: nid(enr),
        actId: a.id,
        userId: me.id,
        status: "Pending",
        attended: false,
        hours: 0,
      },
    ]);
    flash("Request sent! The office will review your enrollment.");
  }
  function cancel(e) {
    setEnr(enr.filter((x) => x.id !== e.id));
    flash("Enrollment request cancelled.");
  }
  function openLog(e) {
    const a = act(e.actId);
    if (e.status !== "Accepted")
      return flash(
        "Your enrollment must be approved before you can submit hours.",
        true,
      );
    if (!hasActivityEnded(a))
      return flash(
        `Attendance can be submitted after the activity ends at ${fmtTime(a.endTime)} on ${fmtDate(a.date)}.`,
        true,
      );
    setLogId(e.id);
    setLog({ date: a.date, hours: e.attended ? e.hours : a.hours });
  }
  function submitLog(ev) {
    ev.preventDefault();
    const e = enr.find((x) => x.id === logId),
      a = act(e.actId),
      h = Number(log.hours);
    if (e.status !== "Accepted")
      return flash(
        "Your enrollment must be approved before you can submit hours.",
        true,
      );
    if (!hasActivityEnded(a))
      return flash(
        "You can submit attendance after the activity's scheduled end time.",
        true,
      );
    if (log.date !== a.date)
      return flash("Attendance must be recorded for the activity date.", true);
    if (!log.date || !(h > 0))
      return flash(
        "Enter the date you attended and the hours you worked.",
        true,
      );
    if (h > a.hours)
      return flash(
        `Hours can’t exceed the activity’s ${a.hours} service hour(s).`,
        true,
      );
    setEnr(
      enr.map((x) =>
        x.id === e.id
          ? {
              ...x,
              attended: true,
              hours: h,
              logDate: log.date,
              verified: false,
            }
          : x,
      ),
    );
    setLogId(null);
    flash(
      "Attendance and hours submitted. Your coordinator must verify them before a certificate can be released.",
    );
  }
  async function pdf() {
    const c = await drawCertificate(
      fullName(me),
      me.college,
      cert.heading,
      cert.body,
    );
    saveBlob(
      pdfFromCanvas(c),
      `WMSU-${cert.key}-${me.last}-${me.first}.pdf`.replace(/[^\w.-]+/g, "_"),
    );
    flash("Certificate PDF downloaded.");
  }

  const logE = logId && enr.find((x) => x.id === logId);
  const logA = logE && act(logE.actId);

  return (
    <div className="stu">
      <nav className="snav noprint" aria-label="Main navigation">
        <button
          type="button"
          className="brand brand-link"
          aria-label="Go to home"
          onClick={() => setPage("Home")}
        >
          <Logo />
          <span>
            <b>Campus Serve</b>
            <small>Student Portal</small>
          </span>
        </button>
        <div className="tabsbar">
          {[
            "Home",
            "Activities",
            "My Enrollments",
            "Hours & Certificate",
            "My Profile",
          ].map((label) => (
            <button
              key={label}
              type="button"
              className={`ni ${page === label ? "on" : ""}`}
              onClick={() => setPage(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <ThemeToggle theme={d.theme} setTheme={d.setTheme} />
        <button
          type="button"
          className="av avbtn"
          title="My profile"
          onClick={() => setPage("My Profile")}
        >
          {initials(me)}
        </button>
        <button type="button" className="btn out sm" onClick={d.logout}>
          Log out
        </button>
      </nav>
      <main className="stu-main">
        {page === "Home" && (
          <StudentHomePage
            me={me}
            totalHours={total}
            activitiesJoined={
              mine.filter((enrollment) => enrollment.status === "Accepted")
                .length
            }
            pendingRequests={
              mine.filter((enrollment) => enrollment.status === "Pending")
                .length
            }
            certificateCount={released.length}
            visibleActivities={visible}
            mine={mine}
            enrollments={enr}
            clockNow={clockNow}
            onNavigate={setPage}
            onSelectActivity={setSelectedActivity}
            onEnroll={enroll}
            onCancel={cancel}
          />
        )}
        {page === "Activities" && (
          <Panel
            eyebrow="VOLUNTEER OPPORTUNITIES"
            title="Browse activities"
            sub="Search and filter, then enroll in the services you want to join."
          >
            <div className="filters">
              <input
                aria-label="Search activities"
                placeholder="Search by title, description or location…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                aria-label="Category"
                value={cat}
                onChange={(e) => setCat(e.target.value)}
              >
                {["All", ...CATEGORIES].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <select
                aria-label="Status"
                value={st}
                onChange={(e) => setSt(e.target.value)}
              >
                {["All", "Open", "Ongoing", "Completed"].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="acts">
              {list.map((a) => (
                <StudentActivityCard
                  key={a.id}
                  activity={a}
                  mine={mine}
                  enrollments={enr}
                  clockNow={clockNow}
                  onSelect={setSelectedActivity}
                  onEnroll={enroll}
                  onCancel={cancel}
                />
              ))}
            </div>
            {list.length === 0 && (
              <p className="note">No activities match your filters.</p>
            )}
          </Panel>
        )}
        {page === "My Enrollments" && (
          <Panel
            eyebrow="MY SERVICES"
            title="My enrollments"
            sub="After your request is approved and the activity ends, enter the accumulated hours you worked. The coordinator reviews your attendance before a certificate can be released."
          >
            {logE && (
              <form className="form" onSubmit={submitLog}>
                <label className="w">
                  Logging attendance for
                  <input value={logA.title} disabled />
                </label>
                <label>
                  Date attended
                  <input
                    type="date"
                    value={log.date}
                    max={logA.date}
                    min={logA.date}
                    readOnly
                  />
                </label>
                <label>
                  Accumulated hours worked (max {logA.hours})
                  <input
                    type="number"
                    min="0.5"
                    max={logA.hours}
                    step="0.5"
                    value={log.hours}
                    onChange={(e) => setLog({ ...log, hours: e.target.value })}
                  />
                </label>
                <p className="attendance-help w">
                  Submit your total hours after the scheduled end time. Your
                  activity coordinator must verify the entry.
                </p>
                <button className="btn sm" type="submit">
                  Save attendance
                </button>
                <button
                  className="btn out sm"
                  type="button"
                  onClick={() => setLogId(null)}
                >
                  Cancel
                </button>
              </form>
            )}
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>ACTIVITY</th>
                    <th>SCHEDULE</th>
                    <th>REQUEST</th>
                    <th>MY ATTENDANCE</th>
                    <th>CERTIFICATE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((e) => {
                    const a = act(e.actId),
                      can =
                        e.status === "Accepted" &&
                        hasActivityEnded(a, clockNow);
                    return (
                      <tr key={e.id}>
                        <td>
                          <strong>{a.title}</strong>
                          <small>{a.category}</small>
                        </td>
                        <td>
                          {fmtDate(a.date)} · {timeRange(a)}
                          <small>{a.location}</small>
                        </td>
                        <td>
                          <Badge s={e.status} />
                          <small>Activity: {activityStatus(a, clockNow)}</small>
                        </td>
                        <td>
                          {e.attended ? (
                            <>
                              {e.hours} / {a.hours} h
                              <small>
                                {fmtDate(e.logDate)} ·{" "}
                                {e.verified ? "Verified" : "Awaiting review"}
                              </small>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {done(e) ? (
                            <span className="bd ok"> Released</span>
                          ) : e.status === "Accepted" ? (
                            <small>
                              {e.attended && !e.verified
                                ? "Awaiting coordinator verification"
                                : `Full ${a.hours} h + verification + activity completion required`}
                            </small>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {e.status === "Pending" && (
                            <button
                              type="button"
                              className="tb bad"
                              onClick={() => cancel(e)}
                            >
                              Cancel
                            </button>
                          )}
                          {e.status === "Accepted" && !can && (
                            <small>
                              Attendance opens after {fmtTime(a.endTime)} on{" "}
                              {fmtDate(a.date)}.
                            </small>
                          )}
                          {e.status === "Accepted" && can && !e.verified && (
                            <button
                              type="button"
                              className="tb"
                              onClick={() => openLog(e)}
                            >
                              {e.attended ? "Edit hours" : "Submit attendance"}
                            </button>
                          )}
                          {done(e) && (
                            <button
                              type="button"
                              className="tb"
                              onClick={() => {
                                setCertKey("e" + e.id);
                                setPage("Hours & Certificate");
                              }}
                            >
                              View certificate
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {mine.length === 0 && (
                    <Empty
                      cols={6}
                      text="You haven’t enrolled in any activity yet."
                    />
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        )}
        {page === "Hours & Certificate" && (
          <Panel
            eyebrow="COMPLETION RECORDS"
            title="Hours report & certificates"
            sub={`Total logged: ${plural(total, "hour")} across ${plural(logged.length, "activity").replace("activitys", "activities")}. Certificates use the name and college saved in your profile.`}
          >
            <div className="tw noprint">
              <table>
                <thead>
                  <tr>
                    <th>ACTIVITY</th>
                    <th>DATE</th>
                    <th>HOURS</th>
                    <th>REVIEW</th>
                    <th>CERTIFICATE</th>
                  </tr>
                </thead>
                <tbody>
                  {logged.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <strong>{act(e.actId).title}</strong>
                      </td>
                      <td>{fmtDate(e.logDate)}</td>
                      <td>
                        {e.hours} / {act(e.actId).hours}
                      </td>
                      <td>
                        <Badge s={e.verified ? "Verified" : "Logged"} />
                      </td>
                      <td>
                        {done(e) ? (
                          <span className="bd ok"> Released</span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {logged.length === 0 && (
                    <Empty
                      cols={5}
                      text="No hours logged yet. Log your attendance under My Enrollments."
                    />
                  )}
                </tbody>
              </table>
            </div>
            {cert ? (
              <>
                <div className="chips noprint">
                  {certs.map((c) => (
                    <button
                      key={c.key}
                      type="button"
                      className={`chip ${c.key === cert.key ? "on" : ""}`}
                      onClick={() => setCertKey(c.key)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="cert-bar noprint">
                  <div className="cert-actions">
                    <button
                      type="button"
                      className="btn sm"
                      onClick={() => window.print()}
                    >
                      Print
                    </button>
                    <button type="button" className="btn out sm" onClick={pdf}>
                      Download PDF
                    </button>
                  </div>
                </div>
                <div className="cert" id="certificate">
                  <div className="wm">WMSU</div>
                  <Logo big />
                  <span className="eb">WESTERN MINDANAO STATE UNIVERSITY</span>
                  <h2>{cert.heading}</h2>
                  <p>Presented to</p>
                  <div className="nm">{fullName(me)}</div>
                  <p>
                    {me.college}
                    <br />
                    {cert.body}
                  </p>
                  <p>
                    Issued on{" "}
                    {new Date().toLocaleDateString("en-PH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <div className="line">Authorized Signature</div>
                </div>
                <p className="note noprint">
                  Use Print and choose “Save as PDF”, or download the PDF
                  directly.
                </p>
              </>
            ) : (
              <p className="note" style={{ marginTop: 18 }}>
                Certificates are released only after an approved participant
                records the full scheduled hours, the coordinator verifies
                attendance, and the activity is marked completed.
              </p>
            )}
          </Panel>
        )}
        {page === "My Profile" && <Profile d={d} />}
        {selectedActivity && (
          <ActivityDetails
            activity={selectedActivity}
            status={activityStatus(selectedActivity, clockNow)}
            users={d.users}
            enrollments={enr}
            organizations={d.organizations}
            close={() => setSelectedActivity(null)}
          />
        )}
      </main>
    </div>
  );
}

export default StudentPage;
