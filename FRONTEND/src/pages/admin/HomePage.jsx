import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Gallery, Hero, Panel, Stat, Badge } from "../../shared/appCommon.jsx";
import {
  accepted,
  displayName,
  fmtDate,
  initials,
  timeRange,
} from "../../utils/appUtils.jsx";

export default function AdminHomePage({
  me,
  activities,
  enrollments,
  students = [],
  requests,
  loggedHours,
  onCreateActivity,
  onSelectActivity,
  getStatus,
}) {
  const activityIds = new Set(activities.map((activity) => activity.id));
  const myEnrollments = enrollments.filter((e) => activityIds.has(e.actId));
  const acceptedEnrollments = myEnrollments.filter(
    (e) => e.status === "Accepted",
  );
  const attendedEnrollments = acceptedEnrollments.filter((e) => e.attended);

  const activeStudents = students.filter((s) => s.status === "Active");
  const inactiveCount = students.length - activeStudents.length;
  const attendanceRate = acceptedEnrollments.length
    ? Math.round(
        (attendedEnrollments.length / acceptedEnrollments.length) * 100,
      )
    : 0;

  const statusData = [
    { name: "Active", value: activeStudents.length, color: "#177b4b" },
    { name: "Inactive", value: inactiveCount, color: "#b5122b" },
  ];

  const activityData = activities.map((activity) => {
    const rows = acceptedEnrollments.filter((e) => e.actId === activity.id);
    const shortName =
      activity.title.length > 16
        ? `${activity.title.slice(0, 16)}…`
        : activity.title;
    return {
      name: shortName,
      Participants: rows.length,
      Attended: rows.filter((e) => e.attended).length,
    };
  });

  const topStudents = activeStudents
    .map((student) => {
      const rows = acceptedEnrollments.filter((e) => e.userId === student.id);
      const attended = rows.filter((e) => e.attended);
      return {
        student,
        attended: attended.length,
        hours: attended.reduce((sum, e) => sum + Number(e.hours || 0), 0),
      };
    })
    .filter((row) => row.attended > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

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
        <Stat
          label="Active students"
          value={activeStudents.length}
          detail={`in ${me.college}`}
        />
        <Stat
          label="Attended"
          value={attendedEnrollments.length}
          detail="participants showed up"
        />
        <Stat
          label="Attendance rate"
          value={`${attendanceRate}%`}
          detail="of accepted participants"
        />
      </section>

      <Panel
        eyebrow="DEPARTMENT ANALYTICS"
        title="Students & attendance"
        sub={`A quick view of ${me.college} volunteers in your activities.`}
      >
        <div className="analytics-grid">
          <div className="analytics-card">
            <h3>Student status</h3>
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="72%"
                    label
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <p className="sub">
              {activeStudents.length} active · {inactiveCount} inactive
            </p>
          </div>

          <div className="analytics-card">
            <h3>Attendance by activity</h3>
            <div className="analytics-chart">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={activityData}
                  margin={{ top: 8, right: 8, left: -18, bottom: 8 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={52}
                  />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar
                    dataKey="Participants"
                    fill="#b5122b"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Attended"
                    fill="#177b4b"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="analytics-students">
          <h3>Most active students</h3>
          {topStudents.length ? (
            <div className="analytics-student-list">
              {topStudents.map(({ student, attended, hours }) => (
                <div className="analytics-student-row" key={student.id}>
                  <span className="av">
                    {student.avatarData ? (
                      <img
                        src={student.avatarData}
                        alt=""
                        className="av-photo"
                      />
                    ) : (
                      initials(student)
                    )}
                  </span>
                  <span className="analytics-student-name">
                    <b>{displayName(student)}</b>
                    <small>{student.idno}</small>
                  </span>
                  <span className="analytics-student-number">
                    <b>{attended}</b>
                    <small>attended</small>
                  </span>
                  <span className="analytics-student-number">
                    <b>{hours}</b>
                    <small>hours</small>
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="note">
              No attendance logged yet. Confirm attendance to see your most
              active students here.
            </p>
          )}
        </div>
      </Panel>

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
