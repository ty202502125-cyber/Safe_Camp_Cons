export const nid = (list) => Math.max(0, ...list.map((x) => x.id)) + 1;
export const fullName = (u) =>
  `${u.first} ${u.mi ? u.mi.toUpperCase() + ". " : ""}${u.last}`;
export const displayName = (u) =>
  u?.nickname ? `${fullName(u)} (${u.nickname})` : fullName(u);
export const initials = (u) => (u.first[0] + u.last[0]).toUpperCase();
export const fmtDate = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
export const fmtTime = (t) => {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
export const timeRange = (a) =>
  a.time
    ? a.endTime
      ? `${fmtTime(a.time)} – ${fmtTime(a.endTime)}`
      : fmtTime(a.time)
    : "";
export const calcHours = (s, e) => {
  if (!s || !e) return 0;
  const [h1, m1] = s.split(":").map(Number),
    [h2, m2] = e.split(":").map(Number);
  const mins = h2 * 60 + m2 - (h1 * 60 + m1);
  return mins > 0 ? Math.max(0.5, Math.round(mins / 30) / 2) : 0;
};
export function compressActivityImage(file) {
  return new Promise((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      try {
        const scale = Math.min(1, 1100 / image.width, 850 / image.height);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Could not process that image.");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.72);
        if (compressed.length > 700_000)
          throw new Error(
            "That image is still too large after compression. Choose a smaller image.",
          );
        resolve(compressed);
      } catch (error) {
        reject(error);
      } finally {
        URL.revokeObjectURL(source);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(source);
      reject(new Error("That image could not be opened."));
    };
    image.src = source;
  });
}
export const dateKey = (date = new Date()) => {
  const value = date instanceof Date ? date : new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
export const addDays = (key, days) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || "")) return "";
  const [year, month, day] = key.split("-").map(Number);
  return dateKey(new Date(year, month - 1, day + days));
};
export const hasActivityEnded = (a, now = new Date()) => {
  if (!a?.date || !a.time || !a.endTime) return false;
  return now >= new Date(`${a.date}T${a.endTime}`);
};
export const activityStatus = (a, now = new Date()) =>
  a && ["Open", "Ongoing"].includes(a.status) && hasActivityEnded(a, now)
    ? "Completed"
    : a?.status;
export const registrationState = (activity, now = new Date()) => {
  const today = dateKey(now);
  if (!activity) return { open: false, label: "Unavailable" };
  if (activity.status !== "Open")
    return {
      open: false,
      label: activity.status === "Pending" ? "Awaiting approval" : "Closed",
    };
  if (!activity.registrationStart || !activity.registrationEnd)
    return { open: false, label: "Registration not scheduled" };
  if (today < activity.registrationStart)
    return { open: false, label: `Opens ${fmtDate(activity.registrationStart)}` };
  if (today > activity.registrationEnd)
    return { open: false, label: "Pre-registration closed" };
  if (activity.date && today >= activity.date)
    return { open: false, label: "Registration closed on event day" };
  if (hasActivityEnded(activity, now))
    return { open: false, label: "Event completed" };
  return { open: true, label: "Pre-registration open" };
};
export const isRegistrationOpen = (activity, now = new Date()) =>
  registrationState(activity, now).open;
export const eventPhase = (activity, now = new Date()) => {
  const status = activityStatus(activity, now);
  if (status === "Completed") return "Completed";
  if (status === "Ongoing" || (activity?.date && dateKey(now) === activity.date))
    return "Event day";
  const registration = registrationState(activity, now);
  return registration.open ? "Pre-registration" : "Registration closed";
};
export const registrationLabel = (activity) =>
  activity?.registrationStart && activity?.registrationEnd
    ? `${fmtDate(activity.registrationStart)} – ${fmtDate(activity.registrationEnd)}`
    : "Not scheduled";
export const BCLS = {
  Active: "ok",
  Archived: "gold",
  Open: "ok",
  Accepted: "ok",
  Completed: "ok",
  Verified: "ok",
  Ongoing: "gold",
  Pending: "gold",
  Mandatory: "mand",
  "Pre-registration": "gold",
  "Event day": "ok",
  "Registration closed": "no",
  Logged: "gold",
  Rejected: "no",
  Declined: "no",
};
export const Badge = ({ s }) => (
  <span className={`bd ${BCLS[s] || ""}`}>{s}</span>
);
export const accepted = (enr, a) =>
  enr.filter((e) => e.actId === a.id && e.status === "Accepted").length;

export const activeAcademicYear = (years = []) =>
  years.find((year) => year.status === "Active") || null;

export const isArchivedActivity = (activity, years = []) =>
  Boolean(
    activity?.schoolYear &&
      years.some(
        (year) =>
          year.year === activity.schoolYear && year.status === "Archived",
      ),
  );

export const periodLabel = (activity) =>
  activity?.schoolYear
    ? `${activity.schoolYear} · ${activity.semester || "Semester not set"}`
    : "Period not set";
export const hoursOf = (enr, uid) =>
  enr
    .filter((e) => e.userId === uid && e.attended)
    .reduce((s, e) => s + Number(e.hours || 0), 0);
export const collegeHasActiveAdmin = (college, users, organizations) =>
  organizations.some(
    (org) =>
      org.name === college && org.type === "College" && org.status === "Active",
  ) &&
  users.some(
    (user) =>
      user.role === "Admin" &&
      user.status === "Active" &&
      user.college === college,
  );
