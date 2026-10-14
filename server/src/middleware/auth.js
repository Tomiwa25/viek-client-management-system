import { verifyAccessToken } from '../lib/jwt.js';

/**
 * Middleware to enforce JWT authentication on protected routes.
 * Extracts 'Bearer <token>' from the Authorization header and attaches `req.user`.
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Authentication required. Bearer token missing.' },
    });
  }

  const token = authHeader.slice(7).trim();

  try {
    const decoded = verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      organizationId: decoded.orgId,
      role: decoded.role,
      email: decoded.email,
    };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'TOKEN_EXPIRED', message: 'Access token has expired. Please refresh your session.' },
      });
    }
    return res.status(401).json({
      error: { code: 'INVALID_TOKEN', message: 'Invalid or malformed access token.' },
    });
  }
}

/**
 * Role-based authorization guard (Admin, Manager, Staff)
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to access this resource.' },
      });
    }
    next();
  };
}
