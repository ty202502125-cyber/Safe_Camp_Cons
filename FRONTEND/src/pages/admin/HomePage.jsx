import { Gallery, Hero, Panel, Stat, Badge } from "../../shared/appCommon.jsx";
import { accepted, fmtDate, timeRange } from "../../utils/appUtils.jsx";

export default function AdminHomePage({
  me,
  activities,
  enrollments,
  requests,
  loggedHours,
  onCreateActivity,
  onSelectActivity,
  getStatus,
}) {
  return (
    <>
      <Hero
        title={`Welcome, ${me.first}.`}
        text="Create volunteer activities, accept student requests, and confirm attendance to log hours."
      >
        <button
          type="button"
          className="btn sm"
          style={{ position: "relative", zIndex: 1 }}
          onClick={onCreateActivity}
        >
          Create an activity
        </button>
      </Hero>
      <section className="stats">
        <Stat
          label="My activities"
          value={activities.length}
          detail="Posted by your office"
        />
        <Stat
          label="Awaiting approval"
          value={
            activities.filter((activity) => activity.status === "Pending")
              .length
          }
          detail="Sent to Super Admin"
        />
        <Stat
          label="Student requests"
          value={requests.length}
          detail="Waiting for your reply"
        />
        <Stat
          label="Hours logged"
          value={loggedHours}
          detail="Across your activities"
        />
      </section>
      <Gallery />
      <Panel
        eyebrow="YOUR PROGRAMS"
        title="Activity participation"
        sub="Select an activity to review its participants and available places."
      >
        <div className="activity-shortcuts">
          {activities.map((activity) => {
            const participants = accepted(enrollments, activity);
            const available = Math.max(activity.slots - participants, 0);

            return (
              <button
                key={activity.id}
                type="button"
                className="activity-shortcut"
                onClick={() => onSelectActivity(activity)}
              >
                <span className="activity-shortcut-main">
                  <span className="activity-shortcut-heading">
                    <b>{activity.title}</b>
                    <Badge s={getStatus(activity)} />
                  </span>
                  <small>
                    {fmtDate(activity.date)} · {timeRange(activity)} ·{" "}
                    {activity.location}
                  </small>
                </span>
                <span className="activity-shortcut-metrics">
                  <span>
                    <strong>{participants}</strong>
                    <small>participants</small>
                  </span>
                  <span>
                    <strong>{available}</strong>
                    <small>slots open</small>
                  </span>
                  <span className="activity-shortcut-link">View details</span>
                </span>
              </button>
            );
          })}
          {activities.length === 0 && (
            <p className="note">
              Create an activity to begin tracking participants.
            </p>
          )}
        </div>
      </Panel>
    </>
  );
}
