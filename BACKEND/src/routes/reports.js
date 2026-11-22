import { Router } from "express";
import pool from "../db.js";
import {
  requireAuth,
  requirePasswordChangeComplete,
} from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";
import { reportQuerySchema, validateQuery } from "../validation.js";

const router = Router();
router.use(
  requireAuth,
  requirePasswordChangeComplete,
  requireRole("Super Admin"),
);

const CACHE_TTL_MS = 30_000;
const reportCache = new Map();

async function cachedReport(key, build) {
  const hit = reportCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS)
    return { ...hit.value, generatedAt: new Date().toISOString() };
  const value = await build();
  reportCache.set(key, { at: Date.now(), value });
  if (reportCache.size > 50) reportCache.delete(reportCache.keys().next().value);
  return value;
}

const cacheKey = (query, college) =>
  JSON.stringify({
    college: college || null,
    from: query.from || null,
    to: query.to || null,
    category: query.category || null,
    status: query.status || null,
    asOf: query.asOf || null,
    excludeTest: query.excludeTest !== "false",
  });

const TEST_PATTERN =
  /(^|[._-])(test|qa|probe|sample|demo)([._-]|$)|@example\.(com|org)$/i;

const isTestRecord = (data) =>
  TEST_PATTERN.test(
    [data?.email, data?.idno, data?.id, data?.first, data?.last]
      .filter(Boolean)
      .join(" "),
  );

const monthKey = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 7);
};

const activityDateKey = (activity) =>
  typeof activity?.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(activity.date)
    ? activity.date.slice(0, 10)
    : monthKey(activity?.date);

const derivedStatus = (activity, now = new Date()) => {
  const status = activity?.status || "Unknown";
  if (!["Open", "Ongoing"].includes(status)) return status;
  if (!activity?.date || !activity?.endTime) return status;
  const end = new Date(`${activity.date}T${activity.endTime}`);
  return !Number.isNaN(end.getTime()) && now >= end ? "Completed" : status;
};

const round = (value) => Math.round((Number(value) || 0) * 100) / 100;

async function loadCurrent(collection) {
  const result = await pool.query(
    "SELECT record_id, data, created_at FROM app_records WHERE collection = $1",
    [collection],
  );
  return result.rows.map((row) => ({
    id: row.record_id,
    data: row.data,
    createdAt: row.created_at,
  }));
}

async function loadCurrentUsers() {
  const result = await pool.query(
    `SELECT id, role, first, last, email, college, status, updated_at
       FROM portal_users`,
  );
  return result.rows.map((row) => ({
    id: String(row.id),
    data: {
      id: row.id,
      role: row.role,
      first: row.first,
      last: row.last,
      email: row.email,
      college: row.college,
      status: row.status,
    },
    createdAt: row.updated_at,
  }));
}

async function loadEvents() {
  const result = await pool.query(
    `SELECT collection, record_id, event_type, data, created_at
       FROM record_events ORDER BY created_at ASC, id ASC`,
  );
  return result.rows.map((row) => ({
    collection: row.collection,
    recordId: row.record_id,
    type: row.event_type,
    data: row.data,
    at: row.created_at,
  }));
}

async function historyStart() {
  const result = await pool.query(
    "SELECT applied_at FROM schema_migrations WHERE name = $1",
    ["004_reporting_history.sql"],
  );
  return result.rows[0]?.applied_at?.toISOString?.() || null;
}

function stateAt(events, collection, at) {
  const records = new Map();
  for (const event of events) {
    if (event.collection !== collection) continue;
    if (at && event.at > at) continue;
    if (event.type === "deleted") records.delete(event.recordId);
    else records.set(event.recordId, event.data);
  }
  return [...records.entries()].map(([id, data]) => ({ id, data }));
}

function latestAt(events, collection, id, at, fallback) {
  let latest = fallback || null;
  for (const event of events) {
    if (event.collection !== collection || event.recordId !== String(id))
      continue;
    if (at && event.at > at) break;
    if (event.type === "deleted") latest = null;
    else latest = event.data;
  }
  return latest;
}

function inRange(dateValue, from, to) {
  if (!dateValue) return true;
  const time = new Date(dateValue).getTime();
  if (Number.isNaN(time)) return true;
  if (from && time < from.getTime()) return false;
  if (to && time > to.getTime()) return false;
  return true;
}

function normalizeCollege(value, directory) {
  if (!value) return "Unassigned";
  return directory.get(String(value).toLowerCase()) || "Unassigned";
}

function normalizeColleges(values, directory) {
  const list = Array.isArray(values) ? values : values ? [values] : [];
  return [
    ...new Set(list.map((value) => normalizeCollege(value, directory))),
  ];
}

function normalizeCategory(value) {
  return value || "Uncategorized";
}

function matchesActivity(activity, filters) {
  if (filters.category && normalizeCategory(activity?.category) !== filters.category)
    return false;
  if (filters.status && derivedStatus(activity) !== filters.status) return false;
  return true;
}

function activityColleges(activity, directory, usersById) {
  if (activity?.college)
    return normalizeColleges(activity.college, directory);
  if (activity?.organization)
    return normalizeColleges(activity.organization, directory);
  if (Array.isArray(activity?.colleges) && activity.colleges.length)
    return normalizeColleges(activity.colleges, directory);
  const owner = usersById.get(String(activity?.by));
  if (owner?.college) return normalizeColleges(owner.college, directory);
  return ["Unassigned"];
}

function countBy(rows, keyFn) {
  const result = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    result.set(key, (result.get(key) || 0) + 1);
  }
  return [...result.entries()].map(([name, count]) => ({ name, count }));
}

function monthBuckets(events, from, to, valueFn) {
  const buckets = new Map();
  for (const event of events) {
    if (!inRange(event.at, from, to)) continue;
    const key = monthKey(event.at);
    if (!key) continue;
    if (!buckets.has(key))
      buckets.set(key, {
        month: key,
        requested: 0,
        accepted: 0,
        attended: 0,
        verified: 0,
        hours: 0,
      });
    const bucket = buckets.get(key);
    valueFn(bucket, event.data || {});
  }
  return [...buckets.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function emptyKpis() {
  return {
    students: 0,
    activeAdmins: 0,
    activities: 0,
    requested: 0,
    accepted: 0,
    attended: 0,
    verified: 0,
    submittedHours: 0,
    hours: 0,
    pending: 0,
    completionRate: 0,
  };
}

async function buildReport(query, forcedCollege) {
  const excludeTest = query.excludeTest !== "false";
  const from = query.from ? new Date(`${query.from}T00:00:00`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : null;
  const asOfRaw = query.asOf ? new Date(query.asOf) : null;
  const asOf = asOfRaw && !Number.isNaN(asOfRaw.getTime()) ? asOfRaw : null;
  const now = new Date();

  const [eventRows, currentActivities, currentEnrollments, currentUsers, orgRows] =
    await Promise.all([
      loadEvents(),
      loadCurrent("activities"),
      loadCurrent("enrollments"),
      loadCurrentUsers(),
      loadCurrent("organizations"),
    ]);

  const events = eventRows.map((event) => ({
    ...event,
    at: event.at instanceof Date ? event.at : new Date(event.at),
  }));
  const useEvents = Boolean(asOf && asOf < now);
  const activitiesSource = useEvents
    ? stateAt(events, "activities", asOf)
    : currentActivities;
  const enrollmentsSource = useEvents
    ? stateAt(events, "enrollments", asOf)
    : currentEnrollments;
  const usersSource = useEvents
    ? stateAt(events, "users", asOf)
    : currentUsers;

  // Case-insensitive canonical directory so "COLLEGE OF NURSING" and
  // "College of Nursing" map to the same report bucket.
  const collegeDirectory = new Map();
  for (const name of [
    ...orgRows
      .filter((org) => org.data?.type === "College" && org.data?.name)
      .map((org) => org.data.name),
    ...usersSource.map((user) => user.data?.college).filter(Boolean),
  ])
    collegeDirectory.set(String(name).toLowerCase(), name);
  collegeDirectory.delete("unassigned");

  const usersById = new Map(
    usersSource.map((user) => [String(user.id), user.data]),
  );

  const activities = activitiesSource
    .map(({ id, data }) => ({ id, ...data }))
    .filter((activity) => !excludeTest || !isTestRecord(activity))
    .filter((activity) => inRange(activityDateKey(activity), from, to))
    .filter((activity) => matchesActivity(activity, query))
    .map((activity) => {
      const colleges = activityColleges(activity, collegeDirectory, usersById);
      return {
        ...activity,
        colleges,
        college: colleges.join(", "),
        category: normalizeCategory(activity.category),
        effectiveStatus: derivedStatus(activity, useEvents ? asOf : now),
      };
    });

  const activityById = new Map(activities.map((activity) => [String(activity.id), activity]));
  const scopedActivities = forcedCollege
    ? activities.filter((activity) => activity.colleges.includes(forcedCollege))
    : activities;
  const scopedIds = new Set(scopedActivities.map((activity) => String(activity.id)));

  const enrollments = enrollmentsSource
    .map(({ id, data }) => ({ id, ...data }))
    .filter((enrollment) => !excludeTest || !isTestRecord(enrollment))
    .filter((enrollment) => scopedIds.has(String(enrollment.actId)));

  const users = usersSource
    .map(({ id, data }) => ({ id, ...data }))
    .filter((user) => !excludeTest || !isTestRecord(user));

  const kpis = emptyKpis();
  kpis.students = users.filter(
    (user) =>
      user.role === "User" &&
      user.status === "Active" &&
      (!forcedCollege || normalizeCollege(user.college, collegeDirectory) === forcedCollege),
  ).length;
  kpis.activeAdmins = users.filter(
    (user) =>
      ["Admin", "Super Admin"].includes(user.role) && user.status === "Active" &&
      (!forcedCollege || normalizeCollege(user.college, collegeDirectory) === forcedCollege),
  ).length;
  kpis.activities = scopedActivities.length;
  kpis.requested = enrollments.length;
  kpis.accepted = enrollments.filter((e) => e.status === "Accepted").length;
  kpis.pending = enrollments.filter((e) => e.status === "Pending").length;
  kpis.attended = enrollments.filter((e) => e.attended).length;
  kpis.verified = enrollments.filter((e) => e.attended && e.verified).length;
  kpis.submittedHours = round(
    enrollments
      .filter((e) => e.attended)
      .reduce((sum, e) => sum + Number(e.hours || 0), 0),
  );
  kpis.hours = round(
    enrollments
      .filter((e) => e.attended && e.verified)
      .reduce((sum, e) => sum + Number(e.hours || 0), 0),
  );
  kpis.completionRate = scopedActivities.length
    ? round(
        (scopedActivities.filter((a) => a.effectiveStatus === "Completed").length /
          scopedActivities.length) *
          100,
      )
    : 0;

  const activitiesByMonthMap = new Map();
  for (const activity of scopedActivities) {
    const key = activity.date?.slice?.(0, 7) || monthKey(activity.date);
    if (!key) continue;
    activitiesByMonthMap.set(key, (activitiesByMonthMap.get(key) || 0) + 1);
  }
  const activitiesByMonth = [...activitiesByMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  const enrollmentEvents = events.filter(
    (event) => event.collection === "enrollments" && event.type !== "deleted",
  );
  const activityEvents = events.filter((event) => event.collection === "activities");
  const userEvents = events.filter((event) => event.collection === "users");

  const resolvesToScope = (event) => {
    const enrollment = event.data || {};
    let activity = latestAt(activityEvents, "activities", enrollment.actId, event.at);
    if (!activity) activity = activityById.get(String(enrollment.actId));
    if (!activity) return null;
    const colleges = activityColleges(activity, collegeDirectory, usersById);
    const normalized = {
      ...activity,
      colleges,
      college: colleges.join(", "),
      category: normalizeCategory(activity.category),
      effectiveStatus: derivedStatus(activity, event.at),
    };
    if (forcedCollege && !colleges.includes(forcedCollege)) return null;
    if (query.category && normalized.category !== query.category) return null;
    if (query.status && normalized.effectiveStatus !== query.status) return null;
    if (!inRange(activityDateKey(activity), from, to)) return null;
    return normalized;
  };

  const scopedEnrollmentEvents = enrollmentEvents
    .map((event) => ({ event, activity: resolvesToScope(event) }))
    .filter((item) => item.activity);

  const createdEvents = scopedEnrollmentEvents.filter((item) =>
    ["created", "initial_snapshot"].includes(item.event.type),
  );
  const acceptedEvents = scopedEnrollmentEvents.filter(
    (item) =>
      (item.event.type === "status_changed" && item.event.data?.status === "Accepted") ||
      (item.event.type === "initial_snapshot" && item.event.data?.status === "Accepted"),
  );
  const attendedEvents = scopedEnrollmentEvents.filter(
    (item) =>
      (item.event.type === "attendance_changed" && item.event.data?.attended === true) ||
      (item.event.type === "initial_snapshot" && item.event.data?.attended === true),
  );
  const verifiedEvents = scopedEnrollmentEvents.filter(
    (item) =>
      (item.event.type === "attendance_changed" && item.event.data?.verified === true) ||
      (item.event.type === "initial_snapshot" && item.event.data?.verified === true),
  );

  const fillMonths = (series) => {
    const map = new Map(series.map((row) => [row.month, row]));
    const result = [];
    const start = activitiesByMonth[0]?.month;
    const end = activitiesByMonth.at(-1)?.month;
    if (!start || !end) return result;
    let cursor = new Date(`${start}-01T00:00:00Z`);
    const last = new Date(`${end}-01T00:00:00Z`);
    while (cursor <= last) {
      const key = cursor.toISOString().slice(0, 7);
      result.push(
        map.get(key) || {
          month: key,
          requested: 0,
          accepted: 0,
          attended: 0,
          verified: 0,
          hours: 0,
        },
      );
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    return result;
  };

  const addCount = (series, eventsForSeries, field) => {
    const map = new Map(series.map((row) => [row.month, row]));
    for (const { event } of eventsForSeries) {
      const key = monthKey(event.at);
      if (!key || !map.has(key)) continue;
      map.get(key)[field] += 1;
    }
    return [...map.values()];
  };

  let enrollmentsByMonth = monthBuckets(createdEvents.map((item) => item.event), from, to, () => {});
  enrollmentsByMonth = addCount(enrollmentsByMonth, createdEvents, "requested");
  enrollmentsByMonth = addCount(enrollmentsByMonth, acceptedEvents, "accepted");
  enrollmentsByMonth = addCount(enrollmentsByMonth, attendedEvents, "attended");
  enrollmentsByMonth = addCount(enrollmentsByMonth, verifiedEvents, "verified");
  enrollmentsByMonth = fillMonths(enrollmentsByMonth);

  const hoursByMonthMap = new Map();
  for (const { event, activity } of verifiedEvents) {
    const key = monthKey(event.at);
    if (!key) continue;
    hoursByMonthMap.set(
      key,
      (hoursByMonthMap.get(key) || 0) + Number(event.data?.hours || 0),
    );
  }
  const hoursByMonth = [...hoursByMonthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, hours]) => ({ month, hours: round(hours) }));
  for (const row of enrollmentsByMonth)
    row.hours = round(hoursByMonthMap.get(row.month) || 0);

  const pendingByMonth = [];
  if (activitiesByMonth.length) {
    const boundaries = activitiesByMonth.map(
      ({ month }) => new Date(`${month}-01T00:00:00Z`),
    );
    for (const boundary of boundaries) {
      const snapshot = stateAt(events, "enrollments", boundary);
      let count = 0;
      for (const enrollment of snapshot) {
        const activity = latestAt(activityEvents, "activities", enrollment.data?.actId, boundary);
        if (!activity) continue;
        const colleges = activityColleges(activity, collegeDirectory, usersById);
        if (forcedCollege && !colleges.includes(forcedCollege)) continue;
        if (query.category && normalizeCategory(activity.category) !== query.category) continue;
        if (enrollment.data?.status === "Pending") count += 1;
      }
      pendingByMonth.push({ month: boundary.toISOString().slice(0, 7), count });
    }
  }

  const byCategoryMap = new Map();
  for (const activity of scopedActivities) {
    const key = activity.category;
    if (!byCategoryMap.has(key))
      byCategoryMap.set(key, {
        name: key,
        activities: 0,
        participants: 0,
        hours: 0,
      });
    const row = byCategoryMap.get(key);
    row.activities += 1;
  }
  for (const enrollment of enrollments) {
    const activity = activityById.get(String(enrollment.actId));
    if (!activity || !enrollment.attended || !enrollment.verified) continue;
    const row = byCategoryMap.get(activity.category);
    if (!row) continue;
    row.participants += 1;
    row.hours = round(row.hours + Number(enrollment.hours || 0));
  }

  const byStatus = countBy(scopedActivities, (activity) => activity.effectiveStatus);

  const allCollegeRows = new Map();
  const ensureCollegeRow = (college) => {
    if (!allCollegeRows.has(college))
      allCollegeRows.set(college, {
        college,
        students: 0,
        activeAdmins: 0,
        activities: 0,
        requested: 0,
        accepted: 0,
        attended: 0,
        verified: 0,
        hours: 0,
      });
    return allCollegeRows.get(college);
  };

  for (const activity of scopedActivities) {
    for (const college of activity.colleges)
      ensureCollegeRow(college).activities += 1;
  }

  for (const user of users) {
    const college = normalizeCollege(user.college, collegeDirectory);
    if (!forcedCollege || college === forcedCollege) {
      const row = ensureCollegeRow(college);
      if (user.role === "User" && user.status === "Active") row.students += 1;
      if (
        ["Admin", "Super Admin"].includes(user.role) &&
        user.status === "Active"
      )
        row.activeAdmins += 1;
    }
  }

  for (const enrollment of enrollments) {
    const activity = activityById.get(String(enrollment.actId));
    if (!activity) continue;
    for (const college of activity.colleges) {
      const row = allCollegeRows.get(college);
      if (!row) continue;
      row.requested += 1;
      if (enrollment.status === "Accepted") row.accepted += 1;
      if (enrollment.attended) row.attended += 1;
      if (enrollment.attended && enrollment.verified) {
        row.verified += 1;
        row.hours = round(row.hours + Number(enrollment.hours || 0));
      }
    }
  }

  const byCollege = [...allCollegeRows.values()].sort(
    (a, b) => b.verified - a.verified || b.activities - a.activities,
  );

  const topActivities = scopedActivities
    .map((activity) => {
      const rows = enrollments.filter((e) => String(e.actId) === String(activity.id));
      const acceptedCount = rows.filter((e) => e.status === "Accepted").length;
      const verifiedCount = rows.filter((e) => e.attended && e.verified).length;
      return {
        id: activity.id,
        title: activity.title || "Untitled activity",
        college: activity.college,
        category: activity.category,
        date: activity.date,
        status: activity.effectiveStatus,
        slots: Number(activity.slots || 0),
        requested: rows.length,
        accepted: acceptedCount,
        attended: rows.filter((e) => e.attended).length,
        verified: verifiedCount,
        attendanceRate: acceptedCount
          ? round((verifiedCount / acceptedCount) * 100)
          : 0,
        hours: round(
          rows
            .filter((e) => e.attended && e.verified)
            .reduce((sum, e) => sum + Number(e.hours || 0), 0),
        ),
      };
    })
    .sort((a, b) => b.verified - a.verified || b.requested - a.requested)
    .slice(0, 25);

  const start = await historyStart();
  const notes = [
    "Hours count only attendance that an Admin has verified.",
    `Event history tracking started ${start ? new Date(start).toLocaleString() : "recently"}; earlier transitions cannot be reconstructed. Existing records contribute their initial state at that time.`,
  ];
  if (excludeTest)
    notes.push("Likely test/probe accounts are excluded. Use excludeTest=false to include them.");
  if (asOf)
    notes.push(`Figures are reconstructed as of ${asOf.toISOString()}.`);

  return {
    success: true,
    generatedAt: now.toISOString(),
    asOf: asOf ? asOf.toISOString() : null,
    historyStart: start,
    college: forcedCollege || null,
    filters: {
      from: query.from || null,
      to: query.to || null,
      category: query.category || null,
      status: query.status || null,
      college: forcedCollege || query.college || null,
      excludeTest,
    },
    kpis,
    series: { activitiesByMonth, enrollmentsByMonth, hoursByMonth, pendingByMonth },
    breakdowns: { byCategory: [...byCategoryMap.values()], byStatus, byCollege },
    topActivities,
    notes,
  };
}

router.get("/overview", validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const college = req.reportQuery.college || null;
    const result = await cachedReport(cacheKey(req.reportQuery, college), () =>
      buildReport(req.reportQuery, college),
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/colleges", validateQuery(reportQuerySchema), async (req, res, next) => {
  try {
    const report = await cachedReport(cacheKey(req.reportQuery, "leaderboard"), () =>
      buildReport(req.reportQuery, null),
    );
    res.json({
      success: true,
      generatedAt: report.generatedAt,
      historyStart: report.historyStart,
      colleges: report.breakdowns.byCollege,
      notes: report.notes,
    });
  } catch (error) {
    next(error);
  }
});

router.get(
  "/colleges/:college",
  validateQuery(reportQuerySchema),
  async (req, res, next) => {
    try {
      const college = decodeURIComponent(req.params.college);
      const result = await cachedReport(cacheKey(req.reportQuery, college), () =>
        buildReport(req.reportQuery, college),
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

export default router;
