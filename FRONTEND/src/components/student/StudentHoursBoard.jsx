import { useState } from "react";
import {
  Badge,
  Empty,
  IMG,
  PHOTO,
  fmtDate,
} from "../../shared/appCommon.jsx";

const FILTERS = ["All", "Verified", "Logged", "Certificate ready"];

export default function StudentHoursBoard({
  logs,
  activities,
  done,
  onSelect,
  onCertificate,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const act = (id) => activities.find((a) => a.id === id);
  const rows = logs
    .filter((e) => act(e.actId))
    .map((e) => ({ enrollment: e, activity: act(e.actId) }));

  const visible = rows.filter(({ enrollment: e, activity: a }) => {
    if (filter === "Verified" && !e.verified) return false;
    if (filter === "Logged" && e.verified) return false;
    if (filter === "Certificate ready" && !done(e)) return false;
    if (!query.trim()) return true;
    return [a.title, a.category, a.location]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const totalHours = rows.reduce(
    (sum, { enrollment: e }) => sum + (Number(e.hours) || 0),
    0,
  );
  const verifiedHours = rows.reduce(
    (sum, { enrollment: e }) => sum + (e.verified ? Number(e.hours) || 0 : 0),
    0,
  );
  const readyCount = rows.filter(({ enrollment: e }) => done(e)).length;

  const stats = [
    { label: "Logs", value: rows.length, key: "total" },
    { label: "Hours logged", value: totalHours, key: "logged" },
    { label: "Hours verified", value: verifiedHours, key: "verified" },
    { label: "Certificates", value: readyCount, key: "cert" },
  ];

  const emptyText = rows.length
    ? "No hours match your search."
    : "No hours logged yet. Log your attendance under My Enrollments.";

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
            placeholder="Search your hours"
            aria-label="Search hours"
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
        <div className="reg-filters" role="group" aria-label="Filter hours">
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
            const loggedHours = Number(e.hours) || 0;
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
                    <Badge s={e.verified ? "Verified" : "Logged"} />
                    {done(e) && <span className="bd ok">Certificate ready</span>}
                  </span>
                  <span className="stu-record-cover-hint">View details</span>
                </button>

                <div className="stu-record-body">
                  <div className="stu-record-head">
                    <span className="eb">{a.category}</span>
                    <span>{safeDate(e.logDate)}</span>
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
                        {e.verified ? "Verified by coordinator" : "Awaiting review"}
                      </span>
                    </div>
                  </div>

                  <div className="stu-record-statusline">
                    <Badge s={e.verified ? "Verified" : "Logged"} />
                    {done(e) ? (
                      <span className="bd ok">Certificate released</span>
                    ) : (
                      <span>Verification needed before release</span>
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
        <Empty cols={5} text={emptyText} />
      )}
    </>
  );
}

function safeDate(value) {
  return value ? fmtDate(String(value).slice(0, 10)) : "—";
}
