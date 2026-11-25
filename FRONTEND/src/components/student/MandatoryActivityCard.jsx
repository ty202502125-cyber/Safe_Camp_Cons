import {
  Badge,
  accepted,
  activityStatus,
  eventPhase,
  fmtDate,
  hasActivityEnded,
  registrationLabel,
  registrationState,
  timeRange,
} from "../../utils/appUtils.jsx";
import { IMG, PHOTO } from "../../data/appData.js";

const STEP_LABELS = ["Pre-register", "Approved", "Attend", "Verified"];

export default function MandatoryActivityCard({
  activity,
  mine,
  enrollments,
  clockNow,
  status,
  onSelect,
  onEnroll,
  onCancel,
  onLog,
}) {
  const enrollment = mine.find((item) => item.actId === activity.id);
  const placesLeft = activity.slots - accepted(enrollments, activity);
  const registration = registrationState(activity, clockNow);

  let step = -1;
  if (enrollment) {
    if (enrollment.status === "Accepted") step = 1;
    if (enrollment.attended) step = 2;
    if (enrollment.verified) step = 3;
  }

  function action() {
    if (!enrollment) {
      const closed = !registration.open || placesLeft <= 0;
      return (
        <button
          type="button"
          className="btn sm"
          disabled={closed}
          title={closed ? registration.label : undefined}
          onClick={() => onEnroll(activity)}
        >
          {!registration.open
            ? "Registration closed"
            : placesLeft <= 0
              ? "Full"
              : "Pre-register"}
        </button>
      );
    }
    if (enrollment.status === "Pending")
      return (
        <button
          type="button"
          className="tb bad"
          onClick={() => onCancel(enrollment)}
        >
          Cancel request
        </button>
      );
    if (enrollment.status === "Accepted" && !enrollment.attended)
      return (
        <button
          type="button"
          className="btn sm"
          disabled={!hasActivityEnded(activity, clockNow)}
          title={
            hasActivityEnded(activity, clockNow)
              ? undefined
              : "Available after the activity ends."
          }
          onClick={() => onLog(enrollment)}
        >
          Log attendance
        </button>
      );
    if (enrollment.attended && !enrollment.verified)
      return <span className="mandatory-note">Awaiting coordinator review</span>;
    if (enrollment.verified)
      return <span className="mandatory-done">Completed</span>;
    return <span className="mandatory-note">Request declined</span>;
  }

  return (
    <article className="card mandatory-card">
      <button
        type="button"
        className="mandatory-cover"
        style={{
          backgroundImage: `url(${activity.images?.[0] || activity.image || PHOTO[activity.category] || IMG.campus})`,
        }}
        onClick={() => onSelect(activity)}
        aria-label={`View ${activity.title} details`}
      >
        <span className="mandatory-cover-badges">
          <Badge s="Mandatory" />
          <Badge s={activityStatus(activity, clockNow)} />
          <Badge s={eventPhase(activity, clockNow)} />
        </span>
        <span className="mandatory-cover-hint">View details</span>
      </button>
      <div className="mandatory-body">
        <div className="mandatory-head">
          <span className="eb">{activity.category}</span>
          <Badge s={status} />
        </div>
        <h3>
          <button
            type="button"
            className="activity-title"
            onClick={() => onSelect(activity)}
          >
            {activity.title}
          </button>
        </h3>
        <p className="mandatory-desc">{activity.desc}</p>
        <div className="mandatory-meta">
          <span>{fmtDate(activity.date)} · {timeRange(activity)}</span>
          <span>{activity.location}</span>
          <span>{activity.hours} service hour(s)</span>
          <span>Pre-registration: {registrationLabel(activity)}</span>
        </div>
        <ol className="mandatory-steps">
          {STEP_LABELS.map((label, index) => (
            <li
              key={label}
              className={
                index <= step ? "done" : index === step + 1 ? "current" : ""
              }
            >
              <span>{index <= step ? "✓" : index + 1}</span>
              {label}
            </li>
          ))}
        </ol>
        <div className="mandatory-actions">
          <button type="button" className="tb" onClick={() => onSelect(activity)}>
            View details
          </button>
          {action()}
        </div>
      </div>
    </article>
  );
}
