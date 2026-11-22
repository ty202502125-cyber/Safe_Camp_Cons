import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge, CATEGORIES, Empty, Panel } from "../../shared/appCommon.jsx";
import { reportApi } from "../../services/api.js";

const EMPTY_FILTERS = {
  from: "",
  to: "",
  category: "",
  status: "",
  semester: "",
  schoolYear: "",
  asOf: "",
  excludeTest: true,
};
const SEMESTER_OPTIONS = ["1st Semester", "2nd Semester"];
const CURRENT_YEAR = new Date().getUTCFullYear();
const DEFAULT_SCHOOL_YEARS = Array.from({ length: 7 }, (_, index) => {
  const first = CURRENT_YEAR - 4 + index;
  return `${first}-${String(first + 1).slice(-2)}`;
});
const CATEGORY_OPTIONS = [...CATEGORIES, "Uncategorized"];
const STATUS_OPTIONS = [
  "Open",
  "Ongoing",
  "Completed",
  "Pending",
  "Rejected",
  "Unknown",
];
const SERIES_COLORS = {
  requested: "#87666e",
  accepted: "#d7193f",
  attended: "#8d5b08",
  verified: "#177b4b",
};
const PIE_COLORS = [
  "#b5122b",
  "#d7193f",
  "#8d5b08",
  "#177b4b",
  "#87666e",
  "#4d0612",
];

const asArray = (value) => (Array.isArray(value) ? value : []);
const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const fmt = (value) =>
  num(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
const pct = (value, total) =>
  num(total) > 0 ? Math.min(100, (num(value) / num(total)) * 100) : 0;
const toIso = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};
const displayDate = (value) => (value ? String(value).slice(0, 10) : "—");
const displayMoment = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};
const scopeSlug = (value) =>
  (value || "university")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "university";

function csvCell(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(rows, filename) {
  // Export the full filtered array returned by the API, not just visible rows.
  const list = asArray(rows);
  const headers = [...new Set(list.flatMap((row) => Object.keys(row || {})))];
  const body = [
    headers.map(csvCell).join(","),
    ...list.map((row) => headers.map((key) => csvCell(row?.[key])).join(",")),
  ].join("\r\n");
  const blob = new Blob([`\uFEFF${body}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function ChartEmpty({ text = "No data for the selected filters." }) {
  return <div className="report-empty">{text}</div>;
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="report-tip">
      {label != null && label !== "" && <strong>{label}</strong>}
      {payload.map((entry, index) => (
        <div className="report-tip-row" key={`${entry.dataKey ?? index}-${entry.name ?? ""}`}>
          <span>
            <i style={{ background: entry.color || entry.fill || "var(--c)" }} />
            {entry.name || entry.dataKey}
          </span>
          <b>{fmt(entry.value)}</b>
        </div>
      ))}
    </div>
  );
}

function MiniBar({ value, max = 100, tone = "" }) {
  const width = num(max) > 0 ? Math.max(0, Math.min(100, (num(value) / num(max)) * 100)) : 0;
  return (
    <span className={`report-mini-bar${tone ? ` ${tone}` : ""}`} aria-hidden="true">
      <span style={{ width: `${width}%` }} />
    </span>
  );
}

function ExportButton({ rows, filename, label = "Export CSV" }) {
  return (
    <button
      type="button"
      className="btn out sm"
      disabled={!asArray(rows).length}
      onClick={() => downloadCsv(rows, filename)}
    >
      {label}
    </button>
  );
}

function OptionList({ values, selected }) {
  return (
    <>
      {values.map((value) => (
        <option key={value} value={value}>
          {value}
        </option>
      ))}
      {selected && !values.includes(selected) && (
        <option value={selected}>{selected}</option>
      )}
    </>
  );
}

export default function ReportsPage({ startCollege, onBack, academicYears = [] }) {
  const [draft, setDraft] = useState({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState({ ...EMPTY_FILTERS });
  const [college, setCollege] = useState(startCollege || "");
  const [report, setReport] = useState(null);
  const [colleges, setColleges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [collegeError, setCollegeError] = useState("");
  const latestReportRequest = useRef(0);
  const latestCollegeRequest = useRef(0);

  // Keep drill-in state internal, but honour a parent that changes startCollege.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) setCollege(startCollege || "");
    });
    return () => {
      cancelled = true;
    };
  }, [startCollege]);

  const apiFilters = useMemo(
    () => ({
      from: applied.from,
      to: applied.to,
      category: applied.category,
      status: applied.status,
      semester: applied.semester,
      schoolYear: applied.schoolYear,
      asOf: toIso(applied.asOf),
      excludeTest: applied.excludeTest,
    }),
    [applied],
  );

  const loadReport = useCallback(async () => {
    const id = ++latestReportRequest.current;
    setRefreshing(true);
    setError("");
    try {
      const result = college
        ? await reportApi.college(college, apiFilters)
        : await reportApi.overview(apiFilters);
      if (id !== latestReportRequest.current) return;
      if (!result || result.success === false)
        throw new Error(result?.error || "The report could not be generated.");
      setReport(result);
    } catch (err) {
      if (id !== latestReportRequest.current) return;
      setError(err.message || "The report could not be loaded.");
    } finally {
      if (id === latestReportRequest.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [apiFilters, college]);

  const loadColleges = useCallback(async () => {
    const id = ++latestCollegeRequest.current;
    setCollegeError("");
    try {
      const result = await reportApi.colleges(apiFilters);
      if (id !== latestCollegeRequest.current) return;
      setColleges(asArray(result?.colleges));
    } catch (err) {
      if (id !== latestCollegeRequest.current) return;
      setCollegeError(err.message || "Could not load the college list.");
    }
  }, [apiFilters]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      void loadReport();
      void loadColleges();
    });
    return () => {
      cancelled = true;
    };
  }, [loadReport, loadColleges]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadReport();
      loadColleges();
    }, 60000);
    return () => window.clearInterval(timer);
  }, [loadReport, loadColleges]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    setApplied({ ...draft });
  }

  function drillInto(name) {
    if (name) setCollege(name);
  }

  function backToUniversity() {
    setCollege("");
    if (onBack) onBack();
  }

  const kpis = report?.kpis || {};
  const topActivities = asArray(report?.topActivities);
  const byCollege = asArray(report?.breakdowns?.byCollege);
  const byCategory = asArray(report?.breakdowns?.byCategory);
  const byStatus = asArray(report?.breakdowns?.byStatus);
  const bySemester = asArray(report?.breakdowns?.bySemester);
  const bySchoolYear = asArray(report?.breakdowns?.bySchoolYear);
  const activitiesByMonth = asArray(report?.series?.activitiesByMonth);
  const enrollmentsByMonth = asArray(report?.series?.enrollmentsByMonth);
  const hoursByMonth = asArray(report?.series?.hoursByMonth);
  const notes = asArray(report?.notes);
  const scope = college || "University-wide";
  const fileScope = scopeSlug(college);
  const statusTotal = byStatus.reduce((sum, row) => sum + num(row.count), 0);
  const statusData = byStatus.filter((row) => num(row.count) > 0);
  const activeFilterCount = Object.entries(applied).filter(([key, value]) =>
    key === "excludeTest" ? value !== true : Boolean(value),
  ).length;
  const coverage = pct(kpis.hours, kpis.submittedHours);
  const maxCollegeHours = Math.max(1, ...byCollege.map((row) => num(row.hours)));
  const maxCategoryActivities = Math.max(
    1,
    ...byCategory.map((row) => num(row.activities)),
  );
  const maxPeriodActivities = Math.max(
    1,
    ...[...bySemester, ...bySchoolYear].map((row) => num(row.count)),
  );

  const schoolYearOptions = [
    ...new Set([
      ...DEFAULT_SCHOOL_YEARS,
      ...academicYears.map((year) => year.year),
      ...bySchoolYear.map((row) => row.name),
    ]),
  ].sort((a, b) => b.localeCompare(a));

  function clearFilters() {
    setDraft({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
  }

  const kpiCards = [
    { label: "Students", value: fmt(kpis.students), hint: "Active registered students", tone: "rose" },
    { label: "Active admins", value: fmt(kpis.activeAdmins), hint: "Admin / Super Admin accounts", tone: "rose" },
    { label: "Activities", value: fmt(kpis.activities), hint: "Within the selected filters", tone: "rose" },
    {
      label: "Requested",
      value: fmt(kpis.requested),
      hint: "Enrollment requests",
      tone: "rose",
      progress: num(kpis.requested) > 0 ? 100 : 0,
    },
    {
      label: "Accepted",
      value: fmt(kpis.accepted),
      hint: "Approved enrollments",
      tone: "gold",
      progress: pct(kpis.accepted, kpis.requested),
    },
    {
      label: "Attended",
      value: fmt(kpis.attended),
      hint: "Marked as attended",
      tone: "gold",
      progress: pct(kpis.attended, kpis.requested),
    },
    {
      label: "Verified",
      value: fmt(kpis.verified),
      hint: "Admin-verified attendance",
      tone: "ok",
      feature: true,
      progress: pct(kpis.verified, kpis.requested),
    },
    {
      label: "Verified hours",
      value: fmt(kpis.hours),
      hint: `Hours = verified only · submitted ${fmt(kpis.submittedHours)}`,
      tone: "ok",
    },
    { label: "Pending", value: fmt(kpis.pending), hint: "Awaiting an admin decision", tone: "muted" },
    {
      label: "Completion rate",
      value: `${fmt(kpis.completionRate)}%`,
      hint: "Completed / activities",
      tone: "ok",
    },
  ];

  return (
    <>
      <Panel
        eyebrow="REPORTS & ANALYTICS"
        title="Volunteer impact report"
        sub="Filter the data, then open a college from the leaderboard to drill in. Reports refresh automatically every 60 seconds."
        action={
          <div className="report-scope-inline">
            <label>
              College
              <select
                value={college}
                onChange={(event) => drillInto(event.target.value)}
                disabled={Boolean(collegeError)}
              >
                <option value="">All colleges (university)</option>
                {colleges.map((row) => (
                  <option key={row.college} value={row.college}>
                    {row.college}
                  </option>
                ))}
              </select>
            </label>
            {college && (
              <button
                type="button"
                className="btn out sm"
                onClick={backToUniversity}
              >
                Back to university
              </button>
            )}
          </div>
        }
      >
        <form className="form report-filters" onSubmit={applyFilters}>
          <label>
            From
            <input
              type="date"
              value={draft.from}
              onChange={(event) => updateDraft("from", event.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={draft.to}
              onChange={(event) => updateDraft("to", event.target.value)}
            />
          </label>
          <label>
            Category
            <select
              value={draft.category}
              onChange={(event) => updateDraft("category", event.target.value)}
            >
              <option value="">All categories</option>
              <OptionList values={CATEGORY_OPTIONS} selected={draft.category} />
            </select>
          </label>
          <label>
            Status
            <select
              value={draft.status}
              onChange={(event) => updateDraft("status", event.target.value)}
            >
              <option value="">All statuses</option>
              <OptionList values={STATUS_OPTIONS} selected={draft.status} />
            </select>
          </label>
          <label>
            Semester
            <select
              value={draft.semester}
              onChange={(event) => updateDraft("semester", event.target.value)}
            >
              <option value="">All semesters</option>
              <OptionList values={SEMESTER_OPTIONS} selected={draft.semester} />
            </select>
          </label>
          <label>
            School year
            <select
              value={draft.schoolYear}
              onChange={(event) => updateDraft("schoolYear", event.target.value)}
            >
              <option value="">All school years</option>
              <OptionList values={schoolYearOptions} selected={draft.schoolYear} />
            </select>
          </label>
          <label>
            As of (optional)
            <input
              type="datetime-local"
              value={draft.asOf}
              onChange={(event) => updateDraft("asOf", event.target.value)}
            />
          </label>
          <label className="report-check">
            <input
              type="checkbox"
              checked={draft.excludeTest}
              onChange={(event) =>
                updateDraft("excludeTest", event.target.checked)
              }
            />
            Exclude test records
          </label>
          <div className="report-filter-actions">
            <button className="btn sm" type="submit" disabled={refreshing}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              className="btn out sm"
              type="button"
              disabled={!activeFilterCount}
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        </form>
        {collegeError && (
          <p className="err">College list unavailable: {collegeError}</p>
        )}
        <div className="report-meta">
          <strong>Scope: {scope}</strong>
          <span>Generated {displayMoment(report?.generatedAt)}</span>
          {report?.asOf && <span>As of {displayMoment(report.asOf)}</span>}
          {activeFilterCount > 0 && (
            <span className="bd">
              {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"} active
            </span>
          )}
          {refreshing && (
            <span className="bd gold" aria-live="polite">
              Refreshing…
            </span>
          )}
        </div>
      </Panel>

      {error && (
        <Panel
          eyebrow="REQUEST FAILED"
          title="Report unavailable"
          sub="The figures below were not updated. Check your session and try again."
        >
          <p className="err">{error}</p>
          <button type="button" className="btn sm" onClick={loadReport}>
            Try again
          </button>
        </Panel>
      )}

      {!error && !report && loading && (
        <Panel
          eyebrow="REPORTS"
          title="Loading report…"
          sub="Aggregating activities, enrollments and verified hours."
        >
          <p className="sub">Please wait…</p>
        </Panel>
      )}

      {!error && report && (
        <>
          <div className="stats report-stats">
            {kpiCards.map((card) => (
              <div
                className={`card stat report-stat report-stat--${card.tone}${
                  card.feature ? " report-stat--feature" : ""
                }`}
                key={card.label}
              >
                <span className="st">
                  <i className="report-dot" />
                  {card.label}
                </span>
                <div className="sv">{card.value}</div>
                <small className="sd">{card.hint}</small>
                {card.progress != null && (
                  <MiniBar value={card.progress} max={100} />
                )}
              </div>
            ))}
          </div>

          <Panel
            className="report-notes-panel"
            eyebrow="REPORT NOTES"
            title="How to read these figures"
            sub="Disclosures supplied by the report, including history limits and verified-hours rules."
          >
            <ul className="report-notes">
              {notes.length ? (
                notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)
              ) : (
                <li>No additional notes were supplied for this report.</li>
              )}
            </ul>
          </Panel>

          <div className="report-grid">
            <Panel
              className="report-span-2"
              eyebrow="ENROLLMENT FUNNEL"
              title="Enrollment activity by month"
              sub="Requests, approvals, attendance and verification."
            >
              {enrollmentsByMonth.length ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={enrollmentsByMonth}
                      margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="currentColor" strokeOpacity={0.25} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickFormatter={(value) => String(value).slice(2)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        formatter={(value) =>
                          String(value).charAt(0).toUpperCase() + String(value).slice(1)
                        }
                        wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                      />
                      {Object.entries(SERIES_COLORS).map(([key, color]) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          name={key[0].toUpperCase() + key.slice(1)}
                          stroke={color}
                          strokeWidth={2}
                          dot={false}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty />
              )}
            </Panel>

            <Panel
              eyebrow="ACTIVITY VOLUME"
              title="Activities by month"
              sub="Activities whose date falls in the selected period."
            >
              {activitiesByMonth.length ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={activitiesByMonth}
                      margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="currentColor" strokeOpacity={0.25} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickFormatter={(value) => String(value).slice(2)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="count"
                        name="Activities"
                        fill="#b5122b"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty />
              )}
            </Panel>

            <Panel
              eyebrow="VERIFIED IMPACT"
              title="Verified hours by month"
              sub="Only Admin-verified attendance contributes to hours."
            >
              {hoursByMonth.length ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={hoursByMonth}
                      margin={{ top: 8, right: 12, bottom: 0, left: -16 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray="3 6" stroke="currentColor" strokeOpacity={0.25} />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickFormatter={(value) => String(value).slice(2)}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        axisLine={false}
                        tickLine={false}
                        width={36}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="hours"
                        name="Verified hours"
                        fill="#8d5b08"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty />
              )}
            </Panel>

            <Panel
              eyebrow="ACTIVITY MIX"
              title="Activities by status"
              sub="Derived status of activities in scope."
            >
              {statusData.length > 0 ? (
                <div className="chart">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="count"
                        nameKey="name"
                        innerRadius={62}
                        outerRadius={92}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {statusData.map((row, index) => (
                          <Cell
                            key={`${row.name}-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <text x="50%" y="47%" textAnchor="middle" dominantBaseline="middle" className="report-pie-total">
                        {fmt(statusTotal)}
                      </text>
                      <text x="50%" y="58%" textAnchor="middle" dominantBaseline="middle" className="report-pie-label">
                        activities
                      </text>
                      <Tooltip content={<ChartTooltip />} />
                      <Legend
                        formatter={(value) =>
                          String(value).charAt(0).toUpperCase() + String(value).slice(1)
                        }
                        wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmpty text="No activities match the selected filters." />
              )}
            </Panel>

            <Panel
              className="report-coverage"
              eyebrow="DATA QUALITY"
              title="Attendance verification"
              sub="Verified hours compared with all submitted attendance hours."
            >
              <div className="report-coverage-head">
                <div>
                  <span>Submitted hours</span>
                  <strong>{fmt(kpis.submittedHours)}</strong>
                </div>
                <div>
                  <span>Verified hours</span>
                  <strong className="report-coverage-verified">{fmt(kpis.hours)}</strong>
                </div>
              </div>
              <div className="report-coverage-track">
                <span style={{ width: `${coverage}%` }} />
              </div>
              <p className="report-coverage-note">
                {num(kpis.submittedHours) > 0
                  ? `${fmt(coverage)}% of submitted hours are verified. `
                  : "No submitted hours in the selected period. "}
                There {num(kpis.pending) === 1 ? "is" : "are"} {fmt(kpis.pending)} enrollment
                {num(kpis.pending) === 1 ? "" : "s"} awaiting a decision.
              </p>
            </Panel>
          </div>

          <Panel
            eyebrow="TOP PERFORMERS"
            title="Top activities"
            sub="Ranked by verified attendance, then requests. Hours are verified only."
            action={
              <ExportButton
                rows={topActivities}
                filename={`reports-${fileScope}-top-activities.csv`}
              />
            }
          >
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>ACTIVITY</th>
                    <th>COLLEGE</th>
                    <th>CATEGORY</th>
                    <th>DATE</th>
                    <th>SEMESTER</th>
                    <th>SCHOOL YEAR</th>
                    <th>STATUS</th>
                    <th>SLOTS</th>
                    <th>REQUESTED</th>
                    <th>ACCEPTED</th>
                    <th>ATTENDED</th>
                    <th>VERIFIED</th>
                    <th>ATTENDANCE</th>
                    <th>HOURS</th>
                  </tr>
                </thead>
                <tbody>
                  {topActivities.map((row, index) => (
                    <tr key={row.id ?? `${row.title}-${row.date}`}>
                      <td>
                        <span className="report-rank">{index + 1}</span>
                      </td>
                      <td>
                        <strong>{row.title || "Untitled activity"}</strong>
                      </td>
                      <td>{row.college || "—"}</td>
                      <td>{row.category || "—"}</td>
                      <td>{displayDate(row.date)}</td>
                      <td>{row.semester || "—"}</td>
                      <td>{row.schoolYear || "—"}</td>
                      <td>
                        <Badge s={row.status} />
                      </td>
                      <td>{fmt(row.slots)}</td>
                      <td>{fmt(row.requested)}</td>
                      <td>{fmt(row.accepted)}</td>
                      <td>{fmt(row.attended)}</td>
                      <td>
                        <strong>{fmt(row.verified)}</strong>
                      </td>
                      <td>
                        <span className="report-cell-bar">
                          <MiniBar value={row.attendanceRate} max={100} />
                          <span>{fmt(row.attendanceRate)}%</span>
                        </span>
                      </td>
                      <td>{fmt(row.hours)}</td>
                    </tr>
                  ))}
                  {!topActivities.length && (
                    <Empty cols={15} text="No activities match the selected filters." />
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel
            eyebrow="COLLEGE LEADERBOARD"
            title="College performance"
            sub="Select a row or use the college dropdown to view that college's report."
            action={
              <ExportButton
                rows={byCollege}
                filename={`reports-${fileScope}-colleges.csv`}
              />
            }
          >
            <div className="tw">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>COLLEGE</th>
                    <th>STUDENTS</th>
                    <th>ADMINS</th>
                    <th>ACTIVITIES</th>
                    <th>REQUESTED</th>
                    <th>ACCEPTED</th>
                    <th>ATTENDED</th>
                    <th>VERIFIED</th>
                    <th>HOURS</th>
                    <th>REPORT</th>
                  </tr>
                </thead>
                <tbody>
                  {byCollege.map((row, index) => (
                    <tr
                      key={row.college}
                      className="report-click-row"
                      tabIndex={0}
                      role="button"
                      aria-label={`View report for ${row.college}`}
                      onClick={() => drillInto(row.college)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          drillInto(row.college);
                        }
                      }}
                    >
                      <td>
                        <span className="report-rank">{index + 1}</span>
                      </td>
                      <td>
                        <strong>{row.college}</strong>
                      </td>
                      <td>{fmt(row.students)}</td>
                      <td>{fmt(row.activeAdmins)}</td>
                      <td>{fmt(row.activities)}</td>
                      <td>{fmt(row.requested)}</td>
                      <td>{fmt(row.accepted)}</td>
                      <td>{fmt(row.attended)}</td>
                      <td>
                        <strong>{fmt(row.verified)}</strong>
                      </td>
                      <td>
                        <span className="report-cell-bar">
                          <MiniBar value={row.hours} max={maxCollegeHours} tone="mini-bar--gold" />
                          <span>{fmt(row.hours)}</span>
                        </span>
                      </td>
                      <td>
                        <span className="activity-link">View report →</span>
                      </td>
                    </tr>
                  ))}
                  {!byCollege.length && (
                    <Empty cols={11} text="No college data for the selected filters." />
                  )}
                </tbody>
              </table>
            </div>
          </Panel>

          <div className="report-grid">
            <Panel
              eyebrow="CATEGORY BREAKDOWN"
              title="By category"
              sub="Participants and hours count verified attendance only."
              action={
                <ExportButton
                  rows={byCategory}
                  filename={`reports-${fileScope}-categories.csv`}
                />
              }
            >
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>CATEGORY</th>
                      <th>ACTIVITIES</th>
                      <th>PARTICIPANTS</th>
                      <th>HOURS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCategory.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <strong>{row.name || "Uncategorized"}</strong>
                        </td>
                        <td>
                          <span className="report-cell-bar">
                            <MiniBar value={row.activities} max={maxCategoryActivities} />
                            <span>{fmt(row.activities)}</span>
                          </span>
                        </td>
                        <td>{fmt(row.participants)}</td>
                        <td>{fmt(row.hours)}</td>
                      </tr>
                    ))}
                    {!byCategory.length && (
                      <Empty cols={4} text="No categories for the selected filters." />
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel
              eyebrow="STATUS BREAKDOWN"
              title="By status"
              sub="Share of activities in each derived status."
              action={
                <ExportButton
                  rows={byStatus}
                  filename={`reports-${fileScope}-statuses.csv`}
                />
              }
            >
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>STATUS</th>
                      <th>ACTIVITIES</th>
                      <th>SHARE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byStatus.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <Badge s={row.name} />
                        </td>
                        <td>{fmt(row.count)}</td>
                        <td>
                          <span className="report-cell-bar">
                            <MiniBar value={row.count} max={statusTotal} tone="mini-bar--gold" />
                            <span>{statusTotal ? `${fmt(pct(row.count, statusTotal))}%` : "—"}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!byStatus.length && (
                      <Empty cols={3} text="No statuses for the selected filters." />
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>

          <div className="report-grid">
            <Panel
              eyebrow="SEMESTER BREAKDOWN"
              title="Activities by semester"
              sub="Grouped by the semester set for each activity. Older activities without a set semester use their date."
              action={
                <ExportButton
                  rows={bySemester}
                  filename={`reports-${fileScope}-semesters.csv`}
                />
              }
            >
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>SEMESTER</th>
                      <th>ACTIVITIES</th>
                      <th>SHARE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySemester.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <strong>{row.name}</strong>
                        </td>
                        <td>{fmt(row.count)}</td>
                        <td>
                          <span className="report-cell-bar">
                            <MiniBar value={row.count} max={maxPeriodActivities} />
                            <span>{kpis.activities ? `${fmt(pct(row.count, kpis.activities))}%` : "—"}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!bySemester.length && (
                      <Empty cols={3} text="No semesters for the selected filters." />
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel
              eyebrow="SCHOOL YEAR BREAKDOWN"
              title="Activities by school year"
              sub="Grouped by the academic year set for each activity. Older activities without a set year use their date (June to May)."
              action={
                <ExportButton
                  rows={bySchoolYear}
                  filename={`reports-${fileScope}-school-years.csv`}
                />
              }
            >
              <div className="tw">
                <table>
                  <thead>
                    <tr>
                      <th>SCHOOL YEAR</th>
                      <th>ACTIVITIES</th>
                      <th>SHARE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bySchoolYear.map((row) => (
                      <tr key={row.name}>
                        <td>
                          <strong>{row.name}</strong>
                        </td>
                        <td>{fmt(row.count)}</td>
                        <td>
                          <span className="report-cell-bar">
                            <MiniBar value={row.count} max={maxPeriodActivities} tone="mini-bar--gold" />
                            <span>{kpis.activities ? `${fmt(pct(row.count, kpis.activities))}%` : "—"}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!bySchoolYear.length && (
                      <Empty cols={3} text="No school years for the selected filters." />
                    )}
                  </tbody>
                </table>
              </div>
            </Panel>
          </div>
        </>
      )}
    </>
  );
}
