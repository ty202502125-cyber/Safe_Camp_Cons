import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { store, publicUser } from './store.js';
import { authenticate, allowRoles } from './middleware/auth.js';

const app = express();
const port = Number(process.env.PORT || 4000);
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('Set JWT_SECRET to a random value at least 32 characters long.');
app.use(helmet());
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()), credentials: false }));
app.use(express.json({ limit: '1mb' }));

const sendError = (res, status, error) => res.status(status).json({ error });
const text = (value, max = 3000) => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
const orgActive = (id) => store.organizations.find((o) => o.id === id && o.status === 'active');
const canSeeActivity = (activity, user) => user.role === 'super_admin' || activity.organizationIds.includes(user.organizationId) || activity.createdBy === user.id;
const tokenFor = (user) => jwt.sign({}, process.env.JWT_SECRET, { subject: user.id, expiresIn: process.env.JWT_EXPIRES_IN || '1h', issuer: 'campus-connect-api', audience: 'campus-connect-client' });

app.get('/api/health', (_req, res) => res.json({ status: 'ok', persistence: 'temporary-memory' }));

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, institutionalId, organizationId } = req.body || {};
    if (!text(email, 254) || !/^\S+@\S+\.\S+$/.test(email.trim()) || !text(password, 200) || password.length < 12 || !text(firstName, 100) || !text(lastName, 100) || !text(institutionalId, 80) || !organizationId) return sendError(res, 400, 'Provide a valid email, password (at least 12 characters), name, institutional ID, and organization.');
    if (!orgActive(organizationId) || orgActive(organizationId).type !== 'college') return sendError(res, 400, 'Students must select an active college.');
    const normalizedEmail = email.trim().toLowerCase();
    if (store.users.some((u) => u.email === normalizedEmail || u.institutionalId === institutionalId.trim())) return sendError(res, 409, 'Email or institutional ID is already registered.');
    const user = { id: randomUUID(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'student', firstName: firstName.trim(), lastName: lastName.trim(), institutionalId: institutionalId.trim(), organizationId, status: 'active', createdAt: new Date().toISOString() };
    store.users.push(user);
    res.status(201).json({ user: publicUser(user), accessToken: tokenFor(user), tokenType: 'Bearer', expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  } catch (error) { next(error); }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!text(email, 254) || typeof password !== 'string') return sendError(res, 400, 'Email and password are required.');
    const user = store.users.find((u) => u.email === email.trim().toLowerCase());
    if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.passwordHash))) return sendError(res, 401, 'Email or password is incorrect.');
    res.json({ user: publicUser(user), accessToken: tokenFor(user), tokenType: 'Bearer', expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
  } catch (error) { next(error); }
});

app.get('/api/auth/me', authenticate, (req, res) => res.json({ user: publicUser(req.user) }));
app.post('/api/auth/logout', authenticate, (_req, res) => res.json({ message: 'Discard the access token on the client.' }));

app.get('/api/organizations', (_req, res) => res.json({ organizations: store.organizations.filter((o) => o.status === 'active') }));
app.post('/api/organizations', authenticate, allowRoles('super_admin'), (req, res) => {
  const { name, type } = req.body || {};
  if (!text(name, 160) || !['college', 'office'].includes(type)) return sendError(res, 400, 'Provide an organization name and type college or office.');
  if (store.organizations.some((o) => o.name.toLowerCase() === name.trim().toLowerCase())) return sendError(res, 409, 'Organization already exists.');
  const organization = { id: randomUUID(), name: name.trim(), type, status: 'active' };
  store.organizations.push(organization);
  res.status(201).json({ organization });
});

// this is the part where Super admins create admin accounts; public registration can only create students.
app.post('/api/admins', authenticate, allowRoles('super_admin'), async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, institutionalId, organizationId } = req.body || {};
    if (!text(email, 254) || !text(password, 200) || password.length < 12 || !text(firstName, 100) || !text(lastName, 100) || !text(institutionalId, 80) || !orgActive(organizationId)) return sendError(res, 400, 'Complete all admin fields and select an active organization.');
    const normalizedEmail = email.trim().toLowerCase();
    if (store.users.some((u) => u.email === normalizedEmail || u.institutionalId === institutionalId.trim())) return sendError(res, 409, 'Email or institutional ID is already registered.');
    const user = { id: randomUUID(), email: normalizedEmail, passwordHash: await bcrypt.hash(password, 12), role: 'admin', firstName: firstName.trim(), lastName: lastName.trim(), institutionalId: institutionalId.trim(), organizationId, status: 'active', createdAt: new Date().toISOString() };
    store.users.push(user);
    res.status(201).json({ user: publicUser(user) });
  } catch (error) { next(error); }
});

app.get('/api/activities', (req, res) => {
  const items = store.activities.filter((a) => a.status === 'open' || (req.user && canSeeActivity(a, req.user)));
  res.json({ activities: items });
});
app.post('/api/activities', authenticate, allowRoles('admin', 'super_admin'), (req, res) => {
  const { title, description = '', category, date, startTime, endTime, location, capacity, organizationIds = [] } = req.body || {};
  const cap = Number(capacity);
  if (!text(title, 200) || !text(description, 5000) || !text(category, 100) || !text(date, 10) || !text(startTime, 8) || !text(endTime, 8) || !text(location, 300) || !Number.isInteger(cap) || cap < 1 || !Array.isArray(organizationIds)) return sendError(res, 400, 'Activity details are invalid or incomplete.');
  if (req.user.role === 'admin' && (!req.user.organizationId || organizationIds.some((id) => id !== req.user.organizationId))) return sendError(res, 403, 'Admins may submit activities only for their own organization.');
  if (organizationIds.some((id) => !orgActive(id))) return sendError(res, 400, 'Every target organization must be active.');
  if (startTime >= endTime) return sendError(res, 400, 'End time must be after start time.');
  const activity = { id: randomUUID(), title: title.trim(), description: description.trim(), category: category.trim(), date, startTime, endTime, location: location.trim(), capacity: cap, status: 'pending', createdBy: req.user.id, organizationIds: [...new Set(organizationIds)], createdAt: new Date().toISOString() };
  store.activities.push(activity);
  res.status(201).json({ activity });
});
app.patch('/api/activities/:id/status', authenticate, allowRoles('super_admin'), (req, res) => {
  const activity = store.activities.find((a) => a.id === req.params.id);
  if (!activity) return sendError(res, 404, 'Activity not found.');
  if (!['open', 'rejected', 'cancelled'].includes(req.body?.status)) return sendError(res, 400, 'Status must be open, rejected, or cancelled.');
  activity.status = req.body.status;
  activity.updatedAt = new Date().toISOString();
  res.json({ activity });
});
app.patch('/api/activities/:id', authenticate, allowRoles('admin', 'super_admin'), (req, res) => {
  const activity = store.activities.find((a) => a.id === req.params.id);
  if (!activity) return sendError(res, 404, 'Activity not found.');
  if (req.user.role === 'admin' && activity.createdBy !== req.user.id && activity.organizationIds.includes(req.user.organizationId) === false) return sendError(res, 403, 'This activity is outside your organization.');
  const allowed = ['title', 'description', 'category', 'date', 'startTime', 'endTime', 'location', 'capacity'];
  for (const key of allowed) if (req.body?.[key] !== undefined) activity[key] = req.body[key];
  if (activity.startTime >= activity.endTime || !Number.isInteger(Number(activity.capacity)) || Number(activity.capacity) < 1) return sendError(res, 400, 'Schedule or capacity is invalid.');
  activity.updatedAt = new Date().toISOString();
  res.json({ activity });
});

app.get('/api/enrollments/mine', authenticate, allowRoles('student'), (req, res) => res.json({ enrollments: store.enrollments.filter((e) => e.studentId === req.user.id) }));
app.post('/api/activities/:id/enrollments', authenticate, allowRoles('student'), (req, res) => {
  const activity = store.activities.find((a) => a.id === req.params.id && a.status === 'open');
  if (!activity) return sendError(res, 404, 'Open activity not found.');
  if (store.enrollments.some((e) => e.activityId === activity.id && e.studentId === req.user.id)) return sendError(res, 409, 'You already have an enrollment for this activity.');
  const enrollment = { id: randomUUID(), activityId: activity.id, studentId: req.user.id, status: 'pending', attendanceDate: null, hoursWorked: null, attendanceVerified: false, requestedAt: new Date().toISOString() };
  store.enrollments.push(enrollment);
  res.status(201).json({ enrollment });
});
app.delete('/api/enrollments/:id', authenticate, allowRoles('student'), (req, res) => {
  const i = store.enrollments.findIndex((e) => e.id === req.params.id && e.studentId === req.user.id && e.status === 'pending');
  if (i < 0) return sendError(res, 404, 'Pending enrollment not found.');
  store.enrollments.splice(i, 1);
  res.status(204).end();
});
app.get('/api/enrollments/pending', authenticate, allowRoles('admin', 'super_admin'), (req, res) => {
  const list = store.enrollments.filter((e) => {
    const activity = store.activities.find((a) => a.id === e.activityId);
    return e.status === 'pending' && activity && (req.user.role === 'super_admin' || activity.organizationIds.includes(req.user.organizationId) || activity.createdBy === req.user.id);
  });
  res.json({ enrollments: list });
});
app.patch('/api/enrollments/:id/decision', authenticate, allowRoles('admin', 'super_admin'), (req, res) => {
  const enrollment = store.enrollments.find((e) => e.id === req.params.id);
  if (!enrollment) return sendError(res, 404, 'Enrollment not found.');
  const activity = store.activities.find((a) => a.id === enrollment.activityId);
  if (req.user.role === 'admin' && !activity.organizationIds.includes(req.user.organizationId) && activity.createdBy !== req.user.id) return sendError(res, 403, 'This enrollment is outside your organization.');
  if (enrollment.status !== 'pending' || !['accepted', 'declined'].includes(req.body?.status)) return sendError(res, 409, 'Only pending enrollments can be accepted or declined.');
  if (req.body.status === 'accepted' && store.enrollments.filter((e) => e.activityId === activity.id && e.status === 'accepted').length >= activity.capacity) return sendError(res, 409, 'Activity has reached its capacity.');
  enrollment.status = req.body.status;
  enrollment.reviewedBy = req.user.id;
  enrollment.reviewedAt = new Date().toISOString();
  res.json({ enrollment });
});
app.patch('/api/enrollments/:id/attendance', authenticate, allowRoles('student'), (req, res) => {
  const enrollment = store.enrollments.find((e) => e.id === req.params.id && e.studentId === req.user.id);
  if (!enrollment || enrollment.status !== 'accepted') return sendError(res, 404, 'Accepted enrollment not found.');
  const activity = store.activities.find((a) => a.id === enrollment.activityId);
  if (new Date() < new Date(`${activity.date}T${activity.endTime}:00`)) return sendError(res, 409, 'Attendance can be submitted after the activity ends.');
  const hours = Number(req.body?.hoursWorked);
  if (!Number.isFinite(hours) || hours <= 0 || hours > (Number(activity.endTime.slice(0, 2)) * 60 + Number(activity.endTime.slice(3, 5)) - Number(activity.startTime.slice(0, 2)) * 60 - Number(activity.startTime.slice(3, 5))) / 60) return sendError(res, 400, 'Hours must be positive and no greater than the scheduled duration.');
  enrollment.hoursWorked = hours;
  enrollment.attendanceDate = activity.date;
  enrollment.attendanceVerified = false;
  enrollment.verifiedBy = null;
  enrollment.verifiedAt = null;
  res.json({ enrollment });
});
app.patch('/api/enrollments/:id/verify-attendance', authenticate, allowRoles('admin', 'super_admin'), (req, res) => {
  const enrollment = store.enrollments.find((e) => e.id === req.params.id);
  if (!enrollment || enrollment.status !== 'accepted' || !enrollment.hoursWorked) return sendError(res, 404, 'Attendance submission not found.');
  const activity = store.activities.find((a) => a.id === enrollment.activityId);
  if (req.user.role === 'admin' && !activity.organizationIds.includes(req.user.organizationId) && activity.createdBy !== req.user.id) return sendError(res, 403, 'This record is outside your organization.');
  enrollment.attendanceVerified = req.body?.verified === true;
  enrollment.verifiedBy = enrollment.attendanceVerified ? req.user.id : null;
  enrollment.verifiedAt = enrollment.attendanceVerified ? new Date().toISOString() : null;
  res.json({ enrollment });
});

app.use((req, res) => sendError(res, 404, `Route not found: ${req.method} ${req.path}`));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Unexpected server error.' });
});

await store.initialize();
app.listen(port, () => console.log(`Campus Connect API listening on http://localhost:${port}`));
