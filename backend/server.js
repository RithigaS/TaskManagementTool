// ✅ server.js — Final version (Backend for Kanban app)
const fs = require("fs");

// --- Load environment variables ---
if (fs.existsSync(__dirname + "/.env.local")) {
  require("dotenv").config({ path: __dirname + "/.env.local" });
  console.log("Loaded environment from .env.local");
} else {
  require("dotenv").config();
  console.log("Loaded environment from .env");
}

const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const app = express();
app.use(express.json());

// --- CORS setup ---
const CORS_ORIGINS = process.env.CORS_ORIGINS || "http://localhost:3000";
const allowedOrigins =
  CORS_ORIGINS === "*" ? ["*"] : CORS_ORIGINS.split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// --- Config ---
const MONGO_URL = process.env.MONGO_URL || "mongodb://127.0.0.1:27017";
const DB_NAME = process.env.DB_NAME || "kanban_board";
const SECRET_KEY =
  process.env.SECRET_KEY || "kanban-secret-key-change-in-production";
const PORT = process.env.PORT || 8000;

// --- MongoDB Connection ---
let db;
let client;

async function connectDb() {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);

  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  await db.collection("projects").createIndex({ id: 1 }, { unique: true });
  await db.collection("tasks").createIndex({ id: 1 }, { unique: true });

  console.log("✅ Connected to MongoDB:", DB_NAME);
}

// --- JWT Middleware ---
function authMiddleware(req, res, next) {
  const auth = req.headers["authorization"];
  if (!auth) return res.status(401).json({ detail: "Not authenticated" });
  const parts = auth.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer")
    return res.status(401).json({ detail: "Invalid auth header" });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, SECRET_KEY);
    req.userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ detail: "Invalid token" });
  }
}

// --- Health Check ---
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// --- Auth Routes ---
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password)
      return res.status(400).json({ detail: "Missing fields" });

    const hashed = await bcrypt.hash(password, 10);
    const user = {
      id: crypto.randomUUID(),
      email,
      name,
      password: hashed,
      created_at: new Date().toISOString(),
    };

    await db.collection("users").insertOne(user);
    const token = jwt.sign({ sub: user.id }, SECRET_KEY, { expiresIn: "30d" });
    const userOut = {
      id: user.id,
      email,
      name: user.name,
      created_at: user.created_at,
    };

    return res.json({
      access_token: token,
      token_type: "bearer",
      user: userOut,
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ detail: "Email already registered" });
    console.error("Signup error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await db.collection("users").findOne({ email });
    if (!user)
      return res.status(401).json({ detail: "Invalid email or password" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(401).json({ detail: "Invalid email or password" });

    const token = jwt.sign({ sub: user.id }, SECRET_KEY, { expiresIn: "30d" });
    const userOut = { id: user.id, email: user.email, name: user.name };

    return res.json({
      access_token: token,
      token_type: "bearer",
      user: userOut,
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  const user = await db
    .collection("users")
    .findOne({ id: req.userId }, { projection: { password: 0, _id: 0 } });
  if (!user) return res.status(404).json({ detail: "User not found" });
  res.json(user);
});

// --- Projects Routes ---
app.get("/api/projects", authMiddleware, async (req, res) => {
  try {
    const projects = await db
      .collection("projects")
      .find({ members: req.userId })
      .project({ _id: 0 })
      .toArray();
    res.json(projects);
  } catch (err) {
    console.error("List projects error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

app.post("/api/projects", authMiddleware, async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || title.trim() === "")
      return res.status(400).json({ detail: "Project name is required" });

    const newProject = {
      id: crypto.randomUUID(),
      title,
      description: description || "",
      created_at: new Date().toISOString(),
      members: [req.userId],
    };

    await db.collection("projects").insertOne(newProject);

    // ✅ Activity log: Project created
    await db.collection("activities").insertOne({
      id: crypto.randomUUID(),
      project_id: newProject.id,
      user_id: req.userId,
      action: "Created project",
      details: `Project "${title}" created`,
      created_at: new Date().toISOString(),
    });

    res.status(201).json(newProject);
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ detail: "Server error creating project" });
  }
});

// --- Delete Project ---
app.delete("/api/projects/:projectId", authMiddleware, async (req, res) => {
  try {
    const project = await db
      .collection("projects")
      .findOne({ id: req.params.projectId });

    if (!project) return res.status(404).json({ detail: "Project not found" });

    await db.collection("projects").deleteOne({ id: req.params.projectId });
    await db
      .collection("tasks")
      .deleteMany({ project_id: req.params.projectId });
    await db
      .collection("activities")
      .deleteMany({ project_id: req.params.projectId });

    await db.collection("activities").insertOne({
      id: crypto.randomUUID(),
      project_id: req.params.projectId,
      user_id: req.userId,
      action: "Project deleted",
      created_at: new Date().toISOString(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Delete project error:", err);
    res.status(500).json({ detail: "Server error deleting project" });
  }
});

// --- Tasks Routes ---
app.get("/api/projects/:projectId/tasks", authMiddleware, async (req, res) => {
  try {
    const tasks = await db
      .collection("tasks")
      .find({ project_id: req.params.projectId })
      .project({ _id: 0 })
      .toArray();
    res.json(tasks);
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

app.post("/api/projects/:projectId/tasks", authMiddleware, async (req, res) => {
  try {
    const { title, description, status } = req.body;
    if (!title || title.trim() === "")
      return res.status(400).json({ detail: "Task title required" });

    const normalizedStatus =
      status === "in_progress" || status === "done" ? status : "todo";

    const newTask = {
      id: crypto.randomUUID(),
      title,
      description: description || "",
      status: normalizedStatus,
      project_id: req.params.projectId,
      created_at: new Date().toISOString(),
    };

    await db.collection("tasks").insertOne(newTask);

    // ✅ Activity log: Task created
    await db.collection("activities").insertOne({
      id: crypto.randomUUID(),
      project_id: req.params.projectId,
      user_id: req.userId,
      action: "Created task",
      details: `Task "${title}" added to project`,
      created_at: new Date().toISOString(),
    });

    res.status(201).json(newTask);
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ detail: "Server error creating task" });
  }
});

// --- Activities Routes ---
app.get(
  "/api/projects/:projectId/activities",
  authMiddleware,
  async (req, res) => {
    try {
      const activities = await db
        .collection("activities")
        .find({ project_id: req.params.projectId })
        .sort({ created_at: -1 })
        .limit(50)
        .project({ _id: 0 })
        .toArray();
      res.json(activities);
    } catch (err) {
      console.error("Activities error:", err);
      res.status(500).json({ detail: "Server error" });
    }
  }
);

app.post(
  "/api/projects/:projectId/activities",
  authMiddleware,
  async (req, res) => {
    try {
      const { action, details } = req.body;
      const newActivity = {
        id: crypto.randomUUID(),
        project_id: req.params.projectId,
        user_id: req.userId,
        action,
        details: details || "",
        created_at: new Date().toISOString(),
      };
      await db.collection("activities").insertOne(newActivity);
      res.status(201).json(newActivity);
    } catch (err) {
      console.error("Create activity error:", err);
      res.status(500).json({ detail: "Server error creating activity" });
    }
  }
);

// --- Single Project ---
app.get("/api/projects/:projectId", authMiddleware, async (req, res) => {
  try {
    const project = await db
      .collection("projects")
      .findOne({ id: req.params.projectId }, { projection: { _id: 0 } });
    if (!project) return res.status(404).json({ detail: "Project not found" });
    res.json(project);
  } catch (err) {
    console.error("Get project error:", err);
    res.status(500).json({ detail: "Server error" });
  }
});

// --- Update Task ---
app.put(
  "/api/projects/:projectId/tasks/:taskId",
  authMiddleware,
  async (req, res) => {
    try {
      const updates = {};
      if (req.body.title !== undefined) updates.title = req.body.title;
      if (req.body.description !== undefined)
        updates.description = req.body.description;
      if (req.body.status !== undefined) {
        const validStatuses = ["todo", "in_progress", "done"];
        updates.status = validStatuses.includes(req.body.status)
          ? req.body.status
          : "todo";
      }

      const result = await db
        .collection("tasks")
        .findOneAndUpdate(
          { id: req.params.taskId, project_id: req.params.projectId },
          { $set: updates },
          { returnDocument: "after", projection: { _id: 0 } }
        );

      if (!result.value)
        return res.status(404).json({ detail: "Task not found" });

      // ✅ Activity log: Task updated
      await db.collection("activities").insertOne({
        id: crypto.randomUUID(),
        project_id: req.params.projectId,
        user_id: req.userId,
        action: "Updated task",
        details: `Task "${result.value.title}" updated`,
        created_at: new Date().toISOString(),
      });

      res.json(result.value);
    } catch (err) {
      console.error("Update task error:", err);
      res.status(500).json({ detail: "Server error updating task" });
    }
  }
);

// --- Delete Task ---
app.delete(
  "/api/projects/:projectId/tasks/:taskId",
  authMiddleware,
  async (req, res) => {
    try {
      const result = await db
        .collection("tasks")
        .deleteOne({ id: req.params.taskId, project_id: req.params.projectId });

      if (result.deletedCount === 0)
        return res.status(404).json({ detail: "Task not found" });

      // ✅ Activity log: Task deleted
      await db.collection("activities").insertOne({
        id: crypto.randomUUID(),
        project_id: req.params.projectId,
        user_id: req.userId,
        action: "Deleted task",
        details: `Task "${req.params.taskId}" removed`,
        created_at: new Date().toISOString(),
      });

      res.json({ success: true });
    } catch (err) {
      console.error("Delete task error:", err);
      res.status(500).json({ detail: "Server error deleting task" });
    }
  }
);

// --- WebSocket Setup ---
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  ws.on("message", (msg) => console.log("WS message:", msg.toString()));
});

// --- Start Server + Auto-normalize old data ---
(async () => {
  try {
    await connectDb();

    const tasks = db.collection("tasks");
    const allTasks = await tasks.find({}).toArray();
    for (const t of allTasks) {
      const validStatuses = ["todo", "in_progress", "done"];
      if (!validStatuses.includes(t.status)) {
        await tasks.updateOne({ id: t.id }, { $set: { status: "todo" } });
      }
    }

    server.listen(PORT, "0.0.0.0", () =>
      console.log(`🚀 Server running at http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
