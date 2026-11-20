import { IMG, PHOTO } from "../../data/appData.js";
import {
  Badge,
  collegeHasActiveAdmin,
  fullName,
  fmtDate,
  timeRange,
} from "../../utils/appUtils.jsx";
import { Empty } from "./EmptyTableRow.jsx";

export function ActivityDetails({
  activity,
  users,
  enrollments,
  organizations,
  status,
  close,
}) {
  if (!activity) return null;
  const coordinator = users.find((u) => u.id === activity.by);
  const participants = enrollments.filter(
    (e) => e.actId === activity.id && e.status === "Accepted",
  );
  const configuredColleges = organizations
    .filter((org) => collegeHasActiveAdmin(org.name, users, organizations))
    .map((org) => org.name);
  const activityColleges = (
    activity.colleges?.length ? activity.colleges : configuredColleges
  ).filter((name) => configuredColleges.includes(name));
  const colleges = [
    ...new Set([
      ...(configuredColleges.includes(coordinator?.college)
        ? [coordinator.college]
        : []),
      ...activityColleges,
    ]),
  ];
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section
        className="card activity-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-details-title"
      >
        <div className="ph">
          <div>
            <span className="eb">ACTIVITY DETAILS</span>
            <h2 id="activity-details-title">{activity.title}</h2>
          </div>
          <button type="button" className="tb bad" onClick={close}>
            Close
          </button>
        </div>
        <div
          className="activity-detail-image"
          style={{
            backgroundImage: `url(${activity.image || PHOTO[activity.category] || IMG.campus})`,
          }}
          role="img"
          aria-label={`${activity.title} event photo`}
        />
        <p className="modal-description">{activity.desc}</p>
        <div className="detail-grid">
          <span>
            <b>Status</b>
            <Badge s={status || activity.status} />
          </span>
          <span>
            <b>Coordinator</b>
            {coordinator ? fullName(coordinator) : "Not available"}
          </span>
          <span>
            <b>Office</b>
            {coordinator?.college || "Not available"}
          </span>
          <span>
            <b>Email</b>
            {coordinator?.email || "Not available"}
          </span>
          <span>
            <b>Schedule</b>
            {fmtDate(activity.date)} · {timeRange(activity)}
          </span>
          <span>
            <b>Location</b>
            {activity.location}
          </span>
          <span>
            <b>Capacity</b>
            {participants.length} / {activity.slots} slots filled (
            {Math.max(activity.slots - participants.length, 0)} available)
          </span>
          <span className="w">
            <b>Eligible colleges</b>
            {configuredColleges.length > 0 &&
            colleges.length === configuredColleges.length
              ? "All colleges"
              : colleges.join(", ") || "No active colleges selected"}
          </span>
        </div>
        <div className="tw participant-table">
          <table>
            <thead>
              <tr>
                <th>PARTICIPANT</th>
                <th>COLLEGE</th>
                <th>ATTENDANCE</th>
                <th>HOURS</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((e) => {
                const student = users.find((u) => u.id === e.userId);
                if (!student) return null;
                return (
                  <tr key={e.id}>
                    <td>
                      <strong>{fullName(student)}</strong>
                      <small>{student.idno}</small>
                    </td>
                    <td>{student.college}</td>
                    <td>
                      {e.verified
                        ? "Verified"
                        : e.attended
                          ? "Awaiting review"
                          : "Not logged"}
                    </td>
                    <td>
                      {e.attended ? `${e.hours} / ${activity.hours} h` : "—"}
                    </td>
                  </tr>
                );
              })}
              {!participants.length && (
                <Empty cols={4} text="No approved participants yet." />
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
