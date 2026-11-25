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
  periodLabel,
  timeRange,
} from "../../shared/appCommon.jsx";

export default function AdminMandatoryBoard({
  activities,
  students,
  enrollments,
  clockNow,
  onSelectActivity,
  onSelectStudent,
  onEditActivity,
  onToggleMandatory,
  locked,
}) {
  const [query, setQuery] = useState("");

  const rows = activities.map((activity) => {
    const eligible = students.filter(
      (student) =>
        !activity.colleges?.length ||
        activity.colleges.includes(student.college),
    );
    const verifiedIds = new Set(
      enrollments
        .filter(
          (e) =>
            e.actId === activity.id && e.attended && e.verified,
        )
        .map((e) => e.userId),
    );
    const completed = eligible.filter((student) => verifiedIds.has(student.id));
    const pending = eligible.filter((student) => !verifiedIds.has(student.id));
    const rate = eligible.length
      ? Math.round((completed.length / eligible.length) * 100)
      : 0;
    return { activity, eligible, completed, pending, rate };
  });

  const filtered = rows.filter(({ activity, pending }) => {
    if (!query.trim()) return true;
    const text = [activity.title, activity.category, activity.location]
      .concat(pending.map((student) => displayName(student)))
      .join(" ")
      .toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const totalEligible = rows.reduce((sum, row) => sum + row.eligible.length, 0);
  const totalCompleted = rows.reduce((sum, row) => sum + row.completed.length, 0);
  const overallRate = totalEligible
    ? Math.round((totalCompleted / totalEligible) * 100)
    : 0;

  const stats = [
    { label: "Mandatory", value: rows.length, key: "total" },
    { label: "Students", value: totalEligible, key: "students" },
    { label: "Completed", value: totalCompleted, key: "done" },
    { label: "Completion rate", value: `${overallRate}%`, key: "rate" },
  ];

  return (
    <>
      <div className="mandatory-admin-stats">
        {stats.map((item) => (
          <div className={`mandatory-admin-stat ${item.key}`} key={item.key}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="mandatory-admin-toolbar">
        <div className="reg-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search activity or student"
            aria-label="Search mandatory activities"
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
        <span className="mandatory-admin-note">
          Completion counts only attendance that has been verified.
        </span>
      </div>

      {filtered.length ? (
        <div className="mandatory-admin-grid">
          {filtered.map(({ activity, eligible, completed, pending, rate }) => (
            <article className="admin-mandatory-card" key={activity.id}>
              <button
                type="button"
                className="admin-mandatory-cover"
                style={{
                  backgroundImage: `url(${activity.images?.[0] || activity.image || PHOTO[activity.category] || IMG.campus})`,
                }}
                title="View activity details"
                onClick={() => onSelectActivity(activity)}
              >
                <span className="admin-mandatory-cover-badges">
                  <Badge s="Mandatory" />
                  <Badge s={activityStatus(activity, clockNow)} />
                </span>
                <span className="admin-mandatory-cover-hint">View details</span>
              </button>

              <div className="admin-mandatory-body">
                <div className="admin-mandatory-head">
                  <span className="eb">{activity.category}</span>
                  <span>{periodLabel(activity)}</span>
                </div>
                <h3>
                  <button
                    type="button"
                    className="activity-title"
                    onClick={() => onSelectActivity(activity)}
                  >
                    {activity.title}
                  </button>
                </h3>
                <p className="admin-mandatory-meta">
                  {fmtDate(activity.date)} · {timeRange(activity)} ·{" "}
                  {activity.location}
                </p>

                <div className="admin-mandatory-progress">
                  <span style={{ width: `${rate}%` }} />
                </div>
                <div className="admin-mandatory-count">
                  <b>
                    {completed.length} / {eligible.length}
                  </b>
                  <span>completed · {rate}%</span>
                </div>

                <div className="admin-mandatory-people">
                  <span className="admin-mandatory-people-title">
                    Not yet completed
                  </span>
                  {pending.length ? (
                    <div className="admin-mandatory-people-list">
                      {pending.slice(0, 5).map((student) => (
                        <button
                          type="button"
                          key={student.id}
                          className="admin-mandatory-person"
                          title="View student details"
                          onClick={() =>
                            onSelectStudent({
                              student,
                              enrollment:
                                enrollments.find(
                                  (e) =>
                                    e.actId === activity.id &&
                                    e.userId === student.id,
                                ) || null,
                            })
                          }
                        >
                          <span className="reg-avatar">
                            {student.avatarData ? (
                              <img src={student.avatarData} alt="" />
                            ) : (
                              initials(student)
                            )}
                          </span>
                          <span>{displayName(student)}</span>
                        </button>
                      ))}
                      {pending.length > 5 && (
                        <span className="admin-mandatory-more">
                          +{pending.length - 5} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="admin-mandatory-done">
                      Everyone has completed this activity.
                    </p>
                  )}
                </div>

                <div className="admin-mandatory-actions">
                  <button
                    type="button"
                    className="tb"
                    disabled={locked(activity)}
                    onClick={() => onEditActivity(activity)}
                  >
                    Edit activity
                  </button>
                  <button
                    type="button"
                    className="tb bad"
                    disabled={locked(activity)}
                    onClick={() => onToggleMandatory(activity)}
                  >
                    Make optional
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          cols={4}
          text={
            rows.length
              ? "No mandatory activities match this search."
              : "No mandatory activities yet. Tick 'Mandatory' when creating or editing an activity."
          }
        />
      )}
    </>
  );
}
