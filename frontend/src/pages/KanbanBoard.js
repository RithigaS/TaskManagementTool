import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useAuth } from '../context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Clock, MoreVertical, Trash2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const KanbanBoard = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', status: 'todo' });
  const [ws, setWs] = useState(null);

  const columns = {
    todo: { title: 'To Do', color: 'bg-blue-500' },
    in_progress: { title: 'In Progress', color: 'bg-yellow-500' },
    done: { title: 'Done', color: 'bg-green-500' },
  };

  useEffect(() => {
    fetchProject();
    fetchTasks();
    fetchActivities();
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [projectId]);

  const connectWebSocket = () => {
    if (!user) return;
    
    const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const websocket = new WebSocket(`${wsUrl}/ws/${user.id}`);

    websocket.onopen = () => {
      console.log('WebSocket connected');
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    websocket.onclose = () => {
      console.log('WebSocket disconnected');
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (user) connectWebSocket();
      }, 3000);
    };

    setWs(websocket);
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'task_created':
        fetchTasks();
        toast.success('A new task was added');
        break;
      case 'task_updated':
        fetchTasks();
        break;
      case 'task_deleted':
        fetchTasks();
        toast.info('A task was deleted');
        break;
      case 'activity':
        fetchActivities();
        break;
      default:
        break;
    }
  };

  const fetchProject = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}`);
      setProject(response.data);
    } catch (error) {
      toast.error('Failed to load project');
      navigate('/');
    }
  };

  const fetchTasks = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}/tasks`);
      setTasks(response.data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const fetchActivities = async () => {
    try {
      const response = await axios.get(`/projects/${projectId}/activities`);
      setActivities(response.data);
    } catch (error) {
      console.error('Failed to load activities');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`/projects/${projectId}/tasks`, newTask);
      setTasks([...tasks, response.data]);
      setIsCreateOpen(false);
      setNewTask({ title: '', description: '', status: 'todo' });
      toast.success('Task created successfully!');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await axios.delete(`/projects/${projectId}/tasks/${taskId}`);
      setTasks(tasks.filter((task) => task.id !== taskId));
      toast.success('Task deleted');
    } catch (error) {
      toast.error('Failed to delete task');
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;

    if (source.droppableId === destination.droppableId) return;

    const taskId = draggableId;
    const newStatus = destination.droppableId;

    // Optimistic update
    setTasks((prevTasks) =>
      prevTasks.map((task) => (task.id === taskId ? { ...task, status: newStatus } : task))
    );

    try {
      await axios.put(`/projects/${projectId}/tasks/${taskId}`, { status: newStatus });
    } catch (error) {
      toast.error('Failed to update task status');
      // Revert on error
      fetchTasks();
    }
  };

  const getTasksByStatus = (status) => {
    return tasks.filter((task) => task.status === status);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading board...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #f0f4f8 0%, #e8f0f7 100%)' }}>
      {/* Header */}
      <header className="glass border-b border-white/30 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" onClick={() => navigate('/')} data-testid="back-button">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{project?.name}</h1>
                <p className="text-sm text-gray-600">{project?.description}</p>
              </div>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="create-task-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Kanban Board */}
          <div className="lg:col-span-3">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="kanban-board">
                {Object.entries(columns).map(([status, column]) => (
                  <div key={status} className="flex flex-col">
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${column.color}`}></div>
                        <h3 className="text-lg font-semibold text-gray-900">{column.title}</h3>
                        <span className="text-sm text-gray-500">({getTasksByStatus(status).length})</span>
                      </div>
                    </div>

                    <Droppable droppableId={status} isDropDisabled={false}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 p-3 rounded-xl transition-colors ${
                            snapshot.isDraggingOver ? 'bg-indigo-50' : 'bg-white/50'
                          }`}
                          style={{ minHeight: '400px' }}
                          data-testid={`column-${status}`}
                        >
                          <div className="space-y-3">
                            {getTasksByStatus(status).map((task, index) => (
                              <Draggable key={task.id} draggableId={task.id} index={index}>
                                {(provided, snapshot) => (
                                  <Card
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={`cursor-move transition-shadow ${
                                      snapshot.isDragging ? 'shadow-xl' : 'shadow-sm'
                                    }`}
                                    data-testid={`task-card-${task.id}`}
                                  >
                                    <CardContent className="p-4">
                                      <div className="flex items-start justify-between mb-2">
                                        <h4 className="font-medium text-gray-900 flex-1">{task.title}</h4>
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                              <MoreVertical className="w-4 h-4" />
                                            </Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem
                                              onClick={() => handleDeleteTask(task.id)}
                                              className="text-red-600"
                                              data-testid={`delete-task-${task.id}`}
                                            >
                                              <Trash2 className="w-4 h-4 mr-2" />
                                              Delete
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
                                      {task.description && (
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
                                      )}
                                      {task.due_date && (
                                        <div className="flex items-center gap-1 text-xs text-gray-500">
                                          <Clock className="w-3 h-3" />
                                          {new Date(task.due_date).toLocaleDateString()}
                                        </div>
                                      )}
                                    </CardContent>
                                  </Card>
                                )}
                              </Draggable>
                            ))}
                          </div>
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
            <Card className="glass border-white/30" data-testid="activity-feed">
              <CardHeader>
                <CardTitle>Activity Feed</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {activities.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">No activities yet</p>
                    ) : (
                      activities.map((activity) => (
                        <div key={activity.id} className="border-l-2 border-indigo-500 pl-3 py-2">
                          <p className="text-sm text-gray-900 font-medium">{activity.details}</p>
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

      {/* Create Task Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent data-testid="create-task-dialog">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
            <DialogDescription>Add a new task to your board</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="task-title">Task Title</Label>
              <Input
                id="task-title"
                placeholder="Fix login bug"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                required
                data-testid="task-title-input"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="task-description">Description (Optional)</Label>
              <Textarea
                id="task-description"
                placeholder="Task details..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                rows={3}
                data-testid="task-description-input"
              />
            </div>
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" data-testid="submit-task-button">
              Create Task
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default KanbanBoard;
