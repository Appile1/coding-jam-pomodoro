"use client";

import React, { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import Header from "@/componets/header/header";
import Footer from "@/componets/footer/footer";
import { format, addMinutes, isWithinInterval, startOfDay, endOfDay, startOfWeek, addDays, isSameDay } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

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

  // Generate time slots for full 24 hours
  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const hour = Math.floor(i / 2);
    const minute = i % 2 === 0 ? "00" : "30";
    return `${hour.toString().padStart(2, "0")}:${minute}`;
  });

  useEffect(() => {
    if (user) {
      fetchTasks();
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

  const getTasksForTimeSlot = (timeSlot: string) => {
    const [hours, minutes] = timeSlot.split(":").map(Number);
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      // Build a date for the slot in local time
      const slotDate = new Date(selectedDate);
      slotDate.setHours(hours, minutes, 0, 0);
      // Debug output
      // Remove or comment out after confirming fix
      // console.log('Task:', task.name, 'TaskDate:', taskDate, 'SlotDate:', slotDate);
      return (
        taskDate.getFullYear() === slotDate.getFullYear() &&
        taskDate.getMonth() === slotDate.getMonth() &&
        taskDate.getDate() === slotDate.getDate() &&
        taskDate.getHours() === slotDate.getHours() &&
        taskDate.getMinutes() === slotDate.getMinutes()
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
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
              {format(selectedDate, "MMMM d, yyyy")}
            </h2>
            <button
              onClick={() => setSelectedDate(addDays(selectedDate, 1))}
              className="p-2 hover:bg-gray-200 rounded-full"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            {/* Time Slots Header */}
            <div className="grid grid-cols-[100px_1fr] border-b">
              <div className="p-2 font-medium text-gray-500">Time</div>
              <div className="p-2 font-medium text-gray-500">Tasks</div>
            </div>

            {/* Time Slots Grid */}
            <div className="divide-y max-h-[calc(100vh-300px)] overflow-y-auto">
              {timeSlots.map((timeSlot) => {
                const tasksInSlot = getTasksForTimeSlot(timeSlot);
                const isCurrentHour = new Date().getHours() === parseInt(timeSlot.split(":")[0]);
                
                return (
                  <div 
                    key={timeSlot} 
                    className={`grid grid-cols-[100px_1fr] min-h-[60px] ${
                      isCurrentHour ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="p-2 text-sm text-gray-500 border-r flex items-center">
                      <span className="font-medium">{formatTimeDisplay(timeSlot)}</span>
                    </div>
                    <div className="p-2">
                      {tasksInSlot.map(task => (
                        <div
                          key={task.id}
                          className="mb-2 last:mb-0 bg-blue-50 p-3 rounded-md border border-blue-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="font-medium text-blue-900">{task.name}</div>
                              {/* Tags */}
                              {task.tags && task.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1 mb-1">
                                  {task.tags.map(tag => (
                                    <span key={tag} className="px-2 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 border border-blue-200">{tag}</span>
                                  ))}
                                </div>
                              )}
                              <div className="text-xs text-blue-600 mt-1">
                                Due: {format(new Date(task.dueDate!), "h:mm a")}
                              </div>
                              {task.duration && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Duration: {task.duration} minutes
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col items-end ml-4">
                              <div className="text-sm font-semibold text-blue-700">
                                {getRemainingSessions(task)} sessions left
                              </div>
                              <div className="text-xs text-gray-500">
                                {task.completedSessions}/{task.totalSessions} completed
                              </div>
                              <div className="text-xs text-gray-500 mt-1">
                                {Math.round((task.completedSessions / task.totalSessions) * 100)}% done
                              </div>
                            </div>
                          </div>
                          <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                            <div
                              className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                              style={{
                                width: `${(task.completedSessions / task.totalSessions) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
} 