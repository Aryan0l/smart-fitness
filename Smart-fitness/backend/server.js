const path = require("path");
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const authRoutes = require("./src/routes/authRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");
const paymentRoutes = require("./src/routes/paymentRoutes");
const { initDb } = require("./src/db/pool");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const frontendPath = path.join(__dirname, "..", "frontend");

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = [
        process.env.FRONTEND_ORIGIN,
        "http://localhost:5000",
        "http://127.0.0.1:5000",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "null"
      ].filter(Boolean);

      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, true);
    },
    credentials: true
  })
);
app.use(express.json());
app.use(express.static(frontendPath));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Smart Tracker Booster API is running" });
});

app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/payments", paymentRoutes);

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

initDb()
  .then(() => {
    console.log("Neon Postgres connected");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed:", error.message);
    process.exit(1);
  });
