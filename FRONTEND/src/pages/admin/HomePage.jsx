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
  IMG,
  PHOTO,
  Panel,
  accepted,
  displayName,
  fmtDate,
  initials,
  timeRange,
} from "../../shared/appCommon.jsx";

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
  const acceptedRows = myEnrollments.filter((e) => e.status === "Accepted");
  const pendingRows = myEnrollments.filter((e) => e.status === "Pending");
  const declinedRows = myEnrollments.filter((e) => e.status === "Declined");
  const attendedRows = acceptedRows.filter((e) => e.attended);
  const verifiedRows = acceptedRows.filter((e) => e.verified);
  const verifiedHours = verifiedRows.reduce(
    (sum, e) => sum + Number(e.hours || 0),
    0,
  );

  const activeStudents = students.filter((s) => s.status === "Active");
  const inactiveCount = students.length - activeStudents.length;
  const attendanceRate = acceptedRows.length
    ? Math.round((attendedRows.length / acceptedRows.length) * 100)
    : 0;
  const verificationRate = acceptedRows.length
    ? Math.round((verifiedRows.length / acceptedRows.length) * 100)
    : 0;

  const statusData = [
    { name: "Active", value: activeStudents.length, color: "#177b4b" },
    { name: "Inactive", value: inactiveCount, color: "#b5122b" },
  ].filter((item) => item.value > 0);

  const requestData = [
    { name: "Pending", value: pendingRows.length, color: "#d97706" },
    { name: "Accepted", value: acceptedRows.length, color: "#177b4b" },
    { name: "Declined", value: declinedRows.length, color: "#b5122b" },
  ].filter((item) => item.value > 0);

  const shortName = (title) =>
    title.length > 16 ? `${title.slice(0, 16)}…` : title;

  const activityData = activities
    .map((activity) => {
      const rows = acceptedRows.filter((e) => e.actId === activity.id);
      return {
        name: shortName(activity.title),
        Accepted: rows.length,
        Attended: rows.filter((e) => e.attended).length,
        Verified: rows.filter((e) => e.verified).length,
      };
    })
    .filter((row) => row.Accepted > 0)
    .sort((a, b) => b.Accepted - a.Accepted)
    .slice(0, 6);

  const hoursData = activities
    .map((activity) => ({
      name: shortName(activity.title),
      Hours: verifiedRows
        .filter((e) => e.actId === activity.id)
        .reduce((sum, e) => sum + Number(e.hours || 0), 0),
    }))
    .filter((row) => row.Hours > 0)
    .sort((a, b) => b.Hours - a.Hours)
    .slice(0, 6);

  const topStudents = activeStudents
    .map((student) => {
      const rows = verifiedRows.filter((e) => e.userId === student.id);
      return {
        student,
        attended: attendedRows.filter((e) => e.userId === student.id).length,
        hours: rows.reduce((sum, e) => sum + Number(e.hours || 0), 0),
      };
    })
    .filter((row) => row.hours > 0)
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);

  const stats = [
    {
      label: "My activities",
      value: activities.length,
      detail: "Posted by your office",
      key: "activities",
    },
    {
      label: "Awaiting approval",
      value: activities.filter((activity) => activity.status === "Pending").length,
      detail: "Sent to Super Admin",
      key: "pending-activities",
    },
    {
      label: "Student requests",
      value: requests.length,
      detail: "Waiting for your reply",
      key: "requests",
    },
    {
      label: "Hours logged",
      value: loggedHours,
      detail: "Across your activities",
      key: "hours",
    },
    {
      label: "Active students",
      value: activeStudents.length,
      detail: `in ${me.college}`,
      key: "students",
    },
    {
      label: "Attendance rate",
      value: `${attendanceRate}%`,
      detail: "of accepted participants",
      key: "attendance",
    },
    {
      label: "Verified rate",
      value: `${verificationRate}%`,
      detail: "hours confirmed",
      key: "verified",
    },
  ];

  const ChartLegend = ({ items }) => (
    <div className="admin-dash-legend">
      {items.map((item) => (
        <span key={item.name}>
          <i style={{ background: item.color }} />
          {item.name}: <b>{item.value}</b>
        </span>
      ))}
    </div>
  );

  return (
    <>
      <section className="admin-dash-welcome">
        <div>
          <span className="eyebrow">ADMIN DASHBOARD</span>
          <h2>Welcome, {me.first}.</h2>
          <p>
            Create volunteer activities, accept student requests, and confirm
            attendance to log hours.
          </p>
        </div>
        <button type="button" className="btn sm" onClick={onCreateActivity}>
          Create an activity
        </button>
      </section>

      <div className="admin-dash-stats">
        {stats.map((item) => (
          <article className={`admin-dash-stat ${item.key}`} key={item.key}>
            <b>{item.value}</b>
            <span>{item.label}</span>
            <small>{item.detail}</small>
          </article>
        ))}
      </div>

      <Panel
        eyebrow="DEPARTMENT ANALYTICS"
        title="Students & attendance"
        sub={`A quick view of ${me.college} volunteers in your activities.`}
      >
        <div className="admin-dash-analytics">
          <article className="admin-dash-chart-card">
            <div className="admin-dash-chart-head">
              <h3>Student status</h3>
              <span>{students.length} students</span>
            </div>
            {statusData.length ? (
              <>
                <div className="admin-dash-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={48}
                        outerRadius={72}
                        paddingAngle={3}
                      >
                        {statusData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend items={statusData} />
              </>
            ) : (
              <p className="admin-dash-empty">No students in this college yet.</p>
            )}
          </article>

          <article className="admin-dash-chart-card">
            <div className="admin-dash-chart-head">
              <h3>Activity participation</h3>
              <span>{acceptedRows.length} accepted</span>
            </div>
            {activityData.length ? (
              <>
                <div className="admin-dash-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityData} barGap={2}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="Accepted" fill="#b5122b" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="Attended" fill="#d97706" radius={[5, 5, 0, 0]} />
                      <Bar dataKey="Verified" fill="#177b4b" radius={[5, 5, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend
                  items={[
                    { name: "Accepted", value: acceptedRows.length, color: "#b5122b" },
                    { name: "Attended", value: attendedRows.length, color: "#d97706" },
                    { name: "Verified", value: verifiedRows.length, color: "#177b4b" },
                  ]}
                />
              </>
            ) : (
              <p className="admin-dash-empty">No accepted participants yet.</p>
            )}
          </article>

          <article className="admin-dash-chart-card">
            <div className="admin-dash-chart-head">
              <h3>Request pipeline</h3>
              <span>{myEnrollments.length} total</span>
            </div>
            {requestData.length ? (
              <>
                <div className="admin-dash-chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={requestData} layout="vertical" margin={{ left: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" radius={[0, 5, 5, 0]}>
                        {requestData.map((item) => (
                          <Cell key={item.name} fill={item.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ChartLegend items={requestData} />
              </>
            ) : (
              <p className="admin-dash-empty">No student requests yet.</p>
            )}
          </article>

          <article className="admin-dash-chart-card">
            <div className="admin-dash-chart-head">
              <h3>Verified hours by activity</h3>
              <span>{verifiedHours} hours</span>
            </div>
            {hoursData.length ? (
              <div className="admin-dash-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hoursData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" interval={0} tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="Hours" fill="#701426" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="admin-dash-empty">No verified hours yet.</p>
            )}
          </article>
        </div>

        <div className="admin-dash-top">
          <div className="admin-dash-section-head">
            <h3>Most active students</h3>
            <span>Top 5 by verified hours</span>
          </div>
          {topStudents.length ? (
            <div className="admin-dash-student-list">
              {topStudents.map(({ student, attended, hours }) => (
                <article className="admin-dash-student-row" key={student.id}>
                  <span className="admin-dash-avatar">
                    {student.avatarData ? (
                      <img src={student.avatarData} alt="" />
                    ) : (
                      initials(student)
                    )}
                  </span>
                  <span className="admin-dash-student-name">
                    <b>{displayName(student)}</b>
                    <small>{student.idno}</small>
                  </span>
                  <span className="admin-dash-student-number">
                    <b>{attended}</b>
                    <small>attended</small>
                  </span>
                  <span className="admin-dash-student-number">
                    <b>{hours}</b>
                    <small>hours</small>
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className="admin-dash-empty">
              No verified hours yet. Confirm attendance to see your most active
              students here.
            </p>
          )}
        </div>
      </Panel>

      <Panel
        eyebrow="YOUR PROGRAMS"
        title="Activity participation"
        sub="Select an activity to review its participants and available places."
      >
        <div className="admin-dash-activity-list">
          {activities.map((activity) => {
            const participants = accepted(myEnrollments, activity);
            const verified = myEnrollments.filter(
              (e) => e.actId === activity.id && e.verified,
            ).length;
            const available = Math.max(activity.slots - participants, 0);
            const fill = activity.slots
              ? Math.min(100, Math.round((participants / activity.slots) * 100))
              : 0;
            const photo =
              activity.images?.[0] ||
              activity.image ||
              PHOTO[activity.category] ||
              IMG.campus;

            return (
              <button
                key={activity.id}
                type="button"
                className="admin-dash-activity"
                onClick={() => onSelectActivity(activity)}
              >
                <span
                  className="admin-dash-activity-cover"
                  style={{ backgroundImage: `url(${photo})` }}
                />
                <span className="admin-dash-activity-main">
                  <span className="admin-dash-activity-head">
                    <b>{activity.title}</b>
                    <Badge s={getStatus(activity)} />
                  </span>
                  <small>
                    {fmtDate(activity.date)} · {timeRange(activity)} ·{" "}
                    {activity.location}
                  </small>
                  <span className="admin-dash-activity-bar">
                    <i style={{ width: `${fill}%` }} />
                  </span>
                </span>
                <span className="admin-dash-activity-metrics">
                  <span>
                    <strong>{participants}</strong>
                    <small>participants</small>
                  </span>
                  <span>
                    <strong>{available}</strong>
                    <small>slots open</small>
                  </span>
                  <span>
                    <strong>{verified}</strong>
                    <small>verified</small>
                  </span>
                  <span className="admin-dash-activity-link">View details</span>
                </span>
              </button>
            );
          })}
          {activities.length === 0 && (
            <p className="admin-dash-empty">
              Create an activity to begin tracking participants.
            </p>
          )}
        </div>
      </Panel>
    </>
  );
}
