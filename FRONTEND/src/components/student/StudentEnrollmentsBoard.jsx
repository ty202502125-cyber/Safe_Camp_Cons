import { useState } from "react";
import {
  Badge,
  Empty,
  IMG,
  PHOTO,
  activityStatus,
  fmtDate,
  fmtTime,
  hasActivityEnded,
  registrationLabel,
  timeRange,
} from "../../shared/appCommon.jsx";
import BoardSelect from "../common/BoardSelect.jsx";

const FILTERS = ["All", "Pending", "Accepted", "Declined", "Completed"];

export default function StudentEnrollmentsBoard({
  enrollments,
  activities,
  clockNow,
  done,
  onSelect,
  onCancel,
  onLog,
  onCertificate,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [activityId, setActivityId] = useState("All");

  const act = (id) => activities.find((a) => a.id === id);
  const rows = enrollments
    .filter((e) => act(e.actId))
    .map((e) => ({ enrollment: e, activity: act(e.actId) }));
  const activityOptions = [
    ...new Map(rows.map(({ activity: a }) => [a.id, a])).values(),
  ];
  const activitySelectOptions = [
    { value: "All", label: "All activities" },
    ...activityOptions.map((a) => ({ value: a.id, label: a.title })),
  ];

  const visible = rows.filter(({ enrollment: e, activity: a }) => {
    if (activityId !== "All" && String(e.actId) !== activityId) return false;
    if (filter === "Completed") {
      if (!done(e)) return false;
    } else if (filter !== "All" && e.status !== filter) {
      return false;
    }
    if (!query.trim()) return true;
    return [a.title, a.desc, a.category, a.location]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const count = (status) =>
    rows.filter(({ enrollment: e }) => e.status === status).length;
  const loggedCount = rows.filter(({ enrollment: e }) => e.attended).length;
  const releasedCount = rows.filter(({ enrollment: e }) => done(e)).length;

  const stats = [
    { label: "Enrollments", value: rows.length, key: "total" },
    { label: "Pending", value: count("Pending"), key: "pending" },
    { label: "Accepted", value: count("Accepted"), key: "accepted" },
    { label: "Attendance", value: loggedCount, key: "logged" },
    { label: "Certificates", value: releasedCount, key: "cert" },
  ];

  const emptyText = rows.length
    ? "No enrollments match your search."
    : "You haven’t enrolled in any activity yet.";

  return (
    <>
      <div className="reg-stats stu-record-stats">
        {stats.map((item) => (
          <div className={`reg-stat ${item.key}`} key={item.key}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="reg-toolbar stu-record-toolbar">
        <div className="reg-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search your activities"
            aria-label="Search enrollments"
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
          ariaLabel="Filter enrollments by activity"
        />
        <div className="reg-filters" role="group" aria-label="Filter enrollments">
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

      {visible.length ? (
        <div className="stu-record-grid">
          {visible.map(({ enrollment: e, activity: a }) => {
            const canLog =
              e.status === "Accepted" && hasActivityEnded(a, clockNow);
            const loggedHours = e.attended ? Number(e.hours) || 0 : 0;
            const requiredHours = Number(a.hours) || 0;
            const hoursWidth = requiredHours
              ? Math.min(100, Math.round((loggedHours / requiredHours) * 100))
              : 0;
            const photo =
              a.images?.[0] || a.image || PHOTO[a.category] || IMG.campus;

            return (
              <article className="stu-record-card" key={e.id}>
                <button
                  type="button"
                  className="stu-record-cover"
                  style={{ backgroundImage: `url(${photo})` }}
                  onClick={() => onSelect(a)}
                  aria-label={`View details for ${a.title}`}
                >
                  <span className="stu-record-cover-badges">
                    <Badge s={e.status} />
                    <Badge s={activityStatus(a, clockNow)} />
                    {a.mandatory && <Badge s="Mandatory" />}
                  </span>
                  <span className="stu-record-cover-hint">View details</span>
                </button>

                <div className="stu-record-body">
                  <div className="stu-record-head">
                    <span className="eb">{a.category}</span>
                    <span>
                      {e.attended
                        ? e.verified
                          ? "Verified"
                          : "Awaiting review"
                        : "No log yet"}
                    </span>
                  </div>
                  <h3>
                    <button
                      type="button"
                      className="activity-title"
                      onClick={() => onSelect(a)}
                    >
                      {a.title}
                    </button>
                  </h3>
                  <p className="stu-record-desc">{a.desc}</p>
                  <div className="stu-record-meta">
                    <span>
                      {fmtDate(a.date)} · {timeRange(a)}
                    </span>
                    <span>{a.location}</span>
                    <span>{a.hours} service hour(s)</span>
                    <span>Pre-registration: {registrationLabel(a)}</span>
                  </div>

                  <div className="stu-record-progress">
                    <div
                      role="progressbar"
                      aria-label={`${loggedHours} of ${requiredHours} hours logged`}
                      aria-valuenow={loggedHours}
                      aria-valuemin={0}
                      aria-valuemax={requiredHours}
                    >
                      <span style={{ width: `${hoursWidth}%` }} />
                    </div>
                    <div className="stu-record-count">
                      <b>
                        {loggedHours} / {requiredHours} h
                      </b>
                      <span>
                        {e.attended ? `Logged ${safeDate(e.logDate)}` : "Not submitted"}
                      </span>
                    </div>
                  </div>

                  <div className="stu-record-statusline">
                    <Badge s={e.status} />
                    {done(e) ? (
                      <span className="bd ok">Certificate released</span>
                    ) : e.status === "Accepted" ? (
                      <span>
                        {e.attended && !e.verified
                          ? "Awaiting coordinator verification"
                          : "Full hours + verification required"}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>

                  <div className="stu-record-actions">
                    <button
                      type="button"
                      className="tb"
                      onClick={() => onSelect(a)}
                    >
                      Details
                    </button>
                    {e.status === "Pending" && (
                      <button
                        type="button"
                        className="tb bad"
                        onClick={() => onCancel(e)}
                      >
                        Cancel
                      </button>
                    )}
                    {e.status === "Accepted" && canLog && !e.verified && (
                      <button
                        type="button"
                        className="tb"
                        onClick={() => onLog(e)}
                      >
                        {e.attended ? "Edit hours" : "Submit attendance"}
                      </button>
                    )}
                    {e.status === "Accepted" && !canLog && (
                      <span className="stu-record-note">
                        Opens after {fmtTime(a.endTime)} on {fmtDate(a.date)}
                      </span>
                    )}
                    {done(e) && (
                      <button
                        type="button"
                        className="tb"
                        onClick={() => onCertificate(e)}
                      >
                        View certificate
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty cols={6} text={emptyText} />
      )}
    </>
  );
}

function safeDate(value) {
  return value ? fmtDate(String(value).slice(0, 10)) : "—";
}
