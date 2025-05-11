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

  // Generate time slots from 8 AM to 8 PM
  const timeSlots = Array.from({ length: 25 }, (_, i) => {
    const hour = Math.floor((i + 16) / 2);
    const minute = (i + 16) % 2 === 0 ? "00" : "30";
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

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8 flex flex-col">
        <div className="max-w-6xl mx-auto w-full">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-8 gap-4">
            <div className="flex items-center space-x-3">
              <CalendarIcon className="w-6 h-6 text-blue-600" />
              {viewMode === "daily" ? (
                <span className="text-2xl font-bold text-gray-900">
                  Schedule for {format(selectedDate, "MMMM d, yyyy")}
                </span>
              ) : (
                <span className="text-2xl font-bold text-gray-900">
                  Weekly Schedule ({format(getWeekDays()[0], "MMM d")} - {format(getWeekDays()[6], "MMM d, yyyy")})
                </span>
              )}
            </div>
            <div className="flex items-center space-x-2 mt-2 md:mt-0">
              <button
                onClick={() => setViewMode("daily")}
                className={`px-4 py-2 rounded-md ${
                  viewMode === "daily"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setViewMode("weekly")}
                className={`px-4 py-2 rounded-md ${
                  viewMode === "weekly"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Weekly
              </button>
              {viewMode === "daily" && (
                <div className="flex items-center space-x-1 ml-4">
                  <button
                    onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                    className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedDate(new Date())}
                    className="px-4 py-2 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-semibold"
                  >
                    Today
                  </button>
                  <button
                    onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                    className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          {isLoading ? (
            <div className="text-center py-8">Loading schedule...</div>
          ) : (
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-4 md:p-8">
              {viewMode === "weekly" ? (
                <div className="grid grid-cols-7 gap-4">
                  {getWeekDays().map((day) => (
                    <div key={day.toISOString()} className="border-r border-gray-100 last:border-r-0">
                      <div className="p-2 text-center border-b border-gray-100 bg-gray-50 rounded-t-xl">
                        <div className="font-medium text-blue-700">{format(day, "EEE")}</div>
                        <div className={`text-sm ${isSameDay(day, new Date()) ? "text-blue-600 font-bold" : "text-gray-500"}`}>{format(day, "MMM d")}</div>
                      </div>
                      <div className="relative h-[calc(100vh-300px)]">
                        {timeSlots.map((time) => (
                          <div key={time} className="h-16 border-b border-gray-100 relative" />
                        ))}
                        {timeBlocks.filter(block => isSameDay(block.startTime, day)).map((block, index) => {
                          const startHour = block.startTime.getHours();
                          const startMinute = block.startTime.getMinutes();
                          const top = ((startHour - 8) * 2 + startMinute / 30) * 4;
                          const height = block.type === "focus" ? "4rem" : "1rem";
                          return (
                            <div
                              key={index}
                              className={`absolute left-1 right-1 mx-1 rounded-lg border-2 shadow-md ${getBlockColor(block)} transition-all duration-300 hover:scale-105`}
                              style={{ top: `${top}rem`, height }}
                            >
                              <div className="p-2 text-sm">
                                {block.type === "focus" && (
                                  <>
                                    <div className="font-semibold text-gray-800">{block.task.name}</div>
                                    <div className="text-xs text-gray-500">{format(block.startTime, "h:mm a")} - {format(block.endTime, "h:mm a")}</div>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-[100px_1fr] gap-4">
                  <div className="border-r border-gray-100 bg-gray-50 rounded-l-xl">
                    {timeSlots.map((time) => (
                      <div key={time} className="h-16 border-b border-gray-100 flex items-center justify-center text-sm text-gray-500">
                        {time}
                      </div>
                    ))}
                  </div>
                  <div className="relative">
                    {timeSlots.map((time) => (
                      <div key={time} className="h-16 border-b border-gray-100 relative" />
                    ))}
                    {timeBlocks.filter(block => isSameDay(block.startTime, selectedDate)).map((block, index) => {
                      const startHour = block.startTime.getHours();
                      const startMinute = block.startTime.getMinutes();
                      const top = ((startHour - 8) * 2 + startMinute / 30) * 4;
                      const height = block.type === "focus" ? "4rem" : "1rem";
                      return (
                        <div
                          key={index}
                          className={`absolute left-1 right-1 mx-1 rounded-lg border-2 shadow-md ${getBlockColor(block)} transition-all duration-300 hover:scale-105`}
                          style={{ top: `${top}rem`, height }}
                        >
                          <div className="p-2 text-sm">
                            {block.type === "focus" && (
                              <>
                                <div className="font-semibold text-gray-800">{block.task.name}</div>
                                <div className="text-xs text-gray-500">{format(block.startTime, "h:mm a")} - {format(block.endTime, "h:mm a")}</div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
} 