import {
  Badge,
  accepted,
  activityStatus,
  eventPhase,
  fmtDate,
  registrationLabel,
  registrationState,
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
  const registration = registrationState(activity, clockNow);

  return (
    <article className="card acard">
      <button
        type="button"
        className="aimg"
        style={{
          backgroundImage: `url(${activity.images?.[0] || activity.image || PHOTO[activity.category] || IMG.campus})`,
        }}
        onClick={() => onSelect(activity)}
        aria-label={`View ${activity.title} details`}
      >
        <Badge s={activityStatus(activity, clockNow)} />
        <Badge s={eventPhase(activity, clockNow)} />
        {activity.mandatory && <Badge s="Mandatory" />}
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
          <span>Pre-registration: {registrationLabel(activity)}</span>
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
          {activity.memo && (
            <button type="button" className="tb" onClick={() => onSelect(activity)}>
              Memo
            </button>
          )}
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
              disabled={!registration.open || placesLeft <= 0}
              title={registration.label}
              onClick={() => onEnroll(activity)}
            >
              {!registration.open
                ? "Registration closed"
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
