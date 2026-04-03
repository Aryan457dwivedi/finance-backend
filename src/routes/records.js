const express = require("express");
const { query, execute } = require("../db");
const { authenticate, isAdmin, isAnalystOrAbove, isAnyRole } = require("../middleware/auth");
const { validate, createRecordSchema, updateRecordSchema } = require("../middleware/validate");

const router = express.Router();

// All record routes require authentication
router.use(authenticate);

/**
 * GET /records
 * List financial records with optional filters and pagination.
 * All roles can access.
 *
 * Query params:
 *   type       - 'income' | 'expense'
 *   category   - string (partial match)
 *   from       - date string YYYY-MM-DD
 *   to         - date string YYYY-MM-DD
 *   page       - integer (default 1)
 *   limit      - integer (default 20, max 100)
 *   sort       - 'date' | 'amount' | 'created_at' (default 'date')
 *   order      - 'asc' | 'desc' (default 'desc')
 */
router.get("/", isAnyRole, (req, res) => {
  const { type, category, from, to, sort = "date", order = "desc" } = req.query;

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;

  // Whitelist sort fields and order to prevent SQL injection
  const allowedSort = ["date", "amount", "created_at"];
  const allowedOrder = ["asc", "desc"];
  const sortField = allowedSort.includes(sort) ? sort : "date";
  const sortOrder = allowedOrder.includes(order) ? order : "desc";

  const conditions = ["deleted_at IS NULL"];
  const params = [];

  if (type) {
    if (!["income", "expense"].includes(type)) {
      return res.status(400).json({ error: "type must be 'income' or 'expense'" });
    }
    conditions.push("type = ?");
    params.push(type);
  }

  if (category) {
    conditions.push("category LIKE ?");
    params.push(`%${category}%`);
  }

  if (from) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      return res.status(400).json({ error: "from must be in YYYY-MM-DD format" });
    }
    conditions.push("date >= ?");
    params.push(from);
  }

  if (to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: "to must be in YYYY-MM-DD format" });
    }
    conditions.push("date <= ?");
    params.push(to);
  }

  const where = conditions.join(" AND ");

  // Count total for pagination metadata
  const countResult = query(
    `SELECT COUNT(*) as total FROM financial_records WHERE ${where}`,
    params
  );
  const total = countResult[0]?.total || 0;

  const records = query(
    `SELECT r.*, u.name as created_by_name
     FROM financial_records r
     JOIN users u ON u.id = r.created_by
     WHERE ${where}
     ORDER BY r.${sortField} ${sortOrder}
     LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  res.json({
    records,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  });
});

/**
 * GET /records/:id
 * Get a single record. All roles.
 */
router.get("/:id", isAnyRole, (req, res) => {
  const records = query(
    `SELECT r.*, u.name as created_by_name
     FROM financial_records r
     JOIN users u ON u.id = r.created_by
     WHERE r.id = ? AND r.deleted_at IS NULL`,
    [parseInt(req.params.id)]
  );

  if (!records.length) {
    return res.status(404).json({ error: "Record not found." });
  }

  res.json({ record: records[0] });
});

/**
 * POST /records
 * Create a record. Admin only.
 */
router.post("/", isAdmin, validate(createRecordSchema), (req, res) => {
  const { amount, type, category, date, notes } = req.body;

  const result = execute(
    `INSERT INTO financial_records (amount, type, category, date, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [amount, type, category, date, notes || null, req.user.id]
  );

  const record = query(
    "SELECT * FROM financial_records WHERE id = ?",
    [result.lastInsertRowid]
  );

  res.status(201).json({ message: "Record created successfully.", record: record[0] });
});

/**
 * PATCH /records/:id
 * Update a record. Admin only.
 */
router.patch("/:id", isAdmin, validate(updateRecordSchema), (req, res) => {
  const recordId = parseInt(req.params.id);

  const existing = query(
    "SELECT id FROM financial_records WHERE id = ? AND deleted_at IS NULL",
    [recordId]
  );
  if (!existing.length) {
    return res.status(404).json({ error: "Record not found." });
  }

  const { amount, type, category, date, notes } = req.body;
  const fields = [];
  const params = [];

  if (amount !== undefined) { fields.push("amount = ?"); params.push(amount); }
  if (type !== undefined) { fields.push("type = ?"); params.push(type); }
  if (category !== undefined) { fields.push("category = ?"); params.push(category); }
  if (date !== undefined) { fields.push("date = ?"); params.push(date); }
  if (notes !== undefined) { fields.push("notes = ?"); params.push(notes); }
  fields.push("updated_at = datetime('now')");

  params.push(recordId);
  execute(`UPDATE financial_records SET ${fields.join(", ")} WHERE id = ?`, params);

  const updated = query("SELECT * FROM financial_records WHERE id = ?", [recordId]);
  res.json({ message: "Record updated successfully.", record: updated[0] });
});

/**
 * DELETE /records/:id
 * Soft delete a record. Admin only.
 */
router.delete("/:id", isAdmin, (req, res) => {
  const recordId = parseInt(req.params.id);

  const existing = query(
    "SELECT id FROM financial_records WHERE id = ? AND deleted_at IS NULL",
    [recordId]
  );
  if (!existing.length) {
    return res.status(404).json({ error: "Record not found." });
  }

  execute(
    "UPDATE financial_records SET deleted_at = datetime('now') WHERE id = ?",
    [recordId]
  );

  res.json({ message: "Record deleted successfully." });
});

module.exports = router;
