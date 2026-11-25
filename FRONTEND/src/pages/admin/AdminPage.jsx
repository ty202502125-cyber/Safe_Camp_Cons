import { useEffect, useState } from "react";
import AdminHomePage from "./HomePage.jsx";
import AdminRegistrationBoard from "../../components/admin/AdminRegistrationBoard.jsx";
import AdminMandatoryBoard from "../../components/admin/AdminMandatoryBoard.jsx";
import AdminActivitiesBoard from "../../components/admin/AdminActivitiesBoard.jsx";
import {
  CATEGORIES,
  COLLEGES,
  nid,
  fullName,
  displayName,
  initials,
  fmtDate,
  timeRange,
  calcHours,
  compressActivityImage,
  addDays,
  dateKey,
  hasActivityEnded,
  registrationLabel,
  registrationState,
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
import { MemoPreview } from "../../components/common/MemoPreview.jsx";

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
  images: [],
  mandatory: false,
  registrationStart: dateKey(),
  registrationEnd: "",
  memo: null,
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
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [zoomedPhoto, setZoomedPhoto] = useState(null);
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
  const allCollegesSelected =
    collegeOptions.length > 0 &&
    collegeOptions.every(
      (college) =>
        form?.colleges?.includes(college) || college === assignedCollege,
    );
  function toggleAllColleges() {
    const next = allCollegesSelected
      ? assignedCollege
        ? [assignedCollege]
        : []
      : [...collegeOptions];
    setForm((current) =>
      current ? { ...current, colleges: next } : current,
    );
  }
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
        `Permanently delete ${displayName(student)} (${student.email})? This also removes their enrollment records.`,
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
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    const added = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) {
        flash("Skipped a non-image file.", true);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        flash("Skipped an image larger than 10 MB.", true);
        continue;
      }
      try {
        added.push(await compressActivityImage(file));
      } catch (error) {
        flash(error.message || "Could not load that image.", true);
      }
    }
    if (!added.length) return;
    setForm((current) =>
      current
        ? { ...current, images: [...(current.images || []), ...added] }
        : current,
    );
    flash(`${added.length} photo${added.length === 1 ? "" : "s"} added.`);
  }
  function removeImage(index) {
    setForm((current) =>
      current
        ? {
            ...current,
            images: (current.images || []).filter((_, i) => i !== index),
          }
        : current,
    );
  }
  function chooseMemo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = /\.(pdf|txt|doc|docx|png|jpe?g|webp)$/i.test(file.name);
    if (!allowed)
      return flash("Choose a PDF, Word, text or image memo.", true);
    if (file.size > 2 * 1024 * 1024)
      return flash("The memo must be smaller than 2 MB.", true);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((current) =>
        current
          ? {
              ...current,
              memo: {
                name: file.name,
                type: file.type || "application/octet-stream",
                data: String(reader.result),
                size: file.size,
                uploadedAt: new Date().toISOString(),
              },
            }
          : current,
      );
      flash("Memo attached. Students can view and download it.");
    };
    reader.onerror = () => flash("Could not read that memo file.", true);
    reader.readAsDataURL(file);
  }
  function setEventDate(e) {
    const date = e.target.value;
    setForm((current) =>
      current
        ? {
            ...current,
            date,
            registrationEnd:
              !current.registrationEnd || current.registrationEnd >= date
                ? addDays(date, -1)
                : current.registrationEnd,
            registrationStart:
              current.registrationStart || dateKey(),
          }
        : current,
    );
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
    if (!form.registrationStart || !form.registrationEnd)
      return flash("Set the pre-registration start and end dates.", true);
    if (form.registrationStart > form.registrationEnd)
      return flash(
        "The pre-registration end date must be on or after the start date.",
        true,
      );
    if (form.registrationEnd >= form.date)
      return flash(
        "Pre-registration must end before the day of the activity.",
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
      images: form.images || [],
      // Keep the first photo in the old single-photo field for older screens.
      image: form.images?.[0] || "",
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

  function editActivity(a) {
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
        ? a.colleges.filter((college) => collegeOptions.includes(college))
        : [...collegeOptions],
      images: Array.isArray(a.images)
        ? a.images
        : a.image
          ? [a.image]
          : [],
      mandatory: Boolean(a.mandatory),
      registrationStart: a.registrationStart || dateKey(),
      registrationEnd: a.registrationEnd || addDays(a.date, -1),
      memo: a.memo || null,
    });
    setEditId(a.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function toggleMandatoryForAdmin(a) {
    if (isLocked(a))
      return flash("Archived academic years are read-only.", true);
    setActs(
      acts.map((x) =>
        x.id === a.id ? { ...x, mandatory: !x.mandatory } : x,
      ),
    );
    flash(
      a.mandatory
        ? `${a.title} is no longer mandatory.`
        : `${a.title} is now mandatory.`,
    );
  }

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
        ["Registrations", reqs.length],
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
          students={collegeStudents}
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
                      <button
                        type="button"
                        className="person-cell student-detail-link"
                        title="View student details"
                        onClick={() =>
                          setSelectedStudent({ student: u, enrollment: null })
                        }
                      >
                        {u.avatarData && (
                          <img src={u.avatarData} alt="" />
                        )}
                        <div>
                          <strong>{displayName(u)}</strong>
                          <small>{u.email}</small>
                        </div>
                      </button>
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
                Activity photos{" "}
                <span className="opt">
                  (optional — choose as many JPG/PNG/WebP photos as you like;
                  max 10 MB each)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={chooseImage}
                />
              </label>
              {form.images?.length > 0 && (
                <div className="activity-photo-list w">
                  {form.images.map((photo, index) => (
                    <div className="activity-photo-item" key={index}>
                      <img src={photo} alt={`Activity photo ${index + 1}`} />
                      <button
                        type="button"
                        className="tb bad"
                        onClick={() => removeImage(index)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="w">
                Activity memo{" "}
                <span className="opt">
                  (optional: PDF, Word, text or image; max 2 MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.txt,.doc,.docx,image/jpeg,image/png,image/webp"
                  onChange={chooseMemo}
                />
              </label>
              {form.memo && (
                <div className="memo-box w">
                  <div className="memo-info">
                    <strong>{form.memo.name}</strong>
                    <small>Memo attached — students can view and download it.</small>
                  </div>
                  <button
                    type="button"
                    className="tb bad"
                    onClick={() => setForm({ ...form, memo: null })}
                  >
                    Remove memo
                  </button>
                  <MemoPreview memo={form.memo} compact />
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
                Date of activity
                <input
                  type="date"
                  value={form.date}
                  onChange={setEventDate}
                  required
                />
              </label>
              <label>
                Pre-registration starts
                <input
                  type="date"
                  value={form.registrationStart || ""}
                  onChange={setF("registrationStart")}
                  required
                />
              </label>
              <label>
                Pre-registration ends
                <input
                  type="date"
                  value={form.registrationEnd || ""}
                  onChange={setF("registrationEnd")}
                  required
                />
              </label>
              <p className="note w">
                Registration closes before the event day. On the day itself,
                students can no longer register — they must pre-register ahead
                of time.
              </p>
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
                <button
                  className="tb"
                  type="button"
                  onClick={toggleAllColleges}
                  disabled={!collegeOptions.length}
                >
                  {allCollegesSelected
                    ? "Clear other colleges"
                    : "Select all colleges"}
                </button>
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
          <div className="reg-toolbar">
            <div className="reg-search">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                aria-label="Search"
                placeholder="Search activities…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {q && (
                <button
                  type="button"
                  className="reg-search-clear"
                  aria-label="Clear search"
                  onClick={() => setQ("")}
                >
                  ×
                </button>
              )}
            </div>
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
          <AdminActivitiesBoard
            activities={shown}
            enrollments={enr}
            users={users}
            clockNow={clockNow}
            onSelectActivity={setSelectedActivity}
            onEditActivity={editActivity}
            onStart={(a) => setStatus(a, "Ongoing")}
            onComplete={(a) => setStatus(a, "Completed")}
            onDelete={remove}
            locked={isLocked}
          />
        </Panel>
      )}
      {page === "Mandatory" && (
        <Panel
          eyebrow="REQUIRED PARTICIPATION"
          title="Mandatory activities"
          sub="Track who has completed each required activity. You can edit an activity or make it optional from here."
        >
          <AdminMandatoryBoard
            activities={mandatoryMine}
            students={collegeStudents}
            enrollments={enr}
            clockNow={clockNow}
            onSelectActivity={setSelectedActivity}
            onSelectStudent={setSelectedStudent}
            onEditActivity={editActivity}
            onToggleMandatory={toggleMandatoryForAdmin}
            locked={isLocked}
          />
        </Panel>
      )}
      {page === "Registrations" && (
        <Panel
          eyebrow="REGISTRATION DESK"
          title="Registrations"
          sub="See who registered for each activity, their current status, and their attendance progress."
        >
          <AdminRegistrationBoard
            activities={mine}
            registrations={myEnr}
            users={users}
            clockNow={clockNow}
            onRespond={respond}
            onSelectStudent={setSelectedStudent}
            onSelectActivity={setSelectedActivity}
          />
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
                          <strong>{displayName(stu(e.userId))}</strong>
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
          clockNow={clockNow}
          users={users}
          enrollments={enr}
          organizations={organizations}
          close={() => setSelectedActivity(null)}
        />
      )}
      {selectedStudent && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelectedStudent(null)
          }
        >
          <section
            className="card activity-modal student-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="student-request-title"
          >
            <div className="ph">
              <div>
                <span className="eyebrow">
                  {selectedStudent.enrollment ? "STUDENT REQUEST" : "STUDENT DETAILS"}
                </span>
                <h2 id="student-request-title">
                  {displayName(selectedStudent.student)}
                </h2>
              </div>
              <button
                className="tb"
                type="button"
                onClick={() => setSelectedStudent(null)}
              >
                Close
              </button>
            </div>

            <div className="student-popup-body">
              <div className="student-popup-photo">
                {selectedStudent.student.coverData && (
                  <div
                    className="pbanner"
                    style={{
                      backgroundImage: `url(${selectedStudent.student.coverData})`,
                    }}
                  />
                )}
                {selectedStudent.student.avatarData ? (
                  <button
                    type="button"
                    className="student-photo-button"
                    title="Enlarge profile picture"
                    onClick={() =>
                      setZoomedPhoto(selectedStudent.student.avatarData)
                    }
                  >
                    <img
                      src={selectedStudent.student.avatarData}
                      alt={`${fullName(selectedStudent.student)}'s profile picture`}
                      className="student-photo-large"
                    />
                    <span className="student-photo-hint">Click to enlarge</span>
                  </button>
                ) : (
                  <div className="av lg">
                    {initials(selectedStudent.student)}
                  </div>
                )}
              </div>

              <div className="detail-grid">
                <div>
                  <span>Full name</span>
                  <b>{fullName(selectedStudent.student)}</b>
                </div>
                <div>
                  <span>Nickname</span>
                  <b>{selectedStudent.student.nickname || "—"}</b>
                </div>
                <div>
                  <span>ID number</span>
                  <b>{selectedStudent.student.idno}</b>
                </div>
                <div>
                  <span>Email</span>
                  <b>{selectedStudent.student.email}</b>
                </div>
                <div>
                  <span>College</span>
                  <b>{selectedStudent.student.college}</b>
                </div>
                <div>
                  <span>Status</span>
                  <b>{selectedStudent.student.status}</b>
                </div>
              </div>
            </div>

            {selectedStudent.enrollment && (
              <p className="modal-description">
                Request for{" "}
                <strong>{act(selectedStudent.enrollment.actId)?.title}</strong> on{" "}
                {fmtDate(act(selectedStudent.enrollment.actId)?.date)} ·{" "}
                <Badge s={selectedStudent.enrollment.status} />
              </p>
            )}

            <div className="row" style={{ gap: 8, justifyContent: "flex-end" }}>
              {selectedStudent.enrollment?.status === "Pending" ? (
                <>
                  <button
                    className="tb bad"
                    type="button"
                    onClick={() => {
                      respond(selectedStudent.enrollment, "Declined");
                      setSelectedStudent(null);
                    }}
                  >
                    Decline
                  </button>
                  <button
                    className="btn sm"
                    type="button"
                    onClick={() => {
                      respond(selectedStudent.enrollment, "Accepted");
                      setSelectedStudent(null);
                    }}
                  >
                    Accept request
                  </button>
                </>
              ) : (
                <button
                  className="tb"
                  type="button"
                  onClick={() => setSelectedStudent(null)}
                >
                  {selectedStudent.enrollment ? "Done" : "Close"}
                </button>
              )}
            </div>
          </section>
        </div>
      )}
      {zoomedPhoto && (
        <div
          className="modal-backdrop photo-zoom-backdrop"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setZoomedPhoto(null)
          }
        >
          <div className="photo-zoom-box" role="dialog" aria-modal="true">
            <img src={zoomedPhoto} alt="Enlarged student profile picture" />
            <button
              className="tb"
              type="button"
              onClick={() => setZoomedPhoto(null)}
            >
              Close picture
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

export default AdminPage;
