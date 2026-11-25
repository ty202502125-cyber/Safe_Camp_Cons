import { useState } from "react";
import {
  Badge,
  Empty,
  IMG,
  PHOTO,
  activityStatus,
  displayName,
  fmtDate,
  initials,
} from "../../shared/appCommon.jsx";
import BoardSelect from "../common/BoardSelect.jsx";

const FILTERS = ["All", "Awaiting review", "Verified", "Not logged"];

export default function AdminAttendanceBoard({
  enrollments,
  activities,
  users,
  clockNow,
  onVerify,
  onReject,
  onSelectStudent,
  onSelectActivity,
  locked,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [activityId, setActivityId] = useState("All");

  const act = (id) => activities.find((a) => a.id === id);
  const stu = (id) => users.find((u) => u.id === id);

  const stateOf = (e) => {
    if (e.verified) return "Verified";
    if (e.attended) return "Awaiting review";
    return "Not logged";
  };

  const safeDate = (value) =>
    value ? fmtDate(String(value).slice(0, 10)) : "—";

  const acceptedRows = enrollments.filter((e) => e.status === "Accepted");
  const activitySelectOptions = [
    { value: "All", label: "All activities" },
    ...activities.map((activity) => ({
      value: activity.id,
      label: activity.title,
    })),
  ];
  const count = (state) => acceptedRows.filter((e) => stateOf(e) === state).length;
  const loggedHours = acceptedRows.reduce(
    (sum, e) => sum + (e.attended ? Number(e.hours) || 0 : 0),
    0,
  );

  const stats = [
    { label: "Accepted", value: acceptedRows.length, key: "total" },
    { label: "Awaiting review", value: count("Awaiting review"), key: "review" },
    { label: "Verified", value: count("Verified"), key: "verified" },
    { label: "Hours logged", value: loggedHours, key: "hours" },
  ];

  const visible = acceptedRows.filter((e) => {
    if (activityId !== "All" && String(e.actId) !== activityId) return false;
    if (filter !== "All" && stateOf(e) !== filter) return false;
    if (!query.trim()) return true;

    const student = stu(e.userId);
    const activity = act(e.actId);
    return [
      student?.first,
      student?.last,
      student?.nickname,
      student?.idno,
      student?.email,
      activity?.title,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const groupIds = [...new Set(visible.map((e) => e.actId))];
  const orderedIds = [
    ...activities.filter((a) => groupIds.includes(a.id)).map((a) => a.id),
    ...groupIds.filter((id) => !activities.some((a) => a.id === id)),
  ];

  const groups = orderedIds.map((id) => {
    const activity = act(id) || {
      id,
      title: "Activity unavailable",
      category: "",
      date: "",
      hours: 0,
      slots: 0,
      status: "Completed",
    };
    return { activity, rows: visible.filter((e) => e.actId === id) };
  });

  const emptyText = acceptedRows.length
    ? "No attendance logs match your search."
    : "No accepted volunteers yet.";

  return (
    <>
      <div className="reg-stats attendance-stats">
        {stats.map((item) => (
          <div
            className={`reg-stat attendance-stat ${item.key}`}
            key={item.key}
          >
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="reg-toolbar attendance-toolbar">
        <div className="reg-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search student, ID or activity"
            aria-label="Search attendance logs"
          />
          {query && (
            <button
              type="button"
              className="reg-search-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <BoardSelect
          label="Activity"
          value={activityId}
          onChange={setActivityId}
          options={activitySelectOptions}
          ariaLabel="Filter attendance by activity"
        />
        <div className="reg-filters" role="group" aria-label="Filter by log status">
          {FILTERS.map((status) => (
            <button
              type="button"
              key={status}
              className={`reg-filter ${filter === status ? "on" : ""}`}
              onClick={() => setFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {groups.length ? (
        <div className="reg-groups attendance-groups">
          {groups.map(({ activity, rows }) => {
            const readOnly =
              typeof locked === "function" ? locked(activity) : Boolean(locked);
            const logged = rows.filter((e) => e.attended).length;
            const requiredHours = Number(activity.hours) || 0;
            const photo =
              activity.images?.[0] ||
              activity.image ||
              PHOTO[activity.category] ||
              IMG.campus;

            return (
              <section className="reg-group attendance-group" key={activity.id}>
                <header className="reg-group-head">
                  <button
                    type="button"
                    className="reg-group-cover"
                    title="View activity details"
                    aria-label={`View ${activity.title}`}
                    style={{ backgroundImage: `url(${photo})` }}
                    onClick={() => onSelectActivity(activity)}
                  />
                  <div className="reg-group-info">
                    <button
                      type="button"
                      className="reg-group-title"
                      onClick={() => onSelectActivity(activity)}
                    >
                      {activity.title}
                    </button>
                    <div className="reg-group-meta">
                      <span>{safeDate(activity.date)}</span>
                      <span>{rows.length} accepted</span>
                      <span>{logged} logged</span>
                      <span>{requiredHours} required hour(s)</span>
                    </div>
                    <div
                      className="reg-progress"
                      role="progressbar"
                      aria-label={`${logged} of ${rows.length} attendance logs submitted`}
                      aria-valuenow={logged}
                      aria-valuemin={0}
                      aria-valuemax={rows.length}
                    >
                      <span
                        style={{
                          width: `${rows.length ? Math.round((logged / rows.length) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Badge s={activityStatus(activity, clockNow)} />
                </header>

                <div className="reg-list attendance-list">
                  {rows.map((e) => {
                    const student = stu(e.userId);
                    if (!student) return null;
                    const state = stateOf(e);
                    const loggedHoursValue = e.attended
                      ? Number(e.hours) || 0
                      : 0;
                    const hoursWidth = requiredHours
                      ? Math.min(100, Math.round((loggedHoursValue / requiredHours) * 100))
                      : 0;

                    return (
                      <article className="reg-card attendance-card" key={e.id}>
                        <button
                          type="button"
                          className="reg-person"
                          title="View student details"
                          onClick={() =>
                            onSelectStudent({ student, enrollment: e })
                          }
                        >
                          <span className="reg-avatar">
                            {student.avatarData ? (
                              <img src={student.avatarData} alt="" />
                            ) : (
                              initials(student)
                            )}
                          </span>
                          <span>
                            <strong>{displayName(student)}</strong>
                            <small>
                              {student.idno} · {student.college}
                            </small>
                          </span>
                        </button>

                        <div className="attendance-log">
                          <strong>
                            {e.attended ? safeDate(e.logDate) : "No log yet"}
                          </strong>
                          <span>
                            {e.submittedAt
                              ? `Submitted ${safeDate(e.submittedAt)}`
                              : "Not submitted"}
                          </span>
                          {e.verifiedAt && (
                            <span>Verified {safeDate(e.verifiedAt)}</span>
                          )}
                        </div>

                        <div className="attendance-hours">
                          <strong>
                            {e.attended
                              ? `${loggedHoursValue} / ${requiredHours}`
                              : "—"}{" "}
                            h
                          </strong>
                          <span>hours logged</span>
                          {e.attended && (
                            <div className="attendance-hours-bar">
                              <i style={{ width: `${hoursWidth}%` }} />
                            </div>
                          )}
                        </div>

                        <div className="attendance-review">
                          <div className="reg-status">
                            {state === "Not logged" ? (
                              <span className="reg-chip">Not logged yet</span>
                            ) : (
                              <Badge s={state === "Verified" ? "Verified" : "Logged"} />
                            )}
                          </div>
                          {state === "Awaiting review" && (
                            <div className="reg-actions">
                              <button
                                type="button"
                                className="tb"
                                disabled={readOnly}
                                onClick={() => onVerify(e)}
                              >
                                Verify
                              </button>
                              <button
                                type="button"
                                className="tb bad"
                                disabled={readOnly}
                                onClick={() => onReject(e)}
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <Empty cols={6} text={emptyText} />
      )}
    </>
  );
}
