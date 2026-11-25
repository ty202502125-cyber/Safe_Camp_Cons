import { Stat } from "../../shared/appCommon.jsx";
import StudentActivityCard from "../../components/student/StudentActivityCard.jsx";

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
  const featured = visibleActivities
    .filter((activity) => activity.status === "Open")
    .slice(0, 3);

  return (
    <>
      <section className="stu-dash-welcome">
        <div>
          <span className="eyebrow">STUDENT PORTAL</span>
          <h2>Hello, {me.first}! Ready to serve?</h2>
          <p>
            Browse volunteer activities from campus offices, enroll, log your
            attendance and hours, and receive your certificate automatically
            once you finish.
          </p>
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
        <h2 className="featured-heading">Featured activities</h2>
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
