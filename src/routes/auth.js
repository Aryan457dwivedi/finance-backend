const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const { authenticate, JWT_SECRET } = require("../middleware/auth");
const { validate, loginSchema } = require("../middleware/validate");

const router = express.Router();

/**
 * POST /auth/login
 * Authenticate and receive a JWT token.
 */
router.post("/login", validate(loginSchema), (req, res) => {
  const { email, password } = req.body;

  const users = query("SELECT * FROM users WHERE email = ?", [email]);
  if (!users.length) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const user = users[0];

  if (user.status === "inactive") {
    return res.status(403).json({ error: "Account is deactivated. Contact an administrator." });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password." });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "24h" }
  );

  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  });
});

/**
 * GET /auth/me
 * Returns current authenticated user info.
 */
router.get("/me", authenticate, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
