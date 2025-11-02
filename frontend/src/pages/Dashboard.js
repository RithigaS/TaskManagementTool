import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Folder, LogOut, Layers, Trash2 } from "lucide-react";

// ✅ Base URL for all requests
axios.defaults.baseURL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";
// change this to match your backend

const Dashboard = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", description: "" });
  const { user, logout, token } = useAuth();
  const navigate = useNavigate();

  // ✅ Attach token automatically for all requests
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, [token]);

  // ✅ Load projects on page load
  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const response = await axios.get("/projects");
      setProjects(response.data || []);
    } catch (error) {
      console.error("❌ Fetch error:", error.response?.data || error.message);
      toast.error(error.response?.data?.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Create Project
  const handleCreateProject = async (e) => {
    e.preventDefault();

    if (!newProject.name.trim()) {
      toast.error("Project name is required");
      return;
    }

    try {
      // 👇 Adjust payload according to your backend model
      const payload = {
        title: newProject.name, // ← if your backend uses 'name', change this to name
        description: newProject.description,
      };

      console.log("📤 Sending payload:", payload);

      const response = await axios.post("/projects", payload, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        withCredentials: true,
      });

      console.log("✅ Project created:", response.data);

      setProjects((prev) => [response.data, ...prev]);
      setIsCreateOpen(false);
      setNewProject({ name: "", description: "" });
      toast.success("Project created successfully!");
    } catch (error) {
      console.error(
        "❌ Project creation failed:",
        error.response || error.message
      );

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.response?.data ||
        "Failed to create project";

      toast.error(`Project creation failed: ${message}`);
    }
  };

  // ✅ Delete Project
  const handleDeleteProject = async (id) => {
    if (!window.confirm("Are you sure you want to delete this project?"))
      return;

    try {
      await axios.delete(`/projects/${id}`);
      setProjects((prev) => prev.filter((project) => project.id !== id));
      toast.success("Project deleted successfully!");
    } catch (error) {
      console.error("❌ Delete error:", error.response?.data || error.message);
      toast.error("Failed to delete project");
    }
  };

  // ✅ Logout
  const handleLogout = () => {
    logout();
    navigate("/auth");
    toast.success("Logged out successfully");
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #f0f4f8 0%, #e8f0f7 100%)",
      }}
    >
      {/* Header */}
      <header className="glass border-b border-white/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">TaskFlow</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-gray-900">
                {user?.name || "User"}
              </p>
              <p className="text-xs text-gray-500">{user?.email}</p>
            </div>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header + New Project Button */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900">Your Projects</h2>
            <p className="text-gray-600 mt-1">
              Manage and organize your team's work
            </p>
          </div>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
                <DialogDescription>
                  Add a new project to organize your tasks.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateProject} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project-name">Project Name</Label>
                  <Input
                    id="project-name"
                    placeholder="Website Redesign"
                    value={newProject.name}
                    onChange={(e) =>
                      setNewProject({ ...newProject, name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="project-description">Description</Label>
                  <Textarea
                    id="project-description"
                    placeholder="Project goals and details..."
                    value={newProject.description}
                    onChange={(e) =>
                      setNewProject({
                        ...newProject,
                        description: e.target.value,
                      })
                    }
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                >
                  Create Project
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Projects list */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-500">Loading projects...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No projects yet
            </h3>
            <p className="text-gray-500 mb-6">
              Create your first project to get started.
            </p>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="card-hover cursor-pointer glass border-white/30 relative"
              >
                <button
                  onClick={() => handleDeleteProject(project.id)}
                  className="absolute top-3 right-3 text-gray-400 hover:text-red-600 transition"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <CardHeader
                  onClick={() => navigate(`/project/${project.id}`)}
                  className="cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-3">
                      <Folder className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">
                    {project.name || project.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {project.description || "No description provided"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-500">
                    Created{" "}
                    {project.created_at
                      ? new Date(project.created_at).toLocaleDateString()
                      : "N/A"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
