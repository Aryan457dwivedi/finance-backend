# Finance Dashboard Backend

A RESTful backend API for a multi-role finance dashboard. Built with Node.js, Express, and SQLite (via sql.js — no native compilation required).



---

## Live Demo
https://finance-backend-3pcs.onrender.com/

---
## Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Runtime | Node.js | Widely used, async-friendly |
| Framework | Express 4 | Mature, minimal, flexible |
| Database | sql.js (SQLite) | Zero native deps, file-persisted, easy local setup |
| Auth | JWT (jsonwebtoken) | Stateless, standard |
| Password hashing | bcryptjs | Pure JS bcrypt, no native build needed |
| Validation | Zod | Schema-first, excellent error messages |
| Security headers | Helmet | Industry-standard HTTP hardening |

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. (Optional) copy and edit environment config
cp .env.example .env

# 3. Start the server
npm start
```

The server starts at **http://localhost:3000**. The database is created automatically on first run and seeded with test data.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `finance-dashboard-secret-key` | Secret for signing JWTs — change in production |
| `NODE_ENV` | `development` | Set to `production` to hide error details |

---

## Seeded Test Accounts

| Email | Password | Role |
|---|---|---|
| admin@finance.com | admin123 | admin |
| analyst@finance.com | analyst123 | analyst |
| viewer@finance.com | viewer123 | viewer |

---

## Role Permissions

| Action | Viewer | Analyst | Admin |
|---|---|---|---|
| Login / view own profile | ✅ | ✅ | ✅ |
| List & view financial records | ✅ | ✅ | ✅ |
| Filter records | ✅ | ✅ | ✅ |
| Access dashboard summaries | ❌ | ✅ | ✅ |
| Create / update / delete records | ❌ | ❌ | ✅ |
| Create / update / delete users | ❌ | ❌ | ✅ |
| List all users | ❌ | ❌ | ✅ |

---

## API Reference

All protected endpoints require:
```
Authorization: Bearer <token>
```

---

### Auth

#### `POST /auth/login`
Authenticate and receive a JWT token.

**Request body:**
```json
{ "email": "admin@finance.com", "password": "admin123" }
```

**Response:**
```json
{
  "token": "<jwt>",
  "user": { "id": 1, "name": "Admin User", "email": "admin@finance.com", "role": "admin" }
}
```

---

#### `GET /auth/me`
Returns the currently authenticated user.

---

### Users

> All user endpoints require **admin** role.

#### `GET /users`
List all users.

#### `GET /users/:id`
Get a single user. Admins can view anyone; users can view themselves.

#### `POST /users`
Create a new user.

**Request body:**
```json
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "securepass",
  "role": "analyst"
}
```

#### `PATCH /users/:id`
Update name, role, or status. All fields are optional.

```json
{ "role": "viewer", "status": "inactive" }
```

#### `DELETE /users/:id`
Hard delete a user. Cannot delete your own account.

---

### Financial Records

#### `GET /records`
List records with optional filters and pagination.

**Query parameters:**

| Param | Type | Description |
|---|---|---|
| `type` | `income` \| `expense` | Filter by type |
| `category` | string | Partial match on category |
| `from` | YYYY-MM-DD | Records on or after this date |
| `to` | YYYY-MM-DD | Records on or before this date |
| `page` | integer | Page number (default: 1) |
| `limit` | integer | Page size (default: 20, max: 100) |
| `sort` | `date` \| `amount` \| `created_at` | Sort field (default: `date`) |
| `order` | `asc` \| `desc` | Sort direction (default: `desc`) |

**Example response:**
```json
{
  "records": [...],
  "pagination": { "page": 1, "limit": 20, "total": 42, "total_pages": 3 }
}
```

#### `GET /records/:id`
Get a single record by ID.

#### `POST /records` *(admin only)*
Create a new financial record.

```json
{
  "amount": 5000.00,
  "type": "income",
  "category": "Salary",
  "date": "2024-03-01",
  "notes": "March salary"
}
```

#### `PATCH /records/:id` *(admin only)*
Update any fields of a record. All fields optional.

#### `DELETE /records/:id` *(admin only)*
**Soft delete** — sets `deleted_at` timestamp; record is excluded from all queries but preserved in the database.

---

### Dashboard

> All dashboard endpoints require **analyst** or **admin** role.

#### `GET /dashboard/summary`
Overall totals for a date range.

**Query params:** `from`, `to` (both optional, YYYY-MM-DD)

**Response:**
```json
{
  "summary": {
    "total_income": 16500.00,
    "total_expenses": 1950.00,
    "net_balance": 14550.00,
    "total_records": 10
  }
}
```

#### `GET /dashboard/by-category`
Income and expense totals grouped by category.

**Query params:** `from`, `to`

**Response:**
```json
{
  "categories": [
    {
      "category": "Salary",
      "income": 16500,
      "expense": 0,
      "income_count": 3,
      "expense_count": 0,
      "net": 16500
    }
  ]
}
```

#### `GET /dashboard/monthly-trends`
Month-by-month breakdown.

**Query params:** `months` (default: 12, max: 60)

#### `GET /dashboard/weekly-trends`
Week-by-week breakdown.

**Query params:** `weeks` (default: 8, max: 52)

#### `GET /dashboard/recent`
Most recent N records.

**Query params:** `limit` (default: 10, max: 50)

---

## Error Responses

All errors follow a consistent shape:

```json
{ "error": "Human-readable message" }
```

Validation errors include field-level details:

```json
{
  "error": "Validation failed",
  "details": [
    { "field": "amount", "message": "Amount must be positive" },
    { "field": "date", "message": "Date must be in YYYY-MM-DD format" }
  ]
}
```

### HTTP Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Bad request / validation error |
| 401 | Missing or invalid token |
| 403 | Authenticated but insufficient role |
| 404 | Resource not found |
| 409 | Conflict (e.g. duplicate email) |
| 500 | Unexpected server error |

---

## Design Decisions & Assumptions

### Soft Deletes for Records
Financial records are soft-deleted (`deleted_at` timestamp) rather than hard-deleted. This preserves audit history and allows potential recovery, which is appropriate for financial data. Users are hard-deleted since there is no financial significance to retaining them.

### Role Hierarchy
Three roles with clear ascending permissions: `viewer < analyst < admin`. This is implemented as a level comparison in middleware (`ROLE_LEVELS` map), making it trivial to add new roles or adjust permissions without touching route handlers.

### Validation at the Middleware Layer
All input validation is handled by Zod schemas in a `validate()` middleware factory. Route handlers receive only clean, coerced data. This keeps route logic focused on business rules.

### sql.js over better-sqlite3
`better-sqlite3` is faster and more production-appropriate, but requires native compilation (node-gyp). `sql.js` is pure WebAssembly — no build tooling required, works on any machine with `npm install`. The database is persisted to disk as `src/db/finance.db` and auto-saved every 5 seconds, providing durability without the compilation requirement.

### No Refresh Tokens
JWTs expire after 24 hours. A production system would add refresh tokens, but for this assessment the tradeoff favors simplicity.

### Analyst Cannot Create Records
The assignment left this open. The decision here is that financial data entry is an admin responsibility (controlled, auditable), while analysts are consumers of that data.

---

## Project Structure

```
finance-backend/
├── src/
│   ├── app.js              # Entry point: middleware, route wiring, error handlers
│   ├── db/
│   │   └── index.js        # DB init, schema migrations, seed data, query helpers
│   ├── middleware/
│   │   ├── auth.js         # JWT authentication + role-based access control
│   │   └── validate.js     # Zod validation middleware + all schemas
│   └── routes/
│       ├── auth.js         # POST /auth/login, GET /auth/me
│       ├── users.js        # User CRUD (admin only)
│       ├── records.js      # Record CRUD + filtering + pagination + soft delete
│       └── dashboard.js    # Aggregated analytics endpoints
├── .env.example
├── package.json
└── README.md
```
