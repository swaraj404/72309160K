import express from "express";
import dotenv from "dotenv";
import { configureLogger, Log } from "logging_middleware";
import notificationsRouter from "./routes/notification";
import priorityRouter from "./routes/priority";

dotenv.config();

const app = express();
// allow the Stage 7 frontend on localhost:3000 to call our API (simple CORS)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3000");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
const PORT = parseInt(process.env.PORT || "5000", 10);
const AUTH_TOKEN = process.env.AUTH_TOKEN;
const EVAL_API_BASE = process.env.EVAL_API_BASE || "http://4.224.186.213";

if (!AUTH_TOKEN) {
  throw new Error("AUTH_TOKEN is required in .env file");
}

configureLogger(AUTH_TOKEN, EVAL_API_BASE);

app.use(express.json());

// Health check route
app.get("/health", async (req, res) => {
  try {
    await Log("backend", "info", "route", "health check called");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Error in health route:", err);
    res.status(500).json({ error: "internal server error" });
  }
});

// Notifications API
app.use("/notifications", notificationsRouter);
// Priority top-10 API for Stage 7 frontend
app.use("/priority", priorityRouter);

// Server start
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  Log("backend", "info", "route", "server started").catch(console.error);
});