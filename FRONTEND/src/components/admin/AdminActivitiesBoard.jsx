import {
  Badge,
  Empty,
  IMG,
  PHOTO,
  accepted,
  activityStatus,
  fmtDate,
  periodLabel,
  timeRange,
} from "../../shared/appCommon.jsx";

export default function AdminActivitiesBoard({
  activities,
  enrollments,
  users,
  clockNow,
  onSelectActivity,
  onEditActivity,
  onStart,
  onComplete,
  onDelete,
  locked,
}) {
  const rows = activities.map((activity) => {
    const registered = enrollments.filter((e) => e.actId === activity.id);
    const acceptedCount = accepted(enrollments, activity);
    const attended = registered.filter((e) => e.attended).length;
    const verified = registered.filter((e) => e.attended && e.verified).length;
    const eligible = users.filter(
      (u) =>
        u.role === "User" &&
        (!activity.colleges?.length || activity.colleges.includes(u.college)),
    );
    const verifiedIds = new Set(
      registered.filter((e) => e.attended && e.verified).map((e) => e.userId),
    );
    const completed = eligible.filter((u) => verifiedIds.has(u.id)).length;
    return {
      activity,
      registered: registered.length,
      acceptedCount,
      attended,
      verified,
      eligible: eligible.length,
      completed,
      status: activityStatus(activity, clockNow),
    };
  });

  return (
    <>
      <div className="admin-activity-stats">
        <div className="admin-activity-stat">
          <b>{rows.length}</b>
          <span>Activities</span>
        </div>
        <div className="admin-activity-stat accepted">
          <b>{rows.reduce((sum, row) => sum + row.acceptedCount, 0)}</b>
          <span>Accepted</span>
        </div>
        <div className="admin-activity-stat verified">
          <b>{rows.reduce((sum, row) => sum + row.verified, 0)}</b>
          <span>Verified</span>
        </div>
        <div className="admin-activity-stat">
          <b>{rows.filter((row) => row.activity.mandatory).length}</b>
          <span>Mandatory</span>
        </div>
      </div>

      {rows.length ? (
        <div className="admin-activity-grid">
          {rows.map((row) => {
            const {
              activity,
              registered,
              acceptedCount,
              attended,
              verified,
              eligible,
              completed,
              status,
            } = row;
            const isLocked = locked(activity);
            const photo =
              activity.images?.[0] ||
              activity.image ||
              PHOTO[activity.category] ||
              IMG.campus;
            const fill = activity.slots
              ? Math.min(100, Math.round((acceptedCount / activity.slots) * 100))
              : 0;
            return (
              <article className="admin-activity-card" key={activity.id}>
                <button
                  type="button"
                  className="admin-activity-cover"
                  style={{ backgroundImage: `url(${photo})` }}
                  onClick={() => onSelectActivity(activity)}
                  aria-label={`View details for ${activity.title}`}
                >
                  <span className="admin-activity-cover-badges">
                    <Badge s={status} />
                    {activity.mandatory && <Badge s="Mandatory" />}
                  </span>
                  <span className="admin-activity-cover-hint">View details</span>
                </button>
                <div className="admin-activity-body">
                  <div className="admin-activity-head">
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
                  <p className="admin-activity-desc">{activity.desc}</p>
                  <div className="admin-activity-meta">
                    <span>{fmtDate(activity.date)} · {timeRange(activity)}</span>
                    <span>{activity.location}</span>
                    <span>{activity.hours} service hour(s)</span>
                    <span>
                      Pre-register: {activity.registrationStart || "—"} to{" "}
                      {activity.registrationEnd || "—"}
                    </span>
                  </div>
                  <div className="admin-activity-progress">
                    <div style={{ width: `${fill}%` }} />
                  </div>
                  <div className="admin-activity-count">
                    <b>
                      {acceptedCount} / {activity.slots}
                    </b>
                    <span>
                      accepted · {registered} requested · {attended} attended ·{" "}
                      {verified} verified
                    </span>
                  </div>
                  {activity.mandatory && (
                    <div className="admin-activity-count">
                      <b>
                        {completed} / {eligible}
                      </b>
                      <span>mandatory completions</span>
                    </div>
                  )}
                  <div className="admin-activity-actions">
                    <button
                      type="button"
                      className="tb"
                      onClick={() => onSelectActivity(activity)}
                    >
                      Details
                    </button>
                    {status === "Open" && (
                      <button
                        type="button"
                        className="tb"
                        disabled={isLocked}
                        onClick={() => onStart(activity)}
                      >
                        Start
                      </button>
                    )}
                    {status === "Ongoing" && (
                      <button
                        type="button"
                        className="tb"
                        disabled={isLocked}
                        onClick={() => onComplete(activity)}
                      >
                        Complete
                      </button>
                    )}
                    <button
                      type="button"
                      className="tb"
                      disabled={isLocked}
                      onClick={() => onEditActivity(activity)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="tb bad"
                      disabled={isLocked}
                      onClick={() => onDelete(activity)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty cols={9} text="No activities found." />
      )}
    </>
  );
}
