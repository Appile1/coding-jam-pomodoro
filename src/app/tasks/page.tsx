"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { collection, doc, setDoc, getDocs, updateDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Header from "@/componets/header/header";
import Footer from "@/componets/footer/footer";
import { Plus, Trash2, CheckCircle, Clock, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Modal } from "@/componets/Modal.jsx";

interface Task {
  id: string;
  name: string;
  totalSessions: number;
  dueDate?: string;
  completedSessions: number;
  createdAt: number;
  userId: string;
}

export default function TasksPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTask, setNewTask] = useState({
    name: "",
    totalSessions: 2,
    dueDate: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);
  const [deletedTasks, setDeletedTasks] = useState<(Task & { deletedAt: number })[]>([]);
  const [showCompletedModal, setShowCompletedModal] = useState(false);
  const [showDeletedModal, setShowDeletedModal] = useState(false);
  const [loadingCompleted, setLoadingCompleted] = useState(false);
  const [loadingDeleted, setLoadingDeleted] = useState(false);

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchCompletedTasks();
      fetchDeletedTasks();
      cleanupDeletedTasks();
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

  const fetchCompletedTasks = async () => {
    if (!user) return;
    setLoadingCompleted(true);
    const tasksRef = collection(db, `users/${user.id}/completedTasks`);
    const q = query(tasksRef, orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    setCompletedTasks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Task));
    setLoadingCompleted(false);
  };

  const fetchDeletedTasks = async () => {
    if (!user) return;
    setLoadingDeleted(true);
    const tasksRef = collection(db, `users/${user.id}/deletedTasks`);
    const q = query(tasksRef, orderBy("deletedAt", "desc"));
    const querySnapshot = await getDocs(q);
    setDeletedTasks(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Task & { deletedAt: number }));
    setLoadingDeleted(false);
  };

  const cleanupDeletedTasks = async () => {
    if (!user) return;
    const now = Date.now();
    const tasksRef = collection(db, `users/${user.id}/deletedTasks`);
    const q = query(tasksRef);
    const querySnapshot = await getDocs(q);
    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      if (data.deletedAt && now - data.deletedAt > 24 * 60 * 60 * 1000) {
        await deleteDoc(doc(db, `users/${user.id}/deletedTasks`, docSnap.id));
      }
    }
    fetchDeletedTasks();
  };

  // Add this function to check if all required fields are filled
  const isFormValid = () => {
    const now = new Date();
    const selectedDate = newTask.dueDate ? new Date(newTask.dueDate) : null;
    return (
      newTask.name.trim() !== "" && 
      newTask.totalSessions > 0 && 
      selectedDate !== null && 
      selectedDate > now
    );
  };

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTask.name.trim()) return;

    const task: Task = {
      id: Date.now().toString(),
      name: newTask.name,
      totalSessions: newTask.totalSessions,
      dueDate: newTask.dueDate || undefined,
      completedSessions: 0,
      createdAt: Date.now(),
      userId: user.id
    };

    try {
      const taskRef = doc(db, `users/${user.id}/tasks`, task.id);
      await setDoc(taskRef, task);
      setTasks([task, ...tasks]);
      setNewTask({ name: "", totalSessions: 2, dueDate: "" });
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
      // If task is completed, move to completedTasks
      if (updatedTask.completedSessions >= updatedTask.totalSessions) {
        await setDoc(doc(db, `users/${user.id}/completedTasks`, taskId), updatedTask);
        await deleteDoc(taskRef);
        setTasks(tasks.filter(t => t.id !== taskId));
        fetchCompletedTasks();
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!user) return;
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      const taskRef = doc(db, `users/${user.id}/tasks`, taskId);
      await setDoc(doc(db, `users/${user.id}/deletedTasks`, taskId), { ...task, deletedAt: Date.now() });
      await deleteDoc(taskRef);
      setTasks(tasks.filter(t => t.id !== taskId));
      fetchDeletedTasks();
    } catch (error) {
      console.error("Error deleting task:", error);
    }
  };

  const restoreDeletedTask = async (taskId: string) => {
    if (!user) return;
    const task = deletedTasks.find(t => t.id === taskId);
    if (!task) return;
    try {
      // Move back to active tasks
      const { deletedAt, ...rest } = task;
      await setDoc(doc(db, `users/${user.id}/tasks`, taskId), rest);
      await deleteDoc(doc(db, `users/${user.id}/deletedTasks`, taskId));
      fetchTasks();
      fetchDeletedTasks();
    } catch (error) {
      console.error("Error restoring task:", error);
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
          <div className="flex justify-end gap-4 mb-4">
            <button onClick={() => setShowCompletedModal(true)} className="px-4 py-2 bg-green-100 text-green-700 rounded hover:bg-green-200 font-medium shadow">
              View Completed Tasks
            </button>
            <button onClick={() => setShowDeletedModal(true)} className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200 font-medium shadow">
              View Deleted Tasks
            </button>
          </div>
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
                  Number of Sessions
                </label>
                <input
                  type="number"
                  value={newTask.totalSessions}
                  onChange={(e) => setNewTask({ ...newTask, totalSessions: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1"
                  step="1"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Due Date (Required)
                </label>
                <input
                  type="datetime-local"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min={new Date().toISOString().slice(0, 16)}
                  required
                />
                {newTask.dueDate && new Date(newTask.dueDate) <= new Date() && (
                  <p className="text-red-500 text-xs mt-1">Please select a future date and time</p>
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={!isFormValid()}
              className={`mt-4 w-full py-2 px-4 rounded-md transition-colors flex items-center justify-center ${
                isFormValid()
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
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
                          {task.totalSessions} sessions
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
          {/* Completed Tasks Modal */}
          {showCompletedModal && (
            <Modal onClose={() => setShowCompletedModal(false)} title="Completed Tasks">
              {loadingCompleted ? (
                <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div></div>
              ) : completedTasks.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No completed tasks yet.</div>
              ) : (
                <ul className="space-y-3">
                  {completedTasks.map(task => (
                    <li key={task.id} className="bg-green-50 p-3 rounded shadow flex flex-col">
                      <span className="font-semibold text-green-800">{task.name}</span>
                      <span className="text-xs text-gray-500">{task.totalSessions} sessions</span>
                    </li>
                  ))}
                </ul>
              )}
            </Modal>
          )}
          {/* Deleted Tasks Modal */}
          {showDeletedModal && (
            <Modal onClose={() => setShowDeletedModal(false)} title="Deleted Tasks (removed after 24h)">
              {loadingDeleted ? (
                <div className="flex justify-center items-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-red-500"></div></div>
              ) : deletedTasks.length === 0 ? (
                <div className="text-gray-500 text-center py-8">No recently deleted tasks.</div>
              ) : (
                <ul className="space-y-3">
                  {deletedTasks.map(task => (
                    <li key={task.id} className="bg-red-50 p-3 rounded shadow flex flex-col">
                      <span className="font-semibold text-red-800">{task.name}</span>
                      <span className="text-xs text-gray-500">{task.totalSessions} sessions</span>
                      <span className="text-xs text-gray-400">Deleted: {format(new Date(task.deletedAt), "MMM d, yyyy h:mm a")}</span>
                      <button
                        onClick={() => restoreDeletedTask(task.id)}
                        className="mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-xs font-medium self-end"
                      >
                        Restore
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="text-xs text-gray-400 mt-4">Tasks are permanently deleted after 24 hours.</div>
            </Modal>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
} 