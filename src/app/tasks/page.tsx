"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Header from "@/componets/header/header";
import Footer from "@/componets/footer/footer";
import { Plus, Trash2, CheckCircle, Clock, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";

interface Task {
  id: string;
  name: string;
  duration: number; // in hours
  dueDate?: string;
  completedSessions: number;
  totalSessions: number;
  createdAt: number;
  userId: string;
}

export default function TasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({
    name: "",
    duration: 1,
    dueDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const tasksRef = collection(db, `users/${user.id}/tasks`);
      const q = query(tasksRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      
      const tasksData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      
      setTasks(tasksData);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTask.name.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      name: newTask.name,
      duration: newTask.duration,
      dueDate: newTask.dueDate || undefined,
      completedSessions: 0,
      totalSessions: Math.ceil(newTask.duration * 2), // 2 pomodoro sessions per hour
      createdAt: Date.now(),
      userId: user.id
    };

    try {
      const taskRef = doc(db, `users/${user.id}/tasks`, task.id);
      await setDoc(taskRef, task);
      setTasks([task, ...tasks]);
      setNewTask({ name: "", duration: 1, dueDate: "" });
    } catch (error) {
      console.error("Error adding task:", error);
    }
  };

  const updateTaskProgress = async (taskId: string) => {
    if (!user) return;

    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedTask = {
      ...task,
      completedSessions: task.completedSessions + 1
    };

    try {
      const taskRef = doc(db, `users/${user.id}/tasks`, taskId);
      await updateDoc(taskRef, { completedSessions: updatedTask.completedSessions });
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;

    try {
      const taskRef = doc(db, `users/${user.id}/tasks`, taskId);
      await deleteDoc(taskRef);
      setTasks(tasks.filter(t => t.id !== taskId));
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      {/* Loading Bar */}
      {isLoading && (
        <div className="fixed top-0 left-0 w-full z-50">
          <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 animate-pulse rounded-b" style={{ width: '100%' }} />
        </div>
      )}
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col items-center">
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Task Management</h1>
          
          {/* Add Task Form */}
          <form onSubmit={addTask} className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Name
                </label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter task name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (hours)
                </label>
                <input
                  type="number"
                  value={newTask.duration}
                  onChange={(e) => setNewTask({ ...newTask, duration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0.5"
                  step="0.5"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date
                </label>
                <input
                  type="datetime-local"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              type="submit"
              className="mt-4 w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Task
            </button>
          </form>

          {/* Task List */}
          <div className="space-y-4">
            {isLoading ? null : tasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No tasks yet. Add your first task above!</div>
            ) : (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {task.name}
                      </h3>
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <div className="flex items-center">
                          <Clock className="w-4 h-4 mr-1" />
                          {task.duration} hours
                        </div>
                        {task.dueDate && (
                          <div className="flex items-center">
                            <CalendarIcon className="w-4 h-4 mr-1" />
                            {format(new Date(task.dueDate), "MMM d, yyyy h:mm a")}
                          </div>
                        )}
                      </div>
                      <div className="mt-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-600">
                            Progress: {task.completedSessions} / {task.totalSessions} sessions
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {Math.round((task.completedSessions / task.totalSessions) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${(task.completedSessions / task.totalSessions) * 100}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      <button
                        onClick={() => updateTaskProgress(task.id)}
                        disabled={task.completedSessions >= task.totalSessions}
                        className={`p-2 rounded-full ${
                          task.completedSessions >= task.totalSessions
                            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                            : "bg-green-100 text-green-600 hover:bg-green-200"
                        }`}
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => deleteTask(task.id)}
                        className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 