const express = require("express");
const bcrypt = require("bcryptjs");
const { query, execute } = require("../db");
const { authenticate, isAdmin } = require("../middleware/auth");
const { validate, createUserSchema, updateUserSchema } = require("../middleware/validate");

const router = express.Router();

// All user routes require authentication
router.use(authenticate);

/**
 * GET /users
 * List all users. Admin only.
 */
router.get("/", isAdmin, (req, res) => {
  const users = query(
    "SELECT id, name, email, role, status, created_at FROM users ORDER BY created_at DESC"
  );
  res.json({ users, total: users.length });
});

/**
 * GET /users/:id
 * Get a single user. Admin only (or self).
 */
router.get("/:id", (req, res) => {
  const targetId = parseInt(req.params.id);

  // Users can view themselves; admins can view anyone
  if (req.user.role !== "admin" && req.user.id !== targetId) {
    return res.status(403).json({ error: "Access denied." });
  }

  const users = query(
    "SELECT id, name, email, role, status, created_at FROM users WHERE id = ?",
    [targetId]
  );

  if (!users.length) {
    return res.status(404).json({ error: "User not found." });
  }

  res.json({ user: users[0] });
});

/**
 * POST /users
 * Create a new user. Admin only.
 */
router.post("/", isAdmin, validate(createUserSchema), (req, res) => {
  const { name, email, password, role } = req.body;

  // Check for duplicate email
  const existing = query("SELECT id FROM users WHERE email = ?", [email]);
  if (existing.length) {
    return res.status(409).json({ error: "A user with this email already exists." });
  }

  const password_hash = bcrypt.hashSync(password, 10);

  const result = execute(
    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
    [name, email, password_hash, role]
  );

  const newUser = query(
    "SELECT id, name, email, role, status, created_at FROM users WHERE id = ?",
    [result.lastInsertRowid]
  );

  res.status(201).json({ message: "User created successfully.", user: newUser[0] });
});

/**
 * PATCH /users/:id
 * Update a user's name, role, or status. Admin only.
 */
router.patch("/:id", isAdmin, validate(updateUserSchema), (req, res) => {
  const targetId = parseInt(req.params.id);

  // Prevent admin from deactivating themselves
  if (req.user.id === targetId && req.body.status === "inactive") {
    return res.status(400).json({ error: "You cannot deactivate your own account." });
  }

  const existing = query("SELECT id FROM users WHERE id = ?", [targetId]);
  if (!existing.length) {
    return res.status(404).json({ error: "User not found." });
  }

  const { name, role, status } = req.body;
  const fields = [];
  const params = [];

  if (name !== undefined) { fields.push("name = ?"); params.push(name); }
  if (role !== undefined) { fields.push("role = ?"); params.push(role); }
  if (status !== undefined) { fields.push("status = ?"); params.push(status); }
  fields.push("updated_at = datetime('now')");

  params.push(targetId);
  execute(`UPDATE users SET ${fields.join(", ")} WHERE id = ?`, params);

  const updated = query(
    "SELECT id, name, email, role, status, created_at, updated_at FROM users WHERE id = ?",
    [targetId]
  );

  res.json({ message: "User updated successfully.", user: updated[0] });
});

/**
 * DELETE /users/:id
 * Hard delete a user. Admin only.
 * Prevents deleting self.
 */
router.delete("/:id", isAdmin, (req, res) => {
  const targetId = parseInt(req.params.id);

  if (req.user.id === targetId) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  const existing = query("SELECT id FROM users WHERE id = ?", [targetId]);
  if (!existing.length) {
    return res.status(404).json({ error: "User not found." });
  }

  execute("DELETE FROM users WHERE id = ?", [targetId]);
  res.json({ message: "User deleted successfully." });
});

module.exports = router;
