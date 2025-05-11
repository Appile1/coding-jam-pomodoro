"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Header from "@/componets/header/header";
import Footer from "@/componets/footer/footer";
import { format, addMinutes, isWithinInterval, startOfDay, endOfDay, startOfWeek, addDays, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Task {
  id: string;
  name: string;
  duration: number;
  dueDate?: string;
  completedSessions: number;
  totalSessions: number;
  createdAt: number;
  userId: string;
  tags?: string[];
}

interface TimeBlock {
  startTime: Date;
  endTime: Date;
  task: Task;
  type: "focus" | "break";
}

export default function CalendarPage() {
  const { user } = useUser();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [viewMode, setViewMode] = useState<"daily" | "weekly">("daily");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [completedTasks, setCompletedTasks] = useState<Task[]>([]);

  // Generate time slots for full 24 hours
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

  useEffect(() => {
    if (user) {
      fetchTasks();
      fetchCompletedTasks();
    }
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

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
      generateTimeBlocks(tasksData);
    } catch (error) {
      console.error("Error fetching tasks:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCompletedTasks = async () => {
    if (!user) return;
    try {
      const tasksRef = collection(db, `users/${user.id}/completedTasks`);
      const q = query(tasksRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const completed = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Task[];
      setCompletedTasks(completed);
    } catch (error) {
      console.error("Error fetching completed tasks:", error);
    }
  };

  const getWeekDays = () => {
    const start = startOfWeek(selectedDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const generateTimeBlocks = (tasksData: Task[]) => {
    const blocks: TimeBlock[] = [];
    const weekDays = viewMode === "weekly" ? getWeekDays() : [selectedDate];

    weekDays.forEach(day => {
      let currentTime = new Date(day.setHours(8, 0, 0, 0)); // Start at 8 AM

      tasksData.forEach(task => {
        if (task.completedSessions >= task.totalSessions) return;
        const remainingSessions = task.totalSessions - task.completedSessions;
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;

        for (let i = 0; i < remainingSessions; i++) {
          // Add focus session
          const focusStart = new Date(currentTime);
          const focusEnd = addMinutes(focusStart, 25);
          if (dueDate && focusEnd > dueDate) break;
          blocks.push({
            startTime: focusStart,
            endTime: focusEnd,
            task,
            type: "focus"
          });
          // Add break session
          const breakStart = focusEnd;
          const breakEnd = addMinutes(breakStart, 5);
          blocks.push({
            startTime: breakStart,
            endTime: breakEnd,
            task,
            type: "break"
          });
          currentTime = breakEnd;
        }
      });
    });
    setTimeBlocks(blocks);
  };

  const isCurrentTimeBlock = (block: TimeBlock) => {
    return isWithinInterval(currentTime, {
      start: block.startTime,
      end: block.endTime
    });
  };

  const getBlockColor = (block: TimeBlock) => {
    if (isCurrentTimeBlock(block)) {
      return "bg-green-100 border-green-500";
    }
    return block.type === "focus" ? "bg-orange-100 border-orange-500" : "bg-gray-100 border-gray-500";
  };

  const isTaskInTimeSlot = (task: Task, timeSlot: string) => {
    if (!task.dueDate) return false;
    const taskDate = new Date(task.dueDate);
    const [hours, minutes] = timeSlot.split(":").map(Number);
    const slotDate = new Date(selectedDate);
    slotDate.setHours(hours, minutes, 0, 0);
    
    // Check if task is due on the selected date
    if (!isSameDay(taskDate, slotDate)) return false;

    // If task is due at this exact time, show it
    if (taskDate.getHours() === hours && taskDate.getMinutes() === minutes) {
      return true;
    }

    // If task is due before this time slot, show it in the current slot
    if (taskDate < slotDate) {
      return true;
    }

    return false;
  };

  const getTasksForDayAndTimeSlot = (day: Date, timeSlot: string) => {
    const [hours, minutes] = timeSlot.split(":").map(Number);
    const slotStart = new Date(day);
    slotStart.setHours(hours, minutes, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + 30);
    const allTasks = [...tasks, ...completedTasks];
    return allTasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return (
        taskDate >= slotStart &&
        taskDate < slotEnd &&
        taskDate.getFullYear() === slotStart.getFullYear() &&
        taskDate.getMonth() === slotStart.getMonth() &&
        taskDate.getDate() === slotStart.getDate()
      );
    });
  };

  const getRemainingSessions = (task: Task) => {
    return task.totalSessions - task.completedSessions;
  };

  const formatTimeDisplay = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    return format(date, "h:mm a");
  };

  // Helper to get the earliest and latest due times for the current view
  const getRelevantTimeSlots = () => {
    let relevantTasks: Task[] = [];
    if (viewMode === "weekly") {
      const weekDays = getWeekDays();
      relevantTasks = tasks.filter(task =>
        weekDays.some(day => {
          const taskDate = task.dueDate ? new Date(task.dueDate) : null;
          return taskDate && isSameDay(taskDate, day);
        })
      );
    } else {
      relevantTasks = tasks.filter(task => {
        const taskDate = task.dueDate ? new Date(task.dueDate) : null;
        return taskDate && isSameDay(taskDate, selectedDate);
      });
    }
    if (relevantTasks.length === 0) return timeSlots;
    const times = relevantTasks.map(task => {
      const d = new Date(task.dueDate!);
      return d.getHours() * 60 + d.getMinutes();
    });
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    // Find the closest slot before minTime and after maxTime
    let startIdx = 0;
    let endIdx = timeSlots.length - 1;
    for (let i = 0; i < timeSlots.length; i++) {
      const [h, m] = timeSlots[i].split(":").map(Number);
      const mins = h * 60 + m;
      if (mins <= minTime) startIdx = i;
      if (mins >= maxTime && endIdx === timeSlots.length - 1) endIdx = i;
    }
    return timeSlots.slice(startIdx, endIdx + 1);
  };

  // Helper to check if a task is overdue
  const isTaskOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    return new Date(task.dueDate) < new Date();
  };

  // Helper to check if a task is completed
  const isTaskCompleted = (task: Task) => {
    return completedTasks.some(t => t.id === task.id);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-2 md:px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setViewMode("daily")}
                className={`px-4 py-2 rounded-md ${
                  viewMode === "daily"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Daily View
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`px-4 py-2 rounded-md ${
                  viewMode === "weekly"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Weekly View
              </button>
            </div>
          </div>

          {/* Date Navigation */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, -1))}
              className="p-2 hover:bg-gray-200 rounded-full"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-semibold">
              {viewMode === "weekly"
                ? `${format(startOfWeek(selectedDate), "MMM d")} - ${format(addDays(startOfWeek(selectedDate), 6), "MMM d, yyyy")}`
                : format(selectedDate, "MMMM d, yyyy")}
            </h2>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-gray-200 rounded-full"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {(isLoading || !user) && (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
            </div>
          )}
          {!isLoading && user && tasks.length === 0 && completedTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CalendarIcon className="h-12 w-12 mb-2" />
              <div className="text-lg font-semibold">No tasks or completed tasks for this period.</div>
              <div className="text-sm">Add a task to get started!</div>
            </div>
          )}
          {!isLoading && user && (tasks.length > 0 || completedTasks.length > 0) && (
            <AnimatePresence>
              {viewMode === "weekly" ? (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }} className="bg-white rounded-lg shadow-lg overflow-x-auto">
                  <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b sticky top-0 bg-white z-10">
                    <div className="p-2 font-medium text-gray-500 border-r">Time</div>
                    {getWeekDays().map((day, idx) => (
                      <div key={idx} className={`p-2 font-medium text-center text-gray-700 border-r ${isSameDay(day, new Date()) ? "bg-blue-50 text-blue-700" : ""}`}>
                        {format(day, "EEE d")}
                      </div>
                    ))}
                  </div>
                  <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
                    {getRelevantTimeSlots().map((timeSlot, rowIdx) => (
                      <div key={timeSlot} className="grid grid-cols-[80px_repeat(7,1fr)] min-h-[48px] border-b hover:bg-gray-50">
                        <div className="p-2 text-xs text-gray-500 border-r sticky left-0 bg-white z-10 font-medium flex items-center justify-end">
                          {formatTimeDisplay(timeSlot)}
                        </div>
                        {getWeekDays().map((day, colIdx) => {
                          const tasksInSlot = getTasksForDayAndTimeSlot(day, timeSlot);
                          const isCurrentSlot = isSameDay(day, new Date()) && new Date().getHours() === parseInt(timeSlot.split(":")[0]);
                          return (
                            <div key={colIdx} className={`p-1 md:p-2 border-r min-h-[48px] ${isCurrentSlot ? "bg-blue-50" : ""}`}> 
                              {tasksInSlot.map(task => (
                                <div
                                  key={task.id}
                                  className={`mb-1 p-2 rounded-md border transition-shadow text-xs md:text-sm flex items-center justify-between
                                    ${isTaskCompleted(task)
                                      ? "bg-green-100 border-green-200 text-green-900 opacity-80 line-through"
                                      : "bg-blue-100 border-blue-200 hover:shadow-md"}
                                    ${isTaskOverdue(task) ? "opacity-60 line-through" : ""}`}
                                >
                                  <div>
                                    <div className="font-semibold truncate flex items-center gap-1">
                                      {task.name}
                                      {isTaskCompleted(task) && <span className="ml-1 text-green-600">✔</span>}
                                    </div>
                                    {task.tags && task.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                        {task.tags.map(tag => (
                                          <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-200 text-blue-800 border border-blue-300">{tag}</span>
                                        ))}
                                      </div>
                                    )}
                                    <div className="text-[10px] text-blue-600 mt-1">
                                      Due: {format(new Date(task.dueDate!), "h:mm a")}
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                      <div
                                        className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                                        style={{ width: `${(task.completedSessions / task.totalSessions) * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                  {isTaskOverdue(task) && (
                                    <button className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 border border-yellow-300">Reschedule</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }} className="bg-white rounded-lg shadow-lg overflow-hidden">
                  <div className="grid grid-cols-[80px_1fr] border-b sticky top-0 bg-white z-10">
                    <div className="p-2 font-medium text-gray-500">Time</div>
                    <div className="p-2 font-medium text-gray-500">Tasks</div>
                  </div>
                  <div className="divide-y max-h-[calc(100vh-300px)] overflow-y-auto">
                    {getRelevantTimeSlots().map((timeSlot) => {
                      const tasksInSlot = getTasksForDayAndTimeSlot(selectedDate, timeSlot);
                      const isCurrentHour = new Date().getHours() === parseInt(timeSlot.split(":")[0]);
                      return (
                        <div key={timeSlot} className={`grid grid-cols-[80px_1fr] min-h-[48px] border-b hover:bg-gray-50 ${isCurrentHour ? "bg-blue-50" : ""}`}>
                          <div className="p-2 text-xs text-gray-500 border-r font-medium flex items-center justify-end">
                            {formatTimeDisplay(timeSlot)}
                          </div>
                          <div className="p-2">
                            {tasksInSlot.map(task => (
                              <div
                                key={task.id}
                                className={`mb-2 p-2 rounded-md border transition-shadow text-xs md:text-sm flex items-center justify-between
                                  ${isTaskCompleted(task)
                                    ? "bg-green-100 border-green-200 text-green-900 opacity-80 line-through"
                                    : "bg-blue-100 border-blue-200 hover:shadow-md"}
                                  ${isTaskOverdue(task) ? "opacity-60 line-through" : ""}`}
                              >
                                <div>
                                  <div className="font-semibold truncate flex items-center gap-1">
                                    {task.name}
                                    {isTaskCompleted(task) && <span className="ml-1 text-green-600">✔</span>}
                                  </div>
                                  {task.tags && task.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1 mb-1">
                                      {task.tags.map(tag => (
                                        <span key={tag} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-200 text-blue-800 border border-blue-300">{tag}</span>
                                      ))}
                                    </div>
                                  )}
                                  <div className="text-[10px] text-blue-600 mt-1">
                                    Due: {format(new Date(task.dueDate!), "h:mm a")}
                                  </div>
                                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                                    <div
                                      className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                                      style={{ width: `${(task.completedSessions / task.totalSessions) * 100}%` }}
                                    />
                                  </div>
                                </div>
                                {isTaskOverdue(task) && (
                                  <button className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded hover:bg-yellow-300 border border-yellow-300">Reschedule</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
} 