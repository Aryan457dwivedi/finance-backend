const jwt = require("jsonwebtoken");
const { query } = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "finance-dashboard-secret-key";

/**
 * Verifies the JWT token and attaches the user to req.user
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required. Provide a Bearer token." });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    // Fetch fresh user data (to catch status/role changes)
    const users = query("SELECT * FROM users WHERE id = ? AND status = 'active'", [decoded.id]);
    if (!users.length) {
      return res.status(401).json({ error: "User not found or account deactivated." });
    }
    req.user = users[0];
    delete req.user.password_hash; // never expose this
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

/**
 * Role hierarchy: admin > analyst > viewer
 */
const ROLE_LEVELS = { viewer: 1, analyst: 2, admin: 3 };

/**
 * Middleware factory: require a minimum role level
 * Usage: requireRole('analyst') — allows analyst and admin
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required." });
    }

    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    const minRequired = Math.min(...allowedRoles.map((r) => ROLE_LEVELS[r] || 99));

    if (userLevel < minRequired) {
      return res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(" or ")}. Your role: ${req.user.role}.`,
      });
    }

    next();
  };
}

/**
 * Shorthand guards
 */
const isAdmin = requireRole("admin");
const isAnalystOrAbove = requireRole("analyst");
const isAnyRole = requireRole("viewer");

module.exports = { authenticate, requireRole, isAdmin, isAnalystOrAbove, isAnyRole, JWT_SECRET };
