require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const http = require("http");
const WebSocket = require("ws");

const app = express();
app.use(express.json());

// CORS setup
const CORS_ORIGINS = process.env.CORS_ORIGINS || "http://localhost:3000";
const allowedOrigins =
  CORS_ORIGINS === "*" ? ["*"] : CORS_ORIGINS.split(",").map((s) => s.trim());
app.use(cors({ origin: allowedOrigins, credentials: true }));

// Config
const MONGO_URL = process.env.MONGO_URL;
const DB_NAME = process.env.DB_NAME || "kanban_board";
const SECRET_KEY =
  process.env.SECRET_KEY || "kanban-secret-key-change-in-production-2024";
const PORT = process.env.PORT || 8000;

if (!MONGO_URL) {
  console.error("MONGO_URL not set in .env");
  process.exit(1);
}

let db;
const client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 10000 });

async function connectDb() {
  await client.connect();
  db = client.db(DB_NAME);
  // ensure indexes
  await db.collection("users").createIndex({ email: 1 }, { unique: true });
  // projects collection index
  await db.collection("projects").createIndex({ id: 1 }, { unique: true });
  // tasks collection index
  await db.collection("tasks").createIndex({ id: 1 }, { unique: true });
  await db.collection("tasks").createIndex({ project_id: 1 });
  // activities collection index
  await db.collection("activities").createIndex({ project_id: 1 });
  console.log("Connected to MongoDB");
}

// Simple JWT middleware
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
  } catch (err) {
    return res.status(401).json({ detail: "Invalid token" });
  }
}

// Health
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Auth
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, name, password } = req.body;
    if (!email || !name || !password)
      return res.status(400).json({ detail: "Missing fields" });
    const hashed = await bcrypt.hash(password, 10);
    const user = {
      email,
      name,
      password: hashed,
      created_at: new Date().toISOString(),
      id: require("crypto").randomUUID(),
    };
    await db.collection("users").insertOne(user);
    const token = jwt.sign({ sub: user.id }, SECRET_KEY, { expiresIn: "30d" });
    const userOut = {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    };
    return res.json({
      access_token: token,
      token_type: "bearer",
      user: userOut,
    });
  } catch (err) {
    console.error("Signup error", err);
    if (err.code === 11000)
      return res.status(400).json({ detail: "Email already registered" });
    return res.status(500).json({ detail: "Server error" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ detail: "Missing fields" });
    const user = await db.collection("users").findOne({ email });
    if (!user)
      return res.status(401).json({ detail: "Invalid email or password" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
      return res.status(401).json({ detail: "Invalid email or password" });
    const token = jwt.sign({ sub: user.id }, SECRET_KEY, { expiresIn: "30d" });
    const userOut = {
      id: user.id,
      email: user.email,
      name: user.name,
      created_at: user.created_at,
    };
    return res.json({
      access_token: token,
      token_type: "bearer",
      user: userOut,
    });
  } catch (err) {
    console.error("Login error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

app.get("/api/auth/me", authMiddleware, async (req, res) => {
  try {
    const user = await db
      .collection("users")
      .findOne({ id: req.userId }, { projection: { _id: 0, password: 0 } });
    if (!user) return res.status(404).json({ detail: "User not found" });
    return res.json(user);
  } catch (err) {
    console.error("Me error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

// Create HTTP server and WebSocket server for simple broadcasts
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });

const connections = new Map(); // userId -> [ws]

server.on("upgrade", (request, socket, head) => {
  // expect path like /api/ws/{userId}
  const url = new URL(request.url, `http://${request.headers.host}`);
  const match = url.pathname.match(/^\/api\/ws\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }
  const userId = match[1];
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, userId);
  });
});

wss.on("connection", (ws, userId) => {
  if (!connections.has(userId)) connections.set(userId, []);
  connections.get(userId).push(ws);
  ws.on("close", () => {
    const arr = connections.get(userId) || [];
    connections.set(
      userId,
      arr.filter((s) => s !== ws)
    );
  });
});

// helper to broadcast to members (expects project doc with members array)
async function broadcastToProject(projectId, message) {
  try {
    const project = await db.collection("projects").findOne({ id: projectId });
    if (!project) return;
    const members = project.members || [];
    members.forEach((userId) => {
      const arr = connections.get(userId) || [];
      arr.forEach((ws) => {
        try {
          ws.send(JSON.stringify(message));
        } catch (e) {}
      });
    });
  } catch (e) {
    console.error("Broadcast error", e);
  }
}

// Projects API
// List projects for the authenticated user
app.get("/api/projects", authMiddleware, async (req, res) => {
  try {
    const projects = await db
      .collection("projects")
      .find({ members: req.userId })
      .project({ _id: 0 })
      .toArray();
    return res.json(projects);
  } catch (err) {
    console.error("List projects error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

// Get a specific project
app.get("/api/projects/:id", authMiddleware, async (req, res) => {
  try {
    const project = await db.collection("projects").findOne(
      {
        id: req.params.id,
        members: req.userId,
      },
      { projection: { _id: 0 } }
    );
    if (!project) return res.status(404).json({ detail: "Project not found" });
    return res.json(project);
  } catch (err) {
    console.error("Get project error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

// Create a new project
app.post("/api/projects", authMiddleware, async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ detail: "Missing name" });
    const project = {
      id: require("crypto").randomUUID(),
      name,
      description: description || "",
      members: [req.userId],
      created_at: new Date().toISOString(),
    };
    await db.collection("projects").insertOne(project);
    // broadcast new project to members (simple notification)
    broadcastToProject(project.id, { type: "project.created", project });
    const out = Object.assign({}, project);
    delete out._id;
    return res.status(201).json(out);
  } catch (err) {
    console.error("Create project error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

// Tasks API
// List tasks for a project
app.get("/api/projects/:projectId/tasks", authMiddleware, async (req, res) => {
  try {
    const project = await db.collection("projects").findOne({
      id: req.params.projectId,
      members: req.userId,
    });
    if (!project) return res.status(404).json({ detail: "Project not found" });

    const tasks = await db
      .collection("tasks")
      .find({ project_id: req.params.projectId })
      .project({ _id: 0 })
      .toArray();
    return res.json(tasks);
  } catch (err) {
    console.error("List tasks error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

// Create a new task
app.post("/api/projects/:projectId/tasks", authMiddleware, async (req, res) => {
  try {
    const project = await db.collection("projects").findOne({
      id: req.params.projectId,
      members: req.userId,
    });
    if (!project) return res.status(404).json({ detail: "Project not found" });

    const { title, description, status } = req.body;
    if (!title) return res.status(400).json({ detail: "Missing title" });
    const task = {
      id: require("crypto").randomUUID(),
      project_id: req.params.projectId,
      title,
      description: description || "",
      status: status || "todo",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await db.collection("tasks").insertOne(task);
    broadcastToProject(req.params.projectId, { type: "task_created", task });
    const out = Object.assign({}, task);
    delete out._id;
    return res.status(201).json(out);
  } catch (err) {
    console.error("Create task error", err);
    return res.status(500).json({ detail: "Server error" });
  }
});

// Update a task
app.put(
  "/api/projects/:projectId/tasks/:taskId",
  authMiddleware,
  async (req, res) => {
    try {
      const project = await db.collection("projects").findOne({
        id: req.params.projectId,
        members: req.userId,
      });
      if (!project)
        return res.status(404).json({ detail: "Project not found" });

      const { status, title, description } = req.body;
      const updateData = {
        updated_at: new Date().toISOString(),
      };
      if (status !== undefined) updateData.status = status;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;

      const result = await db
        .collection("tasks")
        .updateOne(
          { id: req.params.taskId, project_id: req.params.projectId },
          { $set: updateData }
        );
      if (result.matchedCount === 0)
        return res.status(404).json({ detail: "Task not found" });

      const updatedTask = await db
        .collection("tasks")
        .findOne({ id: req.params.taskId }, { projection: { _id: 0 } });
      broadcastToProject(req.params.projectId, {
        type: "task_updated",
        task: updatedTask,
      });
      return res.json(updatedTask);
    } catch (err) {
      console.error("Update task error", err);
      return res.status(500).json({ detail: "Server error" });
    }
  }
);

// Delete a task
app.delete(
  "/api/projects/:projectId/tasks/:taskId",
  authMiddleware,
  async (req, res) => {
    try {
      const project = await db.collection("projects").findOne({
        id: req.params.projectId,
        members: req.userId,
      });
      if (!project)
        return res.status(404).json({ detail: "Project not found" });

      const result = await db.collection("tasks").deleteOne({
        id: req.params.taskId,
        project_id: req.params.projectId,
      });
      if (result.deletedCount === 0)
        return res.status(404).json({ detail: "Task not found" });

      broadcastToProject(req.params.projectId, {
        type: "task_deleted",
        taskId: req.params.taskId,
      });
      return res.status(204).send();
    } catch (err) {
      console.error("Delete task error", err);
      return res.status(500).json({ detail: "Server error" });
    }
  }
);

// Activities API
// List activities for a project
app.get(
  "/api/projects/:projectId/activities",
  authMiddleware,
  async (req, res) => {
    try {
      const project = await db.collection("projects").findOne({
        id: req.params.projectId,
        members: req.userId,
      });
      if (!project)
        return res.status(404).json({ detail: "Project not found" });

      const activities = await db
        .collection("activities")
        .find({ project_id: req.params.projectId })
        .sort({ created_at: -1 })
        .project({ _id: 0 })
        .toArray();
      return res.json(activities);
    } catch (err) {
      console.error("List activities error", err);
      return res.status(500).json({ detail: "Server error" });
    }
  }
);

// Start
(async () => {
  try {
    await connectDb();
    server.listen(PORT, "0.0.0.0", () =>
      console.log(`Server listening on port ${PORT}`)
    );
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
})();

module.exports = app;
