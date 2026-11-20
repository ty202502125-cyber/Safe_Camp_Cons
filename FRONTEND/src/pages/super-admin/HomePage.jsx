import { useState } from "react";
import { Gallery, Hero, Panel, Stat } from "../../shared/appCommon.jsx";
import { fullName } from "../../utils/appUtils.jsx";

export function PendingActivityTable({ list, users, onDecide }) {
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
              <span><b>Requested by</b>{owner(selected) ? fullName(owner(selected)) : "Not available"}</span>
              <span><b>Office / college</b>{owner(selected)?.college || "Not available"}</span>
              <span><b>Contact email</b>{owner(selected)?.email || "Not available"}</span>
              <span><b>Date and time</b>{selected.date || "Date not set"} · {selected.time || "Time not set"}</span>
              <span><b>Location</b>{selected.location || "Not provided"}</span>
              <span><b>Service hours</b>{selected.hours ?? "Not provided"} hours</span>
              <span><b>Available slots</b>{selected.slots ?? "Not provided"}</span>
              <span className="w"><b>Eligible colleges</b>{selected.colleges?.length ? selected.colleges.join(", ") : "All eligible colleges"}</span>
            </div>
            <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
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
  pending,
  adminCount,
  studentCount,
  totalHours,
  onNavigate,
  onDecide,
}) {
  const statuses = ["Open", "Ongoing", "Completed", "Pending", "Rejected"];

  return (
    <>
      <Hero
        title="Oversee every service, everywhere."
        text="Review activity requests from campus offices, create Admin accounts, and monitor volunteer engagement across WMSU."
      />
      <section className="stats">
        <Stat
          label="Pending approvals"
          value={pending.length}
          detail="Activity requests to review"
        />
        <Stat
          label="Admin accounts"
          value={adminCount}
          detail="Campus offices"
        />
        <Stat
          label="Students"
          value={studentCount}
          detail="Registered volunteers"
        />
        <Stat
          label="Logged hours"
          value={totalHours}
          detail="Across all activities"
        />
      </section>
      <Gallery />
      <div className="two">
        <Panel
          eyebrow="NEEDS YOUR ATTENTION"
          title="Awaiting approval"
          action={
            <button
              type="button"
              className="btn out sm"
              onClick={() => onNavigate("Approvals")}
            >
              Open approvals
            </button>
          }
        >
          <PendingActivityTable
            list={pending.slice(0, 3)}
            users={users}
            onDecide={onDecide}
          />
        </Panel>
        <Panel eyebrow="ACTIVITY STATUS" title="Programs at a glance">
          <div className="bars">
            {statuses.map((status) => {
              const count = activities.filter(
                (activity) => activity.status === status,
              ).length;
              const percent = activities.length
                ? (count / activities.length) * 100
                : 0;

              return (
                <div key={status}>
                  <div className="row">
                    <span>{status}</span>
                    <b>{count}</b>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </>
  );
}
