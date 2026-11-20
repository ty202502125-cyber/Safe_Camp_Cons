import jwt from 'jsonwebtoken';
import { store } from '../store.js';

export function authenticate(req, res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = store.users.find((item) => item.id === payload.sub && item.status === 'active');
    if (!user) return res.status(401).json({ error: 'Account is unavailable. Arayy Mo' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token.' });
  }
}

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: 'Oopss!You do not have permission to do that.' });
  next();
};

export const sameOrganization = (resourceOrgId) => (req, res, next) => {
  if (req.user.role === 'super_admin' || req.user.organizationId === resourceOrgId) return next();
  return res.status(403).json({ error: 'This record belongs to another organization.' });
};
