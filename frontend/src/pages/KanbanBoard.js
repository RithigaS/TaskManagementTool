import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useAuth } from "../context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Plus, Clock, MoreVertical, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || "http://localhost:8000";

const KanbanBoard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo",
  });

  const STATUS = {
    TODO: "todo",
    IN_PROGRESS: "in_progress",
    DONE: "done",
  };

  const columns = {
    [STATUS.TODO]: { title: "To Do", color: "bg-blue-500" },
    [STATUS.IN_PROGRESS]: { title: "In Progress", color: "bg-yellow-500" },
    [STATUS.DONE]: { title: "Done", color: "bg-green-500" },
  };

  useEffect(() => {
    if (token) {
      axios.defaults.baseURL = `${BACKEND_URL}/api`;
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    }
  }, [token]);

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchActivities();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}`);
      setProject(response.data);
    } catch {
      toast.error("Failed to load project");
      navigate("/");
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}/tasks`);
      const data = Array.isArray(response.data) ? response.data : [];
      const normalized = data.map((t) => ({
        ...t,
        status:
          t.status && ["todo", "in_progress", "done"].includes(t.status)
            ? t.status
            : "todo",
      }));
      setTasks(normalized);
    } catch {
      toast.error("Failed to load tasks");
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}/activities`);
      setActivities(response.data || []);
    } catch {
      console.error("Failed to load activities");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `/projects/${projectId}/tasks`,
        newTask
      );
      setTasks((prev) => [...prev, response.data]);
      setIsCreateOpen(false);
      setNewTask({ title: "", description: "", status: STATUS.TODO });
      toast.success("Task created successfully!");
    } catch {
      toast.error("Failed to create task");
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`/projects/${projectId}/tasks/${taskId}`);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    if (source.droppableId === destination.droppableId) return;

    const taskId = draggableId;
    const newStatus = destination.droppableId;

    setTasks((prev) =>
      prev.map((t) =>
        String(t.id) === taskId ? { ...t, status: newStatus } : t
      )
    );

    try {
      await axios.put(`/projects/${projectId}/tasks/${taskId}`, {
        status: newStatus,
      });
    } catch (error) {
      console.error("Failed to update:", error);
      toast.error("Failed to update task status");
      fetchTasks();
    }
  };

  const getTasksByStatus = (status) => tasks.filter((t) => t.status === status);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading board...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "linear-gradient(135deg, #f0f4f8 0%, #e8f0f7 100%)",
      }}
    >
      {/* Header */}
      <header className="glass border-b border-white/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate("/")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {project?.title || "Untitled Project"}
                </h1>
                <p className="text-sm text-gray-600">
                  {project?.description || "No description"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Kanban Columns */}
          <div className="lg:col-span-3">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.entries(columns).map(([status, column]) => (
                  <div key={status} className="flex flex-col">
                    <div className="mb-4 flex items-center gap-2">
                      <div
                        className={`w-3 h-3 rounded-full ${column.color}`}
                      ></div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {column.title}
                      </h3>
                      <span className="text-sm text-gray-500">
                        ({getTasksByStatus(status).length})
                      </span>
                    </div>

                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-3 rounded-xl transition-colors ${
                            snapshot.isDraggingOver
                              ? "bg-indigo-50"
                              : "bg-white/50"
                          }`}
                          style={{ minHeight: "400px" }}
                        >
                          {getTasksByStatus(status).map((task, index) => (
                            <Draggable
                              key={String(task.id)}
                              draggableId={String(task.id)}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`cursor-move transition-shadow ${
                                    snapshot.isDragging
                                      ? "shadow-xl"
                                      : "shadow-sm"
                                  }`}
                                >
                                  <CardContent className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <h4 className="font-medium text-gray-900 flex-1">
                                        {task.title}
                                      </h4>
                                      <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0"
                                          >
                                            <MoreVertical className="w-4 h-4" />
                                          </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                          <DropdownMenuItem
                                            onClick={() =>
                                              handleDeleteTask(task.id)
                                            }
                                            className="text-red-600"
                                          >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Delete
                                          </DropdownMenuItem>
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    </div>
                                    {task.description && (
                                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                        {task.description}
                                      </p>
                                    )}
                                    {task.due_date && (
                                      <div className="flex items-center gap-1 text-xs text-gray-500">
                                        <Clock className="w-3 h-3" />
                                        {new Date(
                                          task.due_date
                                        ).toLocaleDateString()}
                                      </div>
                                    )}
                                  </CardContent>
                                </Card>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </DragDropContext>
          </div>

          {/* Activity Feed */}
          <div className="lg:col-span-1">
            <Card className="glass border-white/30">
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {activities.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No activities yet
                      </p>
                    ) : (
                      activities.map((activity) => (
                        <div
                          key={activity.id}
                          className="border-l-2 border-indigo-500 pl-3 py-2"
                        >
                          <p className="text-sm text-gray-900 font-medium">
                            {activity.details}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(activity.created_at).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Create Task Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to your board</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Task Title</Label>
              <Input
                placeholder="Fix login bug"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask({ ...newTask, title: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Description (Optional)</Label>
              <Textarea
                placeholder="Task details..."
                value={newTask.description}
                onChange={(e) =>
                  setNewTask({ ...newTask, description: e.target.value })
                }
                rows={3}
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              Create Task
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KanbanBoard;
