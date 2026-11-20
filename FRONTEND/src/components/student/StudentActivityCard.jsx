import {
  Badge,
  accepted,
  activityStatus,
  fmtDate,
  timeRange,
} from "../../utils/appUtils.jsx";
import { IMG, PHOTO } from "../../data/appData.js";

function plural(count, word) {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

export default function StudentActivityCard({
  activity,
  mine,
  enrollments,
  clockNow,
  onSelect,
  onEnroll,
  onCancel,
}) {
  const enrollment = mine.find((item) => item.actId === activity.id);
  const placesLeft = activity.slots - accepted(enrollments, activity);

  return (
    <article className="card acard">
      <button
        type="button"
        className="aimg"
        style={{
          backgroundImage: `url(${activity.image || PHOTO[activity.category] || IMG.campus})`,
        }}
        onClick={() => onSelect(activity)}
        aria-label={`View ${activity.title} details`}
      >
        <Badge s={activityStatus(activity, clockNow)} />
      </button>
      <div className="abody">
        <span className="eb">{activity.category}</span>
        <h3>
          <button
            type="button"
            className="activity-title"
            onClick={() => onSelect(activity)}
            aria-label={`View details for ${activity.title}`}
          >
            {activity.title}
          </button>
        </h3>
        <p>{activity.desc}</p>
        <div className="meta">
          <span>
            {fmtDate(activity.date)} · {timeRange(activity)}
          </span>
          <span>{activity.location}</span>
          <span>
            {plural(activity.hours, "service hour")} · {Math.max(placesLeft, 0)}{" "}
            slot(s) left
          </span>
        </div>
        <div className="foot-row">
          <button
            type="button"
            className="tb"
            onClick={() => onSelect(activity)}
          >
            Coordinator & details
          </button>
          {enrollment ? <Badge s={enrollment.status} /> : <span />}
          {enrollment ? (
            enrollment.status === "Pending" && (
              <button
                type="button"
                className="tb bad"
                onClick={() => onCancel(enrollment)}
              >
                Cancel
              </button>
            )
          ) : (
            <button
              type="button"
              className="btn sm"
              disabled={activity.status !== "Open" || placesLeft <= 0}
              onClick={() => onEnroll(activity)}
            >
              {activity.status !== "Open"
                ? "Closed"
                : placesLeft <= 0
                  ? "Full"
                  : "Enroll"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
