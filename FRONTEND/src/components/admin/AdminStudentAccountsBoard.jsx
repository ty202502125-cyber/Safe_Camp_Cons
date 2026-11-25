import { useState } from "react";
import {
  Empty,
  IMG,
  displayName,
  hoursOf,
  initials,
} from "../../shared/appCommon.jsx";

const FILTERS = ["All", "Active", "Inactive"];

export default function AdminStudentAccountsBoard({
  students,
  enrollments,
  choice,
  onChoose,
  onToggle,
  onDelete,
  onCancelChoice,
  onSelectStudent,
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

  const rows = students.map((student) => {
    const mine = enrollments.filter((e) => e.userId === student.id);
    const accepted = mine.filter((e) => e.status === "Accepted");
    const verified = accepted.filter((e) => e.attended && e.verified);
    return {
      student,
      accepted: accepted.length,
      verified: verified.length,
      pending: mine.filter((e) => e.status === "Pending").length,
      hours: hoursOf(enrollments, student.id),
    };
  });

  const visible = rows.filter(({ student }) => {
    if (filter !== "All" && student.status !== filter) return false;
    if (!query.trim()) return true;
    return [displayName(student), student.idno, student.email, student.college]
      .join(" ")
      .toLowerCase()
      .includes(query.trim().toLowerCase());
  });

  const activeCount = rows.filter(({ student }) => student.status === "Active").length;
  const inactiveCount = rows.length - activeCount;
  const acceptedTotal = rows.reduce((sum, row) => sum + row.accepted, 0);
  const hoursTotal = rows.reduce((sum, row) => sum + row.hours, 0);

  const stats = [
    { label: "Students", value: rows.length, key: "total" },
    { label: "Active", value: activeCount, key: "active" },
    { label: "Inactive", value: inactiveCount, key: "inactive" },
    { label: "Accepted activities", value: acceptedTotal, key: "accepted" },
    { label: "Hours logged", value: hoursTotal, key: "hours" },
  ];

  return (
    <>
      <div className="reg-stats student-account-stats">
        {stats.map((item) => (
          <div className={`reg-stat ${item.key}`} key={item.key}>
            <b>{item.value}</b>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="reg-toolbar student-account-toolbar">
        <div className="reg-search">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, ID or email"
            aria-label="Search student accounts"
          />
          {query && (
            <button
              type="button"
              className="reg-search-clear"
              aria-label="Clear search"
              onClick={() => setQuery("")}
            >
              ×
            </button>
          )}
        </div>
        <div className="reg-filters" role="group" aria-label="Filter accounts">
          {FILTERS.map((status) => (
            <button
              type="button"
              key={status}
              className={`reg-filter ${filter === status ? "on" : ""}`}
              onClick={() => setFilter(status)}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {visible.length ? (
        <div className="student-account-grid">
          {visible.map(({ student, accepted, verified, pending, hours }) => {
            const isActive = student.status === "Active";
            const confirming = choice === student.id;
            const fill = accepted
              ? Math.min(100, Math.round((verified / accepted) * 100))
              : 0;

            return (
              <article className="student-account-card" key={student.id}>
                <button
                  type="button"
                  className="student-account-cover"
                  style={{
                    backgroundImage: `url(${student.coverData || IMG.campus})`,
                  }}
                  title="View student profile"
                  aria-label={`View ${displayName(student)} profile`}
                  onClick={() =>
                    onSelectStudent({ student, enrollment: null })
                  }
                >
                  <span className="student-account-cover-badges">
                    <span className={`bd ${isActive ? "ok" : "no"}`}>
                      {student.status}
                    </span>
                  </span>
                  <span className="student-account-cover-hint">View profile</span>
                </button>

                <div className="student-account-body">
                  <div className="student-account-top">
                    <button
                      type="button"
                      className="student-account-person"
                      title="View student details"
                      onClick={() =>
                        onSelectStudent({ student, enrollment: null })
                      }
                    >
                      <span className="student-account-avatar">
                        {student.avatarData ? (
                          <img src={student.avatarData} alt="" />
                        ) : (
                          initials(student)
                        )}
                      </span>
                      <span>
                        <strong>{displayName(student)}</strong>
                        <small>{student.email}</small>
                      </span>
                    </button>
                  </div>

                  <div className="student-account-meta">
                    <span>
                      <b>ID</b> {student.idno}
                    </span>
                    <span>
                      <b>College</b> {student.college}
                    </span>
                  </div>

                  <div className="student-account-progress">
                    <div
                      role="progressbar"
                      aria-label={`${verified} of ${accepted} activities verified`}
                      aria-valuenow={verified}
                      aria-valuemin={0}
                      aria-valuemax={accepted}
                    >
                      <span style={{ width: `${fill}%` }} />
                    </div>
                    <div className="student-account-count">
                      <b>
                        {verified} / {accepted}
                      </b>
                      <span>verified activities</span>
                    </div>
                  </div>

                  <div className="student-account-counts">
                    <span>
                      <b>{hours}</b> hours
                    </span>
                    <span>
                      <b>{pending}</b> pending
                    </span>
                    <span>
                      <b>{accepted}</b> accepted
                    </span>
                  </div>

                  <div className="student-account-actions">
                    <button
                      type="button"
                      className="tb"
                      onClick={() =>
                        onSelectStudent({ student, enrollment: null })
                      }
                    >
                      Details
                    </button>
                    {isActive && !confirming && (
                      <button
                        type="button"
                        className="tb"
                        onClick={() => onChoose(student.id)}
                      >
                        Deactivate
                      </button>
                    )}
                    {!isActive && (
                      <button
                        type="button"
                        className="tb"
                        onClick={() => onToggle(student.id)}
                      >
                        Activate
                      </button>
                    )}
                    {isActive && confirming && (
                      <>
                        <button
                          type="button"
                          className="tb"
                          onClick={() => onToggle(student.id)}
                        >
                          Confirm deactivate
                        </button>
                        <button
                          type="button"
                          className="tb bad"
                          onClick={() => onDelete(student.id)}
                        >
                          Delete instead
                        </button>
                        <button
                          type="button"
                          className="tb"
                          onClick={onCancelChoice}
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          cols={6}
          text={
            students.length
              ? "No student accounts match your search."
              : "No student accounts are assigned to your college."
          }
        />
      )}
    </>
  );
}
