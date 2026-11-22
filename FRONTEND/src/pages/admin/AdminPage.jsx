import { useEffect, useState } from "react";
import AdminHomePage from "./HomePage.jsx";
import {
  CATEGORIES,
  COLLEGES,
  nid,
  fullName,
  fmtDate,
  timeRange,
  calcHours,
  compressActivityImage,
  hasActivityEnded,
  activityStatus,
  Badge,
  accepted,
  hoursOf,
  collegeHasActiveAdmin,
  activeAcademicYear,
  isArchivedActivity,
  periodLabel,
  ActivityDetails,
  Panel,
  Empty,
  Shell,
  Profile,
} from "../../shared/appCommon.jsx";

const blank = {
  title: "",
  desc: "",
  category: CATEGORIES[0],
  date: "",
  time: "",
  endTime: "",
  location: "",
  hours: 3,
  slots: 20,
  colleges: [...COLLEGES],
  image: "",
  mandatory: false,
};
export function AdminPage({ d, start }) {
  const {
    users,
    setUserStatus,
    removeUser,
    acts,
    setActs,
    enr,
    setEnr,
    flash,
    me,
    organizations,
    academicYears,
  } = d;
  const [page, setPage] = useState(start || "Dashboard");
  const [studentDeactivationChoice, setStudentDeactivationChoice] =
    useState(null);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [q, setQ] = useState("");
  const [sf, setSf] = useState("All");
  const [clockNow, setClockNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const statusOf = (activity) => activityStatus(activity, clockNow);
  useEffect(() => {
    const endedIds = new Set(
      acts
        .filter(
          (activity) =>
            activity.by === me.id &&
            !isArchivedActivity(activity, academicYears) &&
            ["Open", "Ongoing"].includes(activity.status) &&
            hasActivityEnded(activity, clockNow),
        )
        .map((activity) => activity.id),
    );
    if (endedIds.size)
      setActs(
        acts.map((activity) =>
          endedIds.has(activity.id)
            ? { ...activity, status: "Completed" }
            : activity,
        ),
      );
  }, [acts, academicYears, clockNow, me.id, setActs]);
  const collegeOptions = organizations
    .filter((org) => collegeHasActiveAdmin(org.name, users, organizations))
    .map((org) => org.name);
  const assignedCollege = collegeOptions.includes(me.college) ? me.college : "";
  const mine = acts.filter((a) => a.by === me.id);
  const activeYear = activeAcademicYear(academicYears);
  const isLocked = (activity) => isArchivedActivity(activity, academicYears);
  const myEnr = enr.filter((e) => mine.some((a) => a.id === e.actId));
  const collegeStudents = users.filter(
    (u) => u.role === "User" && u.college === me.college,
  );
  const reqs = myEnr.filter((e) => e.status === "Pending");
  const stu = (id) => users.find((u) => u.id === id);
  const act = (id) => acts.find((a) => a.id === id);
  const shown = mine.filter(
    (a) =>
      (sf === "All" || statusOf(a) === sf) &&
      [a.title, a.category, a.location].some((f) =>
        f.toLowerCase().includes(q.trim().toLowerCase()),
      ),
  );
  const mandatoryMine = mine.filter(
    (a) =>
      a.mandatory &&
      ["Open", "Ongoing", "Completed"].includes(statusOf(a)),
  );
  const eligibleStudents = (activity) =>
    collegeStudents.filter(
      (student) =>
        !activity.colleges?.length || activity.colleges.includes(student.college),
    );
  const completedCount = (activity) =>
    enr.filter(
      (e) => e.actId === activity.id && e.attended && e.verified,
    ).length;
  async function toggleStudent(id) {
    const student = users.find((user) => user.id === id);
    if (!student) return;
    try {
      await setUserStatus(
        id,
        student.status === "Active" ? "Inactive" : "Active",
      );
      setStudentDeactivationChoice(null);
      flash("Student account status updated.");
    } catch (error) {
      flash(error.message, true);
    }
  }
  async function deleteStudent(id) {
    const student = users.find(
      (user) =>
        user.id === id && user.role === "User" && user.college === me.college,
    );
    if (!student) return;
    if (
      !window.confirm(
        `Permanently delete ${fullName(student)} (${student.email})? This also removes their enrollment records.`,
      )
    )
      return;
    try {
      await removeUser(id);
      setEnr(enr.filter((enrollment) => enrollment.userId !== id));
      setStudentDeactivationChoice(null);
      flash("Student account and enrollment records permanently deleted.");
    } catch (error) {
      flash(error.message, true);
    }
  }
  const setF = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const toggleCollege = (college) =>
    setForm({
      ...form,
      colleges: form.colleges.includes(college)
        ? form.colleges.filter((c) => c !== college)
        : [...form.colleges, college],
    });
  const setTime = (k) => (e) => {
    const next = { ...form, [k]: e.target.value };
    const h = calcHours(next.time, next.endTime);
    if (h) next.hours = h;
    setForm(next);
  };
  async function chooseImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/"))
      return flash("Choose an image file.", true);
    if (file.size > 10 * 1024 * 1024)
      return flash("Choose an image smaller than 10 MB.", true);
    try {
      const image = await compressActivityImage(file);
      setForm((current) => (current ? { ...current, image } : current));
    } catch (error) {
      flash(error.message || "Could not load that image.", true);
    }
  }

  function save(e) {
    e.preventDefault();
    if (editId && isLocked(acts.find((a) => a.id === editId)))
      return flash("Archived academic years are read-only.", true);
    if (!editId && !activeYear)
      return flash(
        "Ask the Super Admin to set an academic year and semester first.",
        true,
      );
    if (
      !form.title.trim() ||
      !form.date ||
      !form.time ||
      !form.endTime ||
      !form.location.trim()
    )
      return flash(
        "Please complete the title, date, starting time, ending time and location.",
        true,
      );
    if (form.endTime <= form.time)
      return flash(
        "The ending time must be later than the starting time.",
        true,
      );
    const eligibleColleges = [
      ...new Set([
        ...form.colleges,
        ...(assignedCollege ? [assignedCollege] : []),
      ]),
    ];
    if (
      !eligibleColleges.length ||
      eligibleColleges.some((college) => !collegeOptions.includes(college))
    )
      return flash("Choose at least one active participating college.", true);
    const data = {
      ...form,
      colleges: eligibleColleges,
      title: form.title.trim(),
      location: form.location.trim(),
      hours: Number(form.hours) || 1,
      slots: Number(form.slots) || 1,
      mandatory: Boolean(form.mandatory),
    };
    if (!editId) {
      data.schoolYear = activeYear.year;
      data.semester = activeYear.semester;
    }
    if (editId) {
      setActs(
        acts.map((a) =>
          a.id === editId
            ? {
                ...a,
                ...data,
                status: a.status === "Rejected" ? "Pending" : a.status,
              }
            : a,
        ),
      );
      flash("Activity updated.");
    } else {
      setActs([
        ...acts,
        { ...data, id: nid(acts), status: "Pending", by: me.id },
      ]);
      flash("Activity submitted to the Super Admin for approval.");
    }
    setForm(null);
    setEditId(null);
  }
  function remove(a) {
    if (isLocked(a))
      return flash("Archived academic years are read-only.", true);
    if (
      !window.confirm(`Delete “${a.title}”? Enrollments will be removed too.`)
    )
      return;
    setActs(acts.filter((x) => x.id !== a.id));
    setEnr(enr.filter((e) => e.actId !== a.id));
    flash("Activity deleted.");
  }
  const setStatus = (a, status) => {
    if (isLocked(a))
      return flash("Archived academic years are read-only.", true);
    setActs(acts.map((x) => (x.id === a.id ? { ...x, status } : x)));
    flash(`Activity marked ${status.toLowerCase()}.`);
  };
  function respond(e, status) {
    const a = act(e.actId);
    if (isLocked(a))
      return flash("Archived academic years are read-only.", true);
    if (status === "Accepted" && hasActivityEnded(a, clockNow))
      return flash(
        "This activity has ended, so new participation requests can’t be approved.",
        true,
      );
    if (status === "Accepted" && accepted(enr, a) >= a.slots)
      return flash("This activity is already full.", true);
    setEnr(enr.map((x) => (x.id === e.id ? { ...x, status } : x)));
    flash(`Request ${status.toLowerCase()}.`, status === "Declined");
  }
  const verify = (e) => {
    if (isLocked(act(e.actId)))
      return flash("Archived academic years are read-only.", true);
    setEnr(
      enr.map((x) =>
        x.id === e.id
          ? {
              ...x,
              verified: true,
              verifiedAt: new Date().toISOString(),
              verifiedBy: me?.id ?? null,
            }
          : x,
      ),
    );
    flash("Attendance verified.");
  };
  const rejectLog = (e) => {
    if (isLocked(act(e.actId)))
      return flash("Archived academic years are read-only.", true);
    setEnr(
      enr.map((x) =>
        x.id === e.id
          ? {
              ...x,
              attended: false,
              hours: 0,
              verified: false,
              logDate: "",
              submittedAt: null,
              verifiedAt: null,
              verifiedBy: null,
            }
          : x,
      ),
    );
    flash("Log rejected. The student can submit it again.", true);
  };

  return (
    <Shell
      d={d}
      page={page}
      setPage={setPage}
      nav={[
        ["Dashboard"],
        ["My Activities"],
        ["Mandatory", mandatoryMine.length],
        ["Requests", reqs.length],
        ["Attendance & Hours"],
        ["Student Accounts"],
        ["My Profile"],
      ]}
    >
      {page === "Dashboard" && (
        <AdminHomePage
          me={me}
          activities={mine}
          enrollments={enr}
          requests={reqs}
          loggedHours={myEnr
            .filter((enrollment) => enrollment.attended)
            .reduce(
              (sum, enrollment) => sum + Number(enrollment.hours || 0),
              0,
            )}
          onCreateActivity={() => {
            setForm({
              ...blank,
              colleges: assignedCollege ? [assignedCollege] : [],
            });
            setEditId(null);
            setPage("My Activities");
          }}
          onSelectActivity={setSelectedActivity}
          getStatus={statusOf}
        />
      )}
      {page === "Student Accounts" && (
        <Panel
          eyebrow="COLLEGE REGISTRY"
          title="Student accounts"
          sub={`Manage student accounts assigned to ${me.college}. Deactivation suspends access; deleting an account also removes its enrollment records.`}
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
                  <th>ACCOUNT ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {collegeStudents.map((u) => (
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
                      {u.status === "Active" ? (
                        studentDeactivationChoice === u.id ? (
                          <>
                            <button
                              type="button"
                              className="tb"
                              onClick={() => toggleStudent(u.id)}
                            >
                              Confirm deactivate
                            </button>
                            <button
                              type="button"
                              className="tb bad"
                              onClick={() => deleteStudent(u.id)}
                            >
                              Delete instead
                            </button>
                            <button
                              type="button"
                              className="tb"
                              onClick={() => setStudentDeactivationChoice(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="tb"
                            onClick={() => setStudentDeactivationChoice(u.id)}
                          >
                            Deactivate
                          </button>
                        )
                      ) : (
                        <button
                          type="button"
                          className="tb"
                          onClick={() => toggleStudent(u.id)}
                        >
                          Activate
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {collegeStudents.length === 0 && (
                  <Empty
                    cols={6}
                    text="No student accounts are assigned to your college."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "My Activities" && (
        <Panel
          eyebrow="PROGRAM MANAGEMENT"
          title="Volunteer activities"
          sub="New activities are reviewed by the Super Admin before students can see them."
          action={
            <button
              type="button"
              className="btn sm"
              onClick={() => {
                setForm(
                  form
                    ? null
                    : {
                        ...blank,
                        colleges: assignedCollege ? [assignedCollege] : [],
                      },
                );
                setEditId(null);
              }}
            >
              {form ? (editId ? "Cancel editing" : "Cancel") : "Add activity"}
            </button>
          }
        >
          {form && (
            <form className="form" onSubmit={save}>
              {editId && (
                <div className="editbar">
                  Editing “{acts.find((a) => a.id === editId)?.title}” — change
                  any detail below, then save.
                </div>
              )}
              <p className="note">
                Academic period:{" "}
                <strong>
                  {editId
                    ? periodLabel(acts.find((a) => a.id === editId))
                    : activeYear
                      ? `${activeYear.year} · ${activeYear.semester}`
                      : "Not set by the Super Admin yet"}
                </strong>
              </p>
              <label className="w check">
                <input
                  type="checkbox"
                  checked={Boolean(form.mandatory)}
                  onChange={(e) =>
                    setForm({ ...form, mandatory: e.target.checked })
                  }
                />
                Mandatory activity — students are required to attend
              </label>
              <label className="w">
                Title
                <input
                  value={form.title}
                  onChange={setF("title")}
                  placeholder="e.g. Coastal clean-up"
                />
              </label>
              <label className="w">
                Description
                <textarea
                  value={form.desc}
                  onChange={setF("desc")}
                  placeholder="What will volunteers do?"
                />
              </label>
              <label className="w">
                Activity photo{" "}
                <span className="opt">(optional, JPG/PNG/WebP; max 10 MB)</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseImage}
                />
              </label>
              {form.image && (
                <div className="activity-upload-preview w">
                  <img src={form.image} alt="Activity photo preview" />
                  <button
                    type="button"
                    className="tb bad"
                    onClick={() => setForm({ ...form, image: "" })}
                  >
                    Remove photo
                  </button>
                </div>
              )}
              <label>
                Category
                <select value={form.category} onChange={setF("category")}>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <input value={form.location} onChange={setF("location")} />
              </label>
              <label>
                Date
                <input type="date" value={form.date} onChange={setF("date")} />
              </label>
              <label>
                Starting time
                <input
                  type="time"
                  value={form.time}
                  onChange={setTime("time")}
                />
              </label>
              <label>
                Ending time
                <input
                  type="time"
                  value={form.endTime}
                  onChange={setTime("endTime")}
                />
              </label>
              <label>
                Service hours (auto from times)
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={form.hours}
                  onChange={setF("hours")}
                />
              </label>
              <label>
                Volunteer slots
                <input
                  type="number"
                  min="1"
                  value={form.slots}
                  onChange={setF("slots")}
                />
              </label>
              <fieldset className="college-picker w">
                <legend>Participating colleges</legend>
                <p>
                  Only colleges with an active Admin appear here. Your own
                  college is always included; select other colleges to invite
                  their students.
                </p>
                <div className="college-options">
                  {collegeOptions.map((college) => (
                    <label key={college}>
                      <input
                        type="checkbox"
                        checked={
                          form.colleges.includes(college) ||
                          college === assignedCollege
                        }
                        disabled={college === assignedCollege}
                        onChange={() => toggleCollege(college)}
                      />
                      {college}
                    </label>
                  ))}
                </div>
                {!collegeOptions.length && (
                  <small>
                    The Super Admin must assign an active Admin to a college
                    before it can be selected.
                  </small>
                )}
              </fieldset>
              <button className="btn sm" type="submit">
                {editId ? "Save changes" : "Submit for approval"}
              </button>
            </form>
          )}
          <div className="filters">
            <input
              aria-label="Search"
              placeholder="Search activities…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select value={sf} onChange={(e) => setSf(e.target.value)}>
              {[
                "All",
                "Pending",
                "Open",
                "Ongoing",
                "Completed",
                "Rejected",
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="tw admin-work-table">
            <table>
              <thead>
                <tr>
                  <th>ACTIVITY</th>
                  <th>PERIOD</th>
                  <th>SCHEDULE</th>
                  <th>HOURS</th>
                  <th>ENROLLED</th>
                  <th>REQUIRED</th>
                  <th>STATUS</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((a) => {
                  const locked = isLocked(a);
                  return (
                    <tr key={a.id}>
                      <td>
                        <button
                          type="button"
                          className="activity-link"
                          onClick={() => setSelectedActivity(a)}
                        >
                          <strong>{a.title}</strong>
                        </button>
                        <small>{a.category}</small>
                      </td>
                      <td>
                        {periodLabel(a)}
                        {locked && <small>Archived — read-only</small>}
                      </td>
                      <td>
                        {fmtDate(a.date)} · {timeRange(a)}
                        <small>{a.location}</small>
                      </td>
                      <td>{a.hours} h</td>
                      <td>
                        {accepted(enr, a)} / {a.slots}
                      </td>
                      <td>
                        {a.mandatory ? (
                          <Badge s="Mandatory" />
                        ) : (
                          <small>Optional</small>
                        )}
                        {a.mandatory && (
                          <small>
                            {completedCount(a)} / {eligibleStudents(a).length}{" "}
                            completed
                          </small>
                        )}
                      </td>
                      <td>
                        <Badge s={statusOf(a)} />
                      </td>
                      <td>
                        {statusOf(a) === "Open" && (
                          <button
                            type="button"
                            className="tb"
                            disabled={locked}
                            onClick={() => setStatus(a, "Ongoing")}
                          >
                            Start
                          </button>
                        )}
                        {statusOf(a) === "Ongoing" && (
                          <button
                            type="button"
                            className="tb"
                            disabled={locked}
                            onClick={() => setStatus(a, "Completed")}
                          >
                            Complete
                          </button>
                        )}
                        <button
                          type="button"
                          className="tb"
                          disabled={locked}
                          onClick={() => {
                            setForm({
                              title: a.title,
                              desc: a.desc,
                              category: a.category,
                              date: a.date,
                              time: a.time,
                              endTime: a.endTime || "",
                              location: a.location,
                              hours: a.hours,
                              slots: a.slots,
                              colleges: a.colleges?.length
                                ? a.colleges.filter((college) =>
                                    collegeOptions.includes(college),
                                  )
                                : [...collegeOptions],
                              image: a.image || "",
                              mandatory: Boolean(a.mandatory),
                            });
                            setEditId(a.id);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="tb bad"
                          disabled={locked}
                          onClick={() => remove(a)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <Empty cols={8} text="No activities found." />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "Mandatory" && (
        <Panel
          eyebrow="REQUIRED PARTICIPATION"
          title="Mandatory activities"
          sub="Students in the participating colleges are expected to enroll and attend these activities. Completion is counted when attendance is verified."
        >
          <div className="tw admin-work-table">
            <table>
              <thead>
                <tr>
                  <th>ACTIVITY</th>
                  <th>PERIOD</th>
                  <th>DATE</th>
                  <th>COMPLETED</th>
                  <th>NOT YET COMPLETED</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {mandatoryMine.map((a) => {
                  const eligible = eligibleStudents(a);
                  const notDone = eligible.filter((student) => {
                    const enrollment = enr.find(
                      (e) =>
                        e.actId === a.id &&
                        e.userId === student.id &&
                        e.attended &&
                        e.verified,
                    );
                    return !enrollment;
                  });
                  return (
                    <tr key={a.id}>
                      <td>
                        <button
                          type="button"
                          className="activity-link"
                          onClick={() => setSelectedActivity(a)}
                        >
                          <strong>{a.title}</strong>
                        </button>
                        <small>{a.category}</small>
                      </td>
                      <td>{periodLabel(a)}</td>
                      <td>{fmtDate(a.date)}</td>
                      <td>
                        {completedCount(a)} / {eligible.length}
                      </td>
                      <td>
                        {notDone.length ? (
                          notDone.map((student) => (
                            <small key={student.id}>
                              {fullName(student)} · {student.college}
                            </small>
                          ))
                        ) : (
                          <small>All students completed</small>
                        )}
                      </td>
                      <td>
                        <Badge s={statusOf(a)} />
                      </td>
                    </tr>
                  );
                })}
                {mandatoryMine.length === 0 && (
                  <Empty
                    cols={6}
                    text="No mandatory activities yet. Tick 'Mandatory' when creating or editing an activity."
                  />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "Requests" && (
        <Panel
          eyebrow="ENROLLMENT REQUESTS"
          title="Student requests"
          sub="Accept or decline students who want to join your activities."
        >
          <div className="tw admin-work-table">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>COLLEGE</th>
                  <th>ACTIVITY</th>
                  <th>STATUS</th>
                  <th>DECISION</th>
                </tr>
              </thead>
              <tbody>
                {myEnr.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{fullName(stu(e.userId))}</strong>
                      <small>{stu(e.userId).idno}</small>
                    </td>
                    <td>{stu(e.userId).college}</td>
                    <td>
                      {act(e.actId).title}
                      <small>{fmtDate(act(e.actId).date)}</small>
                    </td>
                    <td>
                      <Badge s={e.status} />
                    </td>
                    <td>
                      {e.status === "Pending" ? (
                        <>
                          <button
                            type="button"
                            className="tb"
                            onClick={() => respond(e, "Accepted")}
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            className="tb bad"
                            onClick={() => respond(e, "Declined")}
                          >
                            Decline
                          </button>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
                {myEnr.length === 0 && (
                  <Empty cols={5} text="No student requests yet." />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "Attendance & Hours" && (
        <Panel
          eyebrow="ATTENDANCE LOGS"
          title="Student attendance & hours"
          sub="Students log their own attendance and hours. Verify each entry, or reject it so the student can resubmit."
        >
          <div className="tw admin-work-table">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>ACTIVITY</th>
                  <th>LOG DATE</th>
                  <th>HOURS</th>
                  <th>STATUS</th>
                  <th>REVIEW</th>
                </tr>
              </thead>
              <tbody>
                {myEnr
                  .filter((e) => e.status === "Accepted")
                  .map((e) => {
                    const a = act(e.actId);
                    return (
                      <tr key={e.id}>
                        <td>
                          <strong>{fullName(stu(e.userId))}</strong>
                          <small>{stu(e.userId).college}</small>
                        </td>
                        <td>
                          {a.title}
                          <small>{statusOf(a)}</small>
                        </td>
                        <td>
                          {e.attended ? fmtDate(e.logDate) : "—"}
                          {e.submittedAt && (
                            <small title={e.submittedAt}>
                              Submitted {fmtDate(e.submittedAt)}
                            </small>
                          )}
                        </td>
                        <td>{e.attended ? `${e.hours} / ${a.hours}` : "—"}</td>
                        <td>
                          {e.attended ? (
                            <Badge s={e.verified ? "Verified" : "Logged"} />
                          ) : (
                            <small>Not logged yet</small>
                          )}
                          {e.verifiedAt && (
                            <small title={e.verifiedAt}>
                              {fmtDate(e.verifiedAt)}
                            </small>
                          )}
                        </td>
                        <td>
                          {e.attended && !e.verified ? (
                            <>
                              <button
                                type="button"
                                className="tb"
                                onClick={() => verify(e)}
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                className="tb bad"
                                onClick={() => rejectLog(e)}
                              >
                                Reject
                              </button>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                {myEnr.filter((e) => e.status === "Accepted").length === 0 && (
                  <Empty cols={6} text="No accepted volunteers yet." />
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
      {page === "My Profile" && <Profile d={d} />}
      {selectedActivity && (
        <ActivityDetails
          activity={selectedActivity}
          status={statusOf(selectedActivity)}
          users={users}
          enrollments={enr}
          organizations={organizations}
          close={() => setSelectedActivity(null)}
        />
      )}
    </Shell>
  );
}

export default AdminPage;
