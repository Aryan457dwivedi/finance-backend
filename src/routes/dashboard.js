const express = require("express");
const { query } = require("../db");
const { authenticate, isAnalystOrAbove } = require("../middleware/auth");

const router = express.Router();

// All dashboard routes require at least analyst role
router.use(authenticate);
router.use(isAnalystOrAbove);

/**
 * GET /dashboard/summary
 * Overall financial summary: total income, expenses, net balance.
 *
 * Query params:
 *   from - YYYY-MM-DD (optional)
 *   to   - YYYY-MM-DD (optional)
 */
router.get("/summary", (req, res) => {
  const { from, to } = req.query;
  const { where, params } = buildDateFilter(from, to);

  const totals = query(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as total_income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as total_expenses,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net_balance,
       COUNT(*) as total_records
     FROM financial_records
     WHERE deleted_at IS NULL ${where}`,
    params
  );

  res.json({ summary: totals[0], filters: { from, to } });
});

/**
 * GET /dashboard/by-category
 * Totals grouped by category (income and expense separately).
 */
router.get("/by-category", (req, res) => {
  const { from, to } = req.query;
  const { where, params } = buildDateFilter(from, to);

  const rows = query(
    `SELECT
       category,
       type,
       COALESCE(SUM(amount), 0) as total,
       COUNT(*) as count
     FROM financial_records
     WHERE deleted_at IS NULL ${where}
     GROUP BY category, type
     ORDER BY total DESC`,
    params
  );

  // Reshape into { category: { income: ..., expense: ... } }
  const byCategory = {};
  for (const row of rows) {
    if (!byCategory[row.category]) {
      byCategory[row.category] = { income: 0, expense: 0, income_count: 0, expense_count: 0 };
    }
    byCategory[row.category][row.type] = row.total;
    byCategory[row.category][`${row.type}_count`] = row.count;
  }

  const categories = Object.entries(byCategory).map(([category, data]) => ({
    category,
    ...data,
    net: data.income - data.expense,
  }));

  res.json({ categories, filters: { from, to } });
});

/**
 * GET /dashboard/monthly-trends
 * Month-by-month income, expense, and net for the past N months.
 *
 * Query params:
 *   months - number of months to return (default 12)
 */
router.get("/monthly-trends", (req, res) => {
  const months = Math.min(60, Math.max(1, parseInt(req.query.months) || 12));

  const rows = query(
    `SELECT
       strftime('%Y-%m', date) as month,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net,
       COUNT(*) as record_count
     FROM financial_records
     WHERE deleted_at IS NULL
       AND date >= date('now', '-${months} months')
     GROUP BY month
     ORDER BY month ASC`
  );

  res.json({ trends: rows, months_requested: months });
});

/**
 * GET /dashboard/recent
 * Most recent N financial records.
 *
 * Query params:
 *   limit - number of records (default 10, max 50)
 */
router.get("/recent", (req, res) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));

  const records = query(
    `SELECT r.id, r.amount, r.type, r.category, r.date, r.notes, u.name as created_by_name
     FROM financial_records r
     JOIN users u ON u.id = r.created_by
     WHERE r.deleted_at IS NULL
     ORDER BY r.created_at DESC
     LIMIT ?`,
    [limit]
  );

  res.json({ recent: records });
});

/**
 * GET /dashboard/weekly-trends
 * Weekly breakdown for the past N weeks.
 *
 * Query params:
 *   weeks - number of weeks (default 8)
 */
router.get("/weekly-trends", (req, res) => {
  const weeks = Math.min(52, Math.max(1, parseInt(req.query.weeks) || 8));

  const rows = query(
    `SELECT
       strftime('%Y-W%W', date) as week,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) as income,
       COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) as expenses,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0) as net,
       COUNT(*) as record_count
     FROM financial_records
     WHERE deleted_at IS NULL
       AND date >= date('now', '-${weeks * 7} days')
     GROUP BY week
     ORDER BY week ASC`
  );

  res.json({ trends: rows, weeks_requested: weeks });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDateFilter(from, to) {
  const conditions = [];
  const params = [];

  if (from) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
      throw new Error("from must be YYYY-MM-DD");
    }
    conditions.push("AND date >= ?");
    params.push(from);
  }

  if (to) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new Error("to must be YYYY-MM-DD");
    }
    conditions.push("AND date <= ?");
    params.push(to);
  }

  return { where: conditions.join(" "), params };
}

module.exports = router;
