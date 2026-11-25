import {
  activityStatus,
  fmtDate,
  Stat,
  timeRange,
} from "../../shared/appCommon.jsx";
import StudentActivityCard from "../../components/student/StudentActivityCard.jsx";

const greetingFor = (now) => {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

const localDateKey = (now) =>
  [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

export default function StudentHomePage({
  me,
  totalHours,
  activitiesJoined,
  pendingRequests,
  certificateCount,
  visibleActivities,
  mine,
  enrollments,
  clockNow,
  onNavigate,
  onSelectActivity,
  onEnroll,
  onCancel,
}) {
  const openActivities = visibleActivities.filter(
    (activity) => activityStatus(activity, clockNow) === "Open",
  );
  const nextActivity = mine
    .filter((enrollment) => enrollment.status === "Accepted")
    .map((enrollment) =>
      visibleActivities.find((activity) => activity.id === enrollment.actId),
    )
    .filter((activity) => activity?.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))[0];
  const nextLabel = nextActivity?.date
    ? fmtDate(nextActivity.date)
    : "Date to be set";
  const nextTime = nextActivity ? timeRange(nextActivity) : "";
  const featured = openActivities.slice(0, 3);

  return (
    <>
      <section className="stu-dash-welcome">
        <div className="stu-welcome-main">
          <span className="eyebrow">STUDENT PORTAL</span>
          <h2>
            {greetingFor(clockNow)}, {me.first}.
          </h2>
          <p>
            Your service, in one place. Find an activity, join it, then log
            your hours when you finish.
          </p>
          <div className="stu-welcome-signals">
            <span className={`stu-signal ${openActivities.length ? "live" : ""}`}>
              <i aria-hidden="true" />
              {openActivities.length
                ? `${openActivities.length} open now`
                : "No open activities yet"}
            </span>
            <span className="stu-signal">{fmtDate(localDateKey(clockNow))}</span>
            {nextActivity && (
              <span className="stu-signal">
                Next up: {nextLabel}
                {nextTime ? `, ${nextTime}` : ""}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          className="btn sm"
          onClick={() => onNavigate("Activities")}
        >
          Find an activity
        </button>
      </section>

      <section className="stats">
        <Stat
          label="Hours logged"
          value={totalHours}
          detail="Your recorded service"
        />
        <Stat
          label="Activities joined"
          value={activitiesJoined}
          detail="Accepted enrollments"
        />
        <Stat
          label="Pending requests"
          value={pendingRequests}
          detail="Waiting for approval"
        />
        <Stat
          label="Certificates"
          value={certificateCount}
          detail="Released automatically"
        />
      </section>

      <section className="sh">
        <div className="stu-section-head">
          <div>
            <h2 className="featured-heading">Featured activities</h2>
            <p>Open now and ready for volunteers.</p>
          </div>
          <button
            type="button"
            className="tb"
            onClick={() => onNavigate("Activities")}
          >
            See all
          </button>
        </div>
      </section>
      <section className="acts">
        {featured.map((activity) => (
          <StudentActivityCard
            key={activity.id}
            activity={activity}
            mine={mine}
            enrollments={enrollments}
            clockNow={clockNow}
            hideCover
            onSelect={onSelectActivity}
            onEnroll={onEnroll}
            onCancel={onCancel}
          />
        ))}
        {!featured.length && (
          <p className="note">No open activities right now. Check back soon.</p>
        )}
      </section>
    </>
  );
}
