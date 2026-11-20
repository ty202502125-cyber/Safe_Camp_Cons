import { Gallery, Hero, Stat } from "../../shared/appCommon.jsx";
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
  return (
    <>
      <Hero
        title={`Hello, ${me.first}! Ready to serve?`}
        text="Browse volunteer activities from campus offices, enroll, log your attendance and hours, and receive your certificate automatically once you finish."
      >
        <button
          type="button"
          className="btn sm"
          style={{ position: "relative", zIndex: 1 }}
          onClick={() => onNavigate("Activities")}
        >
          Find an activity
        </button>
      </Hero>
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
      <div className="sh">
        <h2 className="featured-heading">Featured activities</h2>
      </div>
      <div className="acts">
        {visibleActivities
          .filter((activity) => activity.status === "Open")
          .slice(0, 3)
          .map((activity) => (
            <StudentActivityCard
              key={activity.id}
              activity={activity}
              mine={mine}
              enrollments={enrollments}
              clockNow={clockNow}
              onSelect={onSelectActivity}
              onEnroll={onEnroll}
              onCancel={onCancel}
            />
          ))}
      </div>
      <div style={{ height: 24 }} />
      <Gallery />
    </>
  );
}
