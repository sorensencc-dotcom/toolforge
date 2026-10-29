// Auth middleware (write-boundary).
// The security-critical property: user identity is derived from the request's
// auth context (session), NEVER from the request body. This module centralizes
// that so no route can accidentally trust a body-supplied user_id.
//
// No session store exists yet in this stack, so the default resolver reads a
// signed session (req.session.userId) if present, else an `x-user-id` header
// only when development explicitly enables the header-auth escape hatch. Swap
// `resolveUser` for real session middleware later; the contract stays fixed.

export function defaultResolveUser(req) {
  if (req.session && req.session.userId) return req.session.userId;
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.TOOLFORGE_DEV_HEADER_AUTH !== '1'
  ) return null;
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.trim() !== '') return header.trim();
  return null;
}

/**
 * Build an auth middleware. Attaches req.userId (never from body).
 * @param {(req) => (string|null)} [resolveUser]
 */
export function attachUser(resolveUser = defaultResolveUser) {
  return (req, _res, next) => {
    req.userId = resolveUser(req);
    next();
  };
}

/**
 * Reject unauthenticated requests with 401.
 */
export function requireAuth(req, res, next) {
  if (!req.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}
