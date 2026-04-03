require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { initDB, saveDB } = require("./db");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const recordRoutes = require("./routes/records");
const dashboardRoutes = require("./routes/dashboard");

const app = express();
const PORT = process.env.PORT || 3000;



app.use(helmet()); // Security headers
app.use(cors());
app.use(express.json());

// Request logger (lightweight, no extra deps)
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    const color = res.statusCode >= 400 ? "\x1b[31m" : "\x1b[32m";
    console.log(`${color}${req.method} ${req.path} → ${res.statusCode}\x1b[0m (${duration}ms)`);
  });
  next();
});



app.get("/", (req, res) => {
  res.json({
    name: "Finance Dashboard API",
    version: "1.0.0",
    status: "running",
    docs: "See README.md for API documentation",
    endpoints: {
      auth: "/auth",
      users: "/users",
      records: "/records",
      dashboard: "/dashboard",
    },
  });
});

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/records", recordRoutes);
app.use("/dashboard", dashboardRoutes);



app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found.` });
});



app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    error: "An unexpected error occurred.",
    ...(process.env.NODE_ENV !== "production" && { detail: err.message }),
  });
});



async function start() {
  try {
    await initDB();
    console.log(" Database initialized");

    app.listen(PORT, () => {
      console.log(`\n Finance API running at http://localhost:${PORT}\n`);
      console.log("Seeded accounts (for testing):");
      console.log("  admin@finance.com   / admin123   (role: admin)");
      console.log("  analyst@finance.com / analyst123 (role: analyst)");
      console.log("  viewer@finance.com  / viewer123  (role: viewer)\n");
    });

   
    process.on("SIGTERM", () => { saveDB(); process.exit(0); });
    process.on("SIGINT", () => { saveDB(); process.exit(0); });

  } catch (err) {
    console.error("Failed to start:", err);
    process.exit(1);
  }
}

start();

module.exports = app;
