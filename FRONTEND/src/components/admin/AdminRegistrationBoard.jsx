import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Badge,
  Empty,
  IMG,
  PHOTO,
  accepted,
  activityStatus,
  displayName,
  fmtDate,
  initials,
} from "../../shared/appCommon.jsx";

const FILTERS = ["All", "Pending", "Accepted", "Declined"];

export default function AdminRegistrationBoard({
  activities,
  registrations,
  users,
  clockNow,
  onRespond,
  onSelectStudent,
  onSelectActivity,
}) {
  const [filter, setFilter] = useState("All");
  const [activityId, setActivityId] = useState("All");
  const [query, setQuery] = useState("");

  const act = (id) => activities.find((a) => a.id === id);
  const stu = (id) => users.find((u) => u.id === id);

  const count = (status) =>
    registrations.filter((e) => e.status === status).length;
  const attendedCount = registrations.filter((e) => e.attended).length;
  const verifiedCount = registrations.filter((e) => e.verified).length;

  const visible = registrations.filter((e) => {
    if (activityId !== "All" && String(e.actId) !== activityId) return false;
    if (filter !== "All" && e.status !== filter) return false;
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

  const groups = activities
    .map((activity) => ({
      activity,
      rows: visible.filter((e) => e.actId === activity.id),
    }))
    .filter((group) => group.rows.length);

  const attendanceLabel = (e) => {
    if (e.verified) return "Verified";
    if (e.attended) return "Awaiting review";
    return "Not attended";
  };

  const stats = [
    { label: "Registered", value: registrations.length, key: "total" },
    { label: "Pending", value: count("Pending"), key: "pending" },
    { label: "Accepted", value: count("Accepted"), key: "accepted" },
    { label: "Declined", value: count("Declined"), key: "declined" },
    { label: "Attended", value: attendedCount, key: "attended" },
    { label: "Verified", value: verifiedCount, key: "verified" },
  ];

  const statusData = [
    { name: "Pending", value: count("Pending"), color: "#d97706" },
    { name: "Accepted", value: count("Accepted"), color: "#177b4b" },
    { name: "Declined", value: count("Declined"), color: "#b5122b" },
  ].filter((item) => item.value > 0);

  const activityData = activities
    .map((activity) => ({
      name:
        activity.title.length > 16
          ? `${activity.title.slice(0, 16)}…`
          : activity.title,
      Registered: registrations.filter((e) => e.actId === activity.id).length,
      Accepted: accepted(registrations, activity),
    }))
    .filter((item) => item.Registered > 0)
    .sort((a, b) => b.Registered - a.Registered)
    .slice(0, 6);

  return (
    <>
      <div className="reg-stats">
        {stats.map((item) => (
          <div className={`reg-stat ${item.key}`} key={item.key}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="reg-analytics">
        <div className="reg-chart-card">
          <h3>Registration status</h3>
          {statusData.length ? (
            <div className="reg-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                  >
                    {statusData.map((item) => (
                      <Cell key={item.name} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="reg-chart-empty">No registrations yet.</p>
          )}
          <div className="reg-chart-legend">
            {statusData.map((item) => (
              <span key={item.name}>
                <i style={{ background: item.color }} /> {item.name}: {item.value}
              </span>
            ))}
          </div>
        </div>

        <div className="reg-chart-card">
          <h3>Registrations by activity</h3>
          {activityData.length ? (
            <div className="reg-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="Registered" fill="#701426" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="Accepted" fill="#177b4b" radius={[5, 5, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="reg-chart-empty">No activities with registrations yet.</p>
          )}
        </div>
      </div>

      <div className="reg-toolbar">
        <div className="reg-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search student, ID or activity"
            aria-label="Search registrations"
          />
          {query && (
            <button
              className="reg-search-clear"
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <select
          value={activityId}
          onChange={(event) => setActivityId(event.target.value)}
          aria-label="Filter by activity"
        >
          <option value="All">All activities</option>
          {activities.map((activity) => (
            <option key={activity.id} value={activity.id}>
              {activity.title}
            </option>
          ))}
        </select>
        <div className="reg-filters" role="group" aria-label="Filter by status">
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
        <div className="reg-groups">
          {groups.map(({ activity, rows }) => {
            const acceptedCount = accepted(registrations, activity);
            return (
              <section className="reg-group" key={activity.id}>
                <header className="reg-group-head">
                  <button
                    type="button"
                    className="reg-group-cover"
                    title="View activity details"
                    aria-label={`View ${activity.title}`}
                    style={{
                      backgroundImage: `url(${activity.images?.[0] || activity.image || PHOTO[activity.category] || IMG.campus})`,
                    }}
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
                      <span>{fmtDate(activity.date)}</span>
                      <span>{rows.length} registered</span>
                      <span>
                        {acceptedCount} / {activity.slots} accepted
                      </span>
                    </div>
                    <div
                      className="reg-progress"
                      role="progressbar"
                      aria-label={`${acceptedCount} of ${activity.slots} places filled`}
                      aria-valuenow={acceptedCount}
                      aria-valuemin={0}
                      aria-valuemax={activity.slots}
                    >
                      <span
                        style={{
                          width: `${Math.min(100, Math.round((acceptedCount / Math.max(1, activity.slots)) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Badge s={activityStatus(activity, clockNow)} />
                </header>
                <div className="reg-list">
                  {rows.map((e) => {
                    const student = stu(e.userId);
                    if (!student) return null;
                    return (
                      <article className="reg-card" key={e.id}>
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
                        <div className="reg-status">
                          <Badge s={e.status} />
                          <span className="reg-chip">{attendanceLabel(e)}</span>
                        </div>
                        <div className="reg-actions">
                          {e.status === "Pending" ? (
                            <>
                              <button
                                type="button"
                                className="tb"
                                onClick={() => onRespond(e, "Accepted")}
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                className="tb bad"
                                onClick={() => onRespond(e, "Declined")}
                              >
                                Decline
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              className="tb"
                              onClick={() =>
                                onSelectStudent({ student, enrollment: e })
                              }
                            >
                              Details
                            </button>
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
        <Empty
          cols={3}
          text={
            registrations.length
              ? "No registrations match these filters."
              : "No student registrations yet."
          }
        />
      )}
    </>
  );
}
