import { useState } from "react";
import { Hero, Panel } from "../../shared/appCommon.jsx";
import {
  Badge,
  activityStatus,
  eventPhase,
  fmtDate,
  fullName,
  periodLabel,
  registrationLabel,
  registrationState,
} from "../../utils/appUtils.jsx";
import { MemoLinks } from "../../components/common/MemoLinks.jsx";

const MONTHS = (() => {
  const now = new Date();
  return Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
      label: date.toLocaleString("en-US", { month: "short" }),
    };
  });
})();

const pct = (value, total) =>
  total ? Math.round((Number(value) / Number(total)) * 100) : 0;
const monthKey = (value) =>
  typeof value === "string" && value.length >= 7 ? value.slice(0, 7) : "";

function Highlight({ label, value, detail, tone = "mute", progress }) {
  return (
    <article className={`card ov-highlight ov-${tone}`}>
      <span className="ov-highlight-label">{label}</span>
      <strong className="ov-highlight-value">{value}</strong>
      <span className="ov-highlight-detail">{detail}</span>
      {progress !== undefined && (
        <div className="ov-progress" aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
        </div>
      )}
    </article>
  );
}

function Sparkline({ points }) {
  const max = Math.max(1, ...points.map((point) => point.hours));
  const coords = points
    .map(
      (point, index) =>
        `${(index / Math.max(1, points.length - 1)) * 100},${38 - (point.hours / max) * 32}`,
    )
    .join(" ");
  return (
    <svg
      className="ov-spark"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      role="img"
      aria-label="Verified service hours over the last six months"
    >
      <defs>
        <linearGradient id="ovSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--c)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--c)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" y1="38" x2="100" y2="38" className="ov-spark-base" />
      <polygon points={`0,40 ${coords} 100,40`} fill="url(#ovSparkFill)" />
      <polyline points={coords} className="ov-spark-line" />
      {points.map((point, index) => (
        <circle
          key={point.key}
          cx={(index / Math.max(1, points.length - 1)) * 100}
          cy={38 - (point.hours / max) * 32}
          r="1.6"
          className="ov-spark-dot"
        />
      ))}
    </svg>
  );
}

function FunnelRow({ label, value, max, tone }) {
  return (
    <div className="ov-funnel-row">
      <span className="ov-funnel-label">{label}</span>
      <div className="ov-funnel-track">
        <i
          className={`ov-funnel-fill ov-funnel-${tone}`}
          style={{ width: `${(value / max) * 100}%` }}
        />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

export function PendingActivityTable({
  list,
  users,
  onDecide,
  onToggleMandatory,
  clockNow,
}) {
  const [selected, setSelected] = useState(null);
  function owner(activity) {
    return users.find((user) => user.id === activity.by);
  }

  return (
    <div className="tw">
      <table>
        <thead>
          <tr>
            <th>ACTIVITY</th>
            <th>REQUESTED BY</th>
            <th>SCHEDULE</th>
            <th>HOURS / SLOTS</th>
            <th>DECISION</th>
          </tr>
        </thead>
        <tbody>
          {list.map((activity) => (
            <tr key={activity.id}>
              <td>
                <strong>{activity.title}</strong>
                <small>{activity.category}</small>
              </td>
              <td>
                {owner(activity)?.first || "—"} {owner(activity)?.last || ""}
                <small>{owner(activity)?.college}</small>
              </td>
              <td>
                {activity.date} · {activity.time}
                <small>{activity.location}</small>
              </td>
              <td>
                {activity.hours} h<small>{activity.slots} slots</small>
              </td>
              <td>
                <button type="button" className="tb" onClick={() => setSelected(activity)}>
                  View and review
                </button>
              </td>
            </tr>
          ))}
          {list.length === 0 && (
            <tr>
              <td colSpan={5} className="empty">
                No pending requests. You’re all caught up.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {selected && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelected(null);
        }}>
          <section className="card activity-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title">
            <div className="ph">
              <div><span className="eb">PENDING APPROVAL</span><h2 id="approval-title">{selected.title}</h2></div>
              <button type="button" className="tb" onClick={() => setSelected(null)}>Close</button>
            </div>
            <p className="modal-description">{selected.desc || "No event description was provided."}</p>
            <div className="detail-grid">
              <span><b>Category</b>{selected.category || "Not provided"}</span>
              <span><b>Academic period</b>{periodLabel(selected)}</span>
              <span><b>Requirement</b>{selected.mandatory ? <Badge s="Mandatory" /> : "Optional"}</span>
              <span><b>Current phase</b><Badge s={eventPhase(selected, clockNow)} /></span>
              <span><b>Pre-registration</b>{registrationLabel(selected)}</span>
              <span><b>Registration status</b>{registrationState(selected, clockNow).label}</span>
              <span><b>Requested by</b>{owner(selected) ? fullName(owner(selected)) : "Not available"}</span>
              <span><b>Office / college</b>{owner(selected)?.college || "Not available"}</span>
              <span><b>Contact email</b>{owner(selected)?.email || "Not available"}</span>
              <span><b>Date and time</b>{selected.date || "Date not set"} · {selected.time || "Time not set"}</span>
              <span><b>Location</b>{selected.location || "Not provided"}</span>
              <span><b>Service hours</b>{selected.hours ?? "Not provided"} hours</span>
              <span><b>Available slots</b>{selected.slots ?? "Not provided"}</span>
              <span className="w"><b>Eligible colleges</b>{selected.colleges?.length ? selected.colleges.join(", ") : "All eligible colleges"}</span>
            </div>
            <MemoLinks memo={selected.memo} />
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
              {onToggleMandatory && (
                <button type="button" className="tb" onClick={() => onToggleMandatory(selected)}>
                  {selected.mandatory ? "Make optional" : "Mark mandatory"}
                </button>
              )}
              <button type="button" className="btn out sm" onClick={() => { onDecide(selected.id, "Rejected"); setSelected(null); }}>Reject request</button>
              <button type="button" className="btn sm" onClick={() => { onDecide(selected.id, "Open"); setSelected(null); }}>Approve activity</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function SuperAdminHomePage({
  users,
  activities,
  enrollments = [],
  organizations = [],
  academicYears = [],
  pending,
  adminCount,
  studentCount,
  totalHours,
  onNavigate,
  onDecide,
  onToggleMandatory,
  clockNow,
}) {
  const activeYear = academicYears.find((year) => year.status === "Active");
  const verified = enrollments.filter((entry) => entry.attended && entry.verified);
  const studentsById = new Map(users.map((user) => [user.id, user]));
  const activeColleges = organizations.filter(
    (org) => org.type === "College" && org.status === "Active",
  );
  const staffedColleges = activeColleges.filter((org) =>
    users.some(
      (user) =>
        user.role === "Admin" &&
        user.status === "Active" &&
        user.college === org.name,
    ),
  );

  const mandatoryIds = new Set(
    activities.filter((activity) => activity.mandatory).map((activity) => activity.id),
  );
  const mandatoryEnrollments = enrollments.filter(
    (entry) =>
      mandatoryIds.has(entry.actId) && entry.status === "Accepted",
  );
  const mandatoryDone = mandatoryEnrollments.filter(
    (entry) => entry.attended && entry.verified,
  ).length;

  const pipeline = [
    { label: "Requested", value: activities.filter((a) => a.status === "Pending").length, tone: "muted" },
    {
      label: "Published",
      value: activities.filter((a) => ["Open", "Ongoing", "Completed"].includes(a.status)).length,
      tone: "gold",
    },
    {
      label: "Ongoing",
      value: activities.filter((a) => a.status === "Ongoing").length,
      tone: "gold",
    },
    {
      label: "Completed",
      value: activities.filter(
        (a) => a.status === "Completed" || activityStatus(a) === "Completed",
      ).length,
      tone: "ok",
    },
  ];
  const maxPipeline = Math.max(1, ...pipeline.map((step) => step.value));

  const trend = MONTHS.map((month) => ({
    ...month,
    hours: verified
      .filter(
        (entry) =>
          monthKey(entry.logDate || entry.verifiedAt || entry.submittedAt) === month.key,
      )
      .reduce((sum, entry) => sum + Number(entry.hours || 0), 0),
  }));
  const trendTotal = trend.reduce((sum, month) => sum + month.hours, 0);
  const maxHours = Math.max(1, ...trend.map((month) => month.hours));

  const hoursByCollege = new Map();
  verified.forEach((entry) => {
    const college = studentsById.get(entry.userId)?.college;
    if (!college) return;
    hoursByCollege.set(
      college,
      (hoursByCollege.get(college) || 0) + Number(entry.hours || 0),
    );
  });
  const collegeLeaders = [...hoursByCollege.entries()]
    .map(([name, hours]) => ({ name, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 5);
  const maxCollegeHours = Math.max(1, ...collegeLeaders.map((row) => row.hours));

  const recent = activities
    .slice()
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
    .slice(0, 5);

  return (
    <>
      <Hero
        title="Oversee every service, everywhere."
        text="Review activity requests, manage academic periods, and follow volunteer impact across WMSU from one place."
      >
        <div className="ov-hero-meta">
          <span className="ov-chip">
            {activeYear
              ? `${activeYear.year} · ${activeYear.semester}`
              : "No active academic period"}
          </span>
          <span className="ov-chip ov-chip-alert">
            {pending.length} awaiting review
          </span>
        </div>
        <div className="ov-hero-actions">
          <button type="button" className="btn sm" onClick={() => onNavigate("Approvals")}>
            Review requests
          </button>
          <button type="button" className="btn out sm" onClick={() => onNavigate("Reports & Analytics")}>
            Open analytics
          </button>
        </div>
      </Hero>

      <section className="ov-highlights" aria-label="Key highlights">
        <Highlight
          label="Pending approvals"
          value={pending.length}
          detail="Activity requests waiting for a decision"
          tone="rose"
        />
        <Highlight
          label="College coverage"
          value={`${staffedColleges.length}/${activeColleges.length}`}
          detail="Active colleges with an Admin account"
          tone="gold"
          progress={pct(staffedColleges.length, activeColleges.length)}
        />
        <Highlight
          label="Verified hours"
          value={totalHours}
          detail={`${verified.length} verified attendance records`}
          tone="ok"
        />
        <Highlight
          label="Mandatory completion"
          value={`${pct(mandatoryDone, mandatoryEnrollments.length)}%`}
          detail={`${mandatoryDone}/${mandatoryEnrollments.length} required activities completed`}
          tone="mute"
          progress={pct(mandatoryDone, mandatoryEnrollments.length)}
        />
      </section>

      <div className="ov-grid">
        <Panel
          eyebrow="ACTIVITY PIPELINE"
          title="From request to impact"
          sub="How activities move through review, publication and completion."
          className="ov-panel"
        >
          <div className="ov-funnel">
            {pipeline.map((step) => (
              <FunnelRow
                key={step.label}
                {...step}
                max={maxPipeline}
              />
            ))}
          </div>
          <div className="ov-funnel-foot">
            <span>
              <strong>{adminCount}</strong> Admin {adminCount === 1 ? "account" : "accounts"}
            </span>
            <span>
              <strong>{studentCount}</strong> registered students
            </span>
            <span>
              <strong>{activities.length}</strong> total activities
            </span>
          </div>
        </Panel>

        <Panel
          eyebrow="SERVICE HOURS"
          title="Verified hours trend"
          sub="Attendance verified by coordinators over the last six months."
          className="ov-panel"
          action={<span className="ov-trend-total">{trendTotal} h</span>}
        >
          <Sparkline points={trend} />
          <div className="ov-months">
            {trend.map((month) => (
              <span key={month.key}>{month.label}</span>
            ))}
          </div>
          <div className="ov-trend-list">
            {trend
              .slice()
              .reverse()
              .slice(0, 3)
              .map((month) => (
                <div key={month.key}>
                  <span>{month.label}</span>
                  <div className="ov-trend-bar">
                    <i style={{ width: `${(month.hours / maxHours) * 100}%` }} />
                  </div>
                  <strong>{month.hours} h</strong>
                </div>
              ))}
          </div>
        </Panel>
      </div>

      <div className="ov-grid">
        <Panel
          eyebrow="TOP OFFICES"
          title="Hours by college"
          sub="Colleges with the most verified volunteer hours."
          className="ov-panel"
        >
          <div className="ov-leaders">
            {collegeLeaders.map((row, index) => (
              <div className="ov-leader" key={row.name}>
                <span className="ov-leader-rank">{index + 1}</span>
                <div className="ov-leader-main">
                  <span>{row.name}</span>
                  <div className="ov-leader-track">
                    <i style={{ width: `${(row.hours / maxCollegeHours) * 100}%` }} />
                  </div>
                </div>
                <strong>{row.hours} h</strong>
              </div>
            ))}
            {collegeLeaders.length === 0 && (
              <p className="note">No verified hours recorded yet.</p>
            )}
          </div>
        </Panel>

        <Panel
          eyebrow="NEEDS YOUR ATTENTION"
          title="Awaiting approval"
          sub="New activity requests from campus offices."
          className="ov-panel"
          action={
            <button type="button" className="btn out sm" onClick={() => onNavigate("Approvals")}>
              Open approvals
            </button>
          }
        >
          <PendingActivityTable
            list={pending.slice(0, 3)}
            users={users}
            onDecide={onDecide}
            onToggleMandatory={onToggleMandatory}
            clockNow={clockNow}
          />
        </Panel>
      </div>

      <div className="ov-grid ov-grid-single">
        <Panel
          eyebrow="LATEST ACTIVITIES"
          title="Recently added"
          sub="The newest activities across all offices."
          className="ov-panel"
          action={
            <button type="button" className="tb" onClick={() => onNavigate("Monitoring")}>
              View all
            </button>
          }
        >
          <div className="ov-recent">
            {recent.map((activity) => (
              <div key={activity.id}>
                <div>
                  <strong>{activity.title}</strong>
                  <small>
                    {periodLabel(activity)} · {users.find((user) => user.id === activity.by)?.college || "Office not set"}
                  </small>
                </div>
                <span>{fmtDate(activity.date)}</span>
                <Badge s={activityStatus(activity)} />
              </div>
            ))}
            {recent.length === 0 && <p className="note">No activities have been added yet.</p>}
          </div>
        </Panel>
      </div>
    </>
  );
}
