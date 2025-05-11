"use client";

import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, RotateCcw, Settings } from "lucide-react";
import { useUser } from "@clerk/nextjs";
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import useSound from "use-sound";
import Footer from "@/componets/footer/footer";
import { db } from "../firebase";
import Header from "../../componets/header/header";
import YoutubePlayer from "../../componets/youtuber/youtuber";
import BackGroundChanger from "../../componets/background changer/backgroundChange";
import { format, isSameDay, differenceInDays } from "date-fns";
import Head from "next/head";

const TIMER_MODES = {
  POMODORO: "pomodoro",
  SHORT_BREAK: "shortBreak",
  LONG_BREAK: "longBreak",
};

const MOODS = {
  FOCUSED: "focused",
  DISTRACTED: "distracted",
  ENERGETIC: "energetic",
  TIRED: "tired",
  STRESSED: "stressed",
  RELAXED: "relaxed",
  MOTIVATED: "motivated",
  UNMOTIVATED: "unmotivated",
  CREATIVE: "creative",
  BLOCKED: "blocked",
};

const TAG_COLORS = {
  Urgent: "bg-red-100 text-red-700 border-red-200",
  Important: "bg-orange-100 text-orange-700 border-orange-200",
  Optional: "bg-gray-100 text-gray-700 border-gray-300",
  "Deep Work": "bg-indigo-100 text-indigo-700 border-indigo-200",
  "Quick Win": "bg-green-100 text-green-700 border-green-200",
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag as keyof typeof TAG_COLORS] || "bg-blue-100 text-blue-700 border-blue-200";
}

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

export default function PomodoroTimer() {
  const { user } = useUser();
  const [mode, setMode] = useState(TIMER_MODES.POMODORO);
  const [timers, setTimers] = useState({
    [TIMER_MODES.POMODORO]: 25 * 60,
    [TIMER_MODES.SHORT_BREAK]: 5 * 60,
    [TIMER_MODES.LONG_BREAK]: 15 * 60,
  });
  const [isActive, setIsActive] = useState(false);
  const [durations, setDurations] = useState({
    [TIMER_MODES.POMODORO]: 25,
    [TIMER_MODES.SHORT_BREAK]: 5,
    [TIMER_MODES.LONG_BREAK]: 15,
  });
  const [mood, setMood] = useState("");
  const [showMoodInput, setShowMoodInput] = useState(false);
  const [showDurationSettings, setShowDurationSettings] = useState(false);
  const [moodAction, setMoodAction] = useState("");
  const [backgroundColor, setBackgroundColor] = useState("#ef4444");
  const [bodyColor, setBodyColor] = useState("rgb(186, 73, 73)");
  const [timeStudied, setTimeStudied] = useState(0);
  const timeStudiedRef = useRef(0);
  const [background, setBackground] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [playSound] = useSound("/audio.mp3", { volume: 0.5 });
  const [playFocusedSound, { stop: stopFocusedSound }] = useSound(
    "/Focused.mp3",
    { volume: 0.5 }
  );
  const [playEnergeticSound, { stop: stopEnergeticSound }] = useSound(
    "/Energetic.mp3",
    { volume: 0.5 }
  );
  const [playDistractedSound, { stop: stopDistractedSound }] = useSound(
    "/Distracted.mp3",
    { volume: 0.5 }
  );
  const [playBlockedSound, { stop: stopBlockedSound }] = useSound(
    "/Blocked.mp3",
    { volume: 0.5 }
  );
  const [playTiredSound, { stop: stopTiredSound }] = useSound("/Tired.mp3", {
    volume: 0.5,
  });
  const [playStressedSound, { stop: stopStressedSound }] = useSound(
    "/Stressed.mp3",
    { volume: 0.5 }
  );
  const [playRelaxedSound, { stop: stopRelaxedSound }] = useSound(
    "/Relaxed.mp3",
    { volume: 0.5 }
  );
  const [playMotivatedSound, { stop: stopMotivatedSound }] = useSound(
    "/Motivated.mp3",
    { volume: 0.5 }
  );
  const [playUnmotivatedSound, { stop: stopUnmotivatedSound }] = useSound(
    "/Unmotivated.mp3",
    { volume: 0.5 }
  );
  const [playCreativeSound, { stop: stopCreativeSound }] = useSound(
    "/Creative.mp3",
    { volume: 0.5 }
  );

  const stopAllSounds = () => {
    stopFocusedSound();
    stopEnergeticSound();
    stopDistractedSound();
    stopBlockedSound();
    stopTiredSound();
    stopStressedSound();
    stopRelaxedSound();
    stopMotivatedSound();
    stopUnmotivatedSound();
    stopCreativeSound();
  };

  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  const [streak, setStreak] = useState<number>(0);
  const [lastStreakUpdate, setLastStreakUpdate] = useState<Date | null>(null);
  const [showStreakAnimation, setShowStreakAnimation] = useState(false);
  const [hideLoader, setHideLoader] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserData();
      fetchTasks();
      fetchStreakData();
    }
  }, [user]);

  useEffect(() => {
    // Request notification permission
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        setNotificationsEnabled(permission === "granted");
      });
    }
  }, []);

  const sendNotification = (title: string, body: string) => {
    if (notificationsEnabled && "Notification" in window) {
      new Notification(title, {
        body,
        icon: "/title.png"
      });
    }
  };

  const fetchUserData = async () => {
    if (!user) return;
    
    try {
      const userRef = doc(db, "users", user.id);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        setTimeStudied(userData.timeStudied || 0);
        timeStudiedRef.current = userData.timeStudied || 0;
      } else {
        await setDoc(userRef, {
          name: user.fullName,
          photoUrl: user.imageUrl,
          timeStudied: 0,
        });
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

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

  const fetchStreakData = async () => {
    if (!user) return;

    try {
      const userRef = doc(db, "users", user.id);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        const savedStreak = userData.streak || 0;
        const savedLastUpdate = userData.lastStreakUpdate ? new Date(userData.lastStreakUpdate) : null;
        
        // Check if streak should be reset
        if (savedLastUpdate) {
          const daysSinceLastUpdate = differenceInDays(new Date(), savedLastUpdate);
          
          if (daysSinceLastUpdate > 1) {
            // Reset streak if more than 1 day has passed
            await updateDoc(userRef, {
              streak: 0,
              lastStreakUpdate: new Date().toISOString()
            });
            setStreak(0);
            setLastStreakUpdate(new Date());
          } else if (daysSinceLastUpdate === 1) {
            // Increment streak if exactly 1 day has passed
            const newStreak = savedStreak + 1;
            await updateDoc(userRef, {
              streak: newStreak,
              lastStreakUpdate: new Date().toISOString()
            });
            setStreak(newStreak);
            setLastStreakUpdate(new Date());
            displayStreakAnimation(newStreak);
          } else {
            // Keep current streak if same day
            setStreak(savedStreak);
            setLastStreakUpdate(savedLastUpdate);
          }
        } else {
          // Initialize streak data
          await updateDoc(userRef, {
            streak: 0,
            lastStreakUpdate: new Date().toISOString()
          });
          setStreak(0);
          setLastStreakUpdate(new Date());
        }
      }
    } catch (error) {
      console.error("Error fetching streak data:", error);
    }
  };

  const displayStreakAnimation = (newStreak: number) => {
    setShowStreakAnimation(true);
    setHideLoader(false);
    setIsAnimating(true);

    setTimeout(() => {
      setHideLoader(true);
      setIsAnimating(false);
    }, 2000);
  };

  const updateStreak = async () => {
    if (!user || !lastStreakUpdate) return;

    try {
      const userRef = doc(db, "users", user.id);
      const today = new Date();

      if (!isSameDay(lastStreakUpdate, today)) {
        const daysSinceLastUpdate = differenceInDays(today, lastStreakUpdate);
        
        if (daysSinceLastUpdate === 1) {
          // Increment streak if exactly 1 day has passed
          const newStreak = streak + 1;
          await updateDoc(userRef, {
            streak: newStreak,
            lastStreakUpdate: today.toISOString()
          });
          setStreak(newStreak);
          setLastStreakUpdate(today);
          displayStreakAnimation(newStreak);
        } else if (daysSinceLastUpdate > 1) {
          // Reset streak if more than 1 day has passed
          await updateDoc(userRef, {
            streak: 0,
            lastStreakUpdate: today.toISOString()
          });
          setStreak(0);
          setLastStreakUpdate(today);
        }
      }
    } catch (error) {
      console.error("Error updating streak:", error);
    }
  };

  // Update streak when completing a Pomodoro session
  useEffect(() => {
    if (timers[mode] === 0 && mode === TIMER_MODES.POMODORO) {
      updateStreak();
    }
  }, [timers[mode], mode]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActive && timers[mode] > 0) {
      interval = setInterval(() => {
        setTimers((prevTimers) => ({
          ...prevTimers,
          [mode]: prevTimers[mode] - 1,
        }));
        if (mode === TIMER_MODES.POMODORO) {
          setTimeStudied((prevTime) => {
            const newTime = prevTime + 1;
            timeStudiedRef.current = newTime;
            return newTime;
          });
        }
      }, 1000);
    } else if (timers[mode] === 0) {
      setIsActive(false);
      playSound();
      // Send notifications
      if (mode === TIMER_MODES.POMODORO) {
        sendNotification(
          "Break Time!",
          "Great job! Take a 5-minute break."
        );
        updateTimeStudied(timeStudiedRef.current);
      } else if (mode === TIMER_MODES.SHORT_BREAK) {
        sendNotification(
          "Break Over!",
          "Time to get back to work!"
        );
      }
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActive, mode, timers, playSound]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("mode", mode);
      localStorage.setItem("timers", JSON.stringify(timers));
      localStorage.setItem("isActive", isActive.toString());
      localStorage.setItem("durations", JSON.stringify(durations));
      localStorage.setItem("mood", mood);
      localStorage.setItem("backgroundColor", backgroundColor);
    }
  }, [mode, timers, isActive, durations, mood, backgroundColor]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedMode = localStorage.getItem("mode");
      const savedTimers = JSON.parse(localStorage.getItem("timers") || "{}");
      const savedIsActive = localStorage.getItem("isActive") === "true";
      const savedDurations = JSON.parse(
        localStorage.getItem("durations") || "{}"
      );
      const savedMood = localStorage.getItem("mood");
      const savedBackgroundColor = localStorage.getItem("backgroundColor");

      if (savedMode) setMode(savedMode as keyof typeof TIMER_MODES);
      if (Object.keys(savedTimers).length) setTimers(savedTimers);
      if (savedIsActive) setIsActive(savedIsActive);
      if (Object.keys(savedDurations).length) setDurations(savedDurations);
      if (savedMood) setMood(savedMood);
      if (savedBackgroundColor) setBackgroundColor(savedBackgroundColor);
    }
  }, []);

  const updateTimeStudied = async (newTime: number) => {
    if (user) {
      try {
        const userRef = doc(db, "users", user.id);
        await updateDoc(userRef, {
          timeStudied: newTime,
        });
      } catch (error) {
        console.error("Error updating time studied:", error);
      }
    }
  };

  const toggleTimer = async () => {
    if (!isActive) {
      // Send notification when starting a session
      if (mode === TIMER_MODES.POMODORO) {
        sendNotification(
          "Focus Time!",
          selectedTask 
            ? `Starting work on: ${selectedTask.name}`
            : "Starting a focus session"
        );
      } else if (mode === TIMER_MODES.SHORT_BREAK) {
        sendNotification(
          "Break Time!",
          "Take a short break to recharge."
        );
      }
    }

    if (isActive) {
      if (mode === TIMER_MODES.POMODORO && selectedTask) {
        await updateTimeStudied(timeStudiedRef.current);
        await updateTaskProgress(selectedTask.id);
      }
    }

    if (user) {
      try {
        const userRef = doc(db, "users", user.id);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();

        const updates: { [key: string]: any } = {};
        if (userData?.name !== user.fullName) {
          updates.name = user.fullName;
        }
        if (userData?.photoUrl !== user.imageUrl) {
          updates.photoUrl = user.imageUrl;
        }

        if (Object.keys(updates).length > 0) {
          await updateDoc(userRef, {
            ...updates,
            lastActive: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Error updating user data:", error);
      }
    }
    setIsActive((prev) => !prev);
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
      
      // If task is completed, clear selection
      if (updatedTask.completedSessions >= updatedTask.totalSessions) {
        setSelectedTask(null);
      }
    } catch (error) {
      console.error("Error updating task:", error);
    }
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimers((prevTimers) => ({
      ...prevTimers,
      [mode]: durations[mode] * 60,
    }));
    if (mode === TIMER_MODES.POMODORO) {
      updateTimeStudied(timeStudiedRef.current);
    }
  };

  const switchMode = (newMode: keyof typeof TIMER_MODES) => {
    if (mode !== newMode) {
      if (mode === TIMER_MODES.POMODORO && isActive) {
        updateTimeStudied(timeStudiedRef.current);
      }
      setMode(newMode);
      setIsActive(false);
      setTimers((prevTimers) => ({
        ...prevTimers,
        [newMode]: durations[newMode] * 60,
      }));
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const handleDurationChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    timerKey: keyof typeof TIMER_MODES
  ) => {
    const value = parseInt(e.target.value);
    setDurations((prevDurations) => ({
      ...prevDurations,
      [timerKey]: value,
    }));
    setTimers((prevTimers) => ({
      ...prevTimers,
      [timerKey]: value * 60,
    }));
  };

  const handleMoodSubmit = (newMood: keyof typeof MOODS) => {
    setMood(newMood);
    setShowMoodInput(false);
    handleMood(newMood);
    playAudio(newMood);
  };

  const playAudio = (currentMood: keyof typeof MOODS) => {
    stopAllSounds();
    switch (currentMood) {
      case MOODS.FOCUSED:
        playFocusedSound();
        break;
      case MOODS.ENERGETIC:
        playEnergeticSound();
        break;
      case MOODS.BLOCKED:
        playBlockedSound();
        break;
      case MOODS.TIRED:
        playTiredSound();
        break;
      case MOODS.STRESSED:
        playStressedSound();
        break;
      case MOODS.RELAXED:
        playRelaxedSound();
        break;
      case MOODS.MOTIVATED:
        playMotivatedSound();
        break;
      case MOODS.UNMOTIVATED:
        playUnmotivatedSound();
        break;
      case MOODS.CREATIVE:
        playCreativeSound();
        break;
      case MOODS.DISTRACTED:
        playDistractedSound();
        break;
      default:
        break;
    }
  };
  function stopMusic() {}
  const handleMood = (currentMood: keyof typeof MOODS) => {
    let action = "";
    let newBackgroundColor = backgroundColor;
    let bodiesBackgroundColor = bodyColor;

    switch (currentMood) {
      case MOODS.FOCUSED:
        action =
          "Playing ambient sounds to maintain your focus. Timer settings optimized for deep work.";
        setDurations((prev) => ({
          ...prev,
          [TIMER_MODES.POMODORO]: 30,
          [TIMER_MODES.SHORT_BREAK]: 5,
        }));
        newBackgroundColor = "#e6f3ff";
        bodiesBackgroundColor = "#ADD8FF";
        break;
      case MOODS.ENERGETIC:
        action =
          "Extended work sessions to capitalize on your energy. Upbeat background music enabled.";
        setDurations((prev) => ({
          ...prev,
          [TIMER_MODES.POMODORO]: 40,
          [TIMER_MODES.SHORT_BREAK]: 5,
        }));
        newBackgroundColor = "#f4976c";
        bodiesBackgroundColor = "#f4976c";
        break;
      case MOODS.BLOCKED:
        action =
          "Taking a break to clear your mind. Consider a quick walk or meditation.";
        newBackgroundColor = "#ffdddd";
        bodiesBackgroundColor = "#FFECB3";
        break;
      case MOODS.TIRED:
        action = "Try to break up your tasks.";
        newBackgroundColor = "#e6ffe6";
        bodiesBackgroundColor = "#e6ffe6";
        break;
      case MOODS.DISTRACTED:
        action = "Try to break up your tasks.";
        newBackgroundColor = "#A3EBB1";
        bodiesBackgroundColor = "#A3EBB1";
        break;
      default:
        action =
          "Timer settings unchanged. Remember to adjust your environment for optimal productivity.";
    }

    setMoodAction(action);
    setBackgroundColor(newBackgroundColor);
    setBodyColor(bodiesBackgroundColor);
  };

  useEffect(() => {
    let title = "FocusFlow: Pomodoro Scheduler";
    if (isActive) {
      let session = mode === TIMER_MODES.POMODORO ? "Focus" : mode === TIMER_MODES.SHORT_BREAK ? "Break" : "Long Break";
      title = `${formatTime(timers[mode])} | ${session} - FocusFlow`;
    }
    document.title = title;
  }, [isActive, timers, mode]);

  return (
    <>
      <Head>
        <title>FocusFlow: Pomodoro Scheduler</title>
        <meta name="description" content="Boost your productivity with FocusFlow, a Pomodoro scheduling app with task management, calendar, and progress tracking." />
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-rose-200 to-rose-400">
        {/* Streak Animation Overlay */}
        <div
          className={`fixed inset-0 bg-white transition-opacity duration-500 
          ${hideLoader ? "opacity-0 pointer-events-none" : "opacity-100"} 
          ${showStreakAnimation ? "z-50" : "-z-10"}`}
        >
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <span className="text-6xl animate-bounce">🔥</span>
              </div>
              <div className="text-4xl font-bold text-gray-800">
                {streak} Day Streak!
              </div>
            </div>
          </div>
        </div>

        {/* Main Timer UI with Task Sidebar */}
        <div className="min-h-screen flex flex-col mt-10">
          <Header />
          <main className="flex-grow flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-6xl flex flex-col md:flex-row items-start justify-center gap-8">
              {/* Task Sidebar */}
              <aside className="w-full md:w-80 mb-6 md:mb-0">
                <div className="bg-white rounded-2xl shadow-xl p-6">
                  <h2 className="text-lg font-bold mb-4 text-blue-700 flex items-center">
                    <span className="mr-2">📋</span> Your Tasks
                  </h2>
                  {isLoading ? (
                    <div className="w-full h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 animate-pulse rounded mb-4" />
                  ) : tasks.length === 0 ? (
                    <div className="text-gray-500 text-center">No tasks yet. Add tasks from the Tasks page!</div>
                  ) : (
                    <ul className="space-y-3">
                      {tasks.map((task) => (
                        <li
                          key={task.id}
                          className={`p-3 rounded-lg border transition-all cursor-pointer ${
                            selectedTask?.id === task.id
                              ? "border-blue-500 bg-blue-50"
                              : "border-gray-200 bg-gray-100 hover:bg-blue-100"
                          }`}
                          onClick={() => setSelectedTask(task)}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-800">{task.name}</span>
                            <span className="text-xs text-gray-500">{task.completedSessions}/{task.totalSessions}</span>
                          </div>
                          {/* Tags */}
                          {task.tags && task.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1 mb-1">
                              {task.tags.map(tag => (
                                <span key={tag} className={`px-2 py-1 rounded-full text-xs font-semibold border ${getTagColor(tag)}`}>{tag}</span>
                              ))}
                            </div>
                          )}
                          {/* Due Date */}
                          {task.dueDate && (
                            <div className="text-xs text-blue-600 mb-1">Due: {format(new Date(task.dueDate), "MMM d, yyyy h:mm a")}</div>
                          )}
                          {/* Sessions Remaining */}
                          <div className="text-xs text-gray-500 mb-1">{task.totalSessions - task.completedSessions} sessions left</div>
                          {/* Progress Bar */}
                          <div className="w-full bg-gray-200 rounded-full h-1 mt-2">
                            <div
                              className="bg-blue-500 h-1 rounded-full transition-all duration-300"
                              style={{ width: `${(task.completedSessions / task.totalSessions) * 100}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </aside>
              {/* Pomodoro Timer Card */}
              <section className="flex-1 flex justify-center">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 flex flex-col items-center">
                  <h1 className="text-3xl font-extrabold text-center mb-2 text-rose-700 tracking-tight">
                    Pomodoro Timer
                  </h1>
                  <p className="text-center text-gray-500 mb-6">Boost your focus with the Pomodoro Technique. Select a task and start a session!</p>
                  {/* Task Selection (hidden on md+ screens, handled by sidebar) */}
                  <div className="mb-6 md:hidden w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Task
                    </label>
                    <select
                      value={selectedTask?.id || ""}
                      onChange={(e) => {
                        const task = tasks.find(t => t.id === e.target.value);
                        setSelectedTask(task || null);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Choose a task...</option>
                      {tasks
                        .filter(task => task.completedSessions < task.totalSessions)
                        .map(task => (
                          <option key={task.id} value={task.id}>
                            {task.name} ({task.completedSessions}/{task.totalSessions} sessions)
                            {task.dueDate ? `, Due: ${format(new Date(task.dueDate), "MMM d, yyyy h:mm a")}` : ""}
                            {task.tags && task.tags.length > 0 ? `, Tags: ${task.tags.join(", ")}` : ""}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div
                    className="text-7xl font-extrabold text-center mb-8"
                    style={{ color: backgroundColor }}
                  >
                    {formatTime(timers[mode])}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-6 w-full">
                    {Object.values(TIMER_MODES).map((timerMode) => (
                      <button
                        key={timerMode}
                        onClick={() =>
                          switchMode(timerMode as keyof typeof TIMER_MODES)
                        }
                        className={`py-2 px-4 rounded-md text-sm font-semibold transition-colors w-full ${
                          mode === timerMode
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                        }`}
                      >
                        {timerMode.replace(/_/g, " ").toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="flex justify-center space-x-4 mb-6 w-full">
                    <button
                      onClick={toggleTimer}
                      className="flex items-center justify-center py-2 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-semibold text-lg"
                    >
                      {isActive ? (
                        <>
                          <Pause className="mr-2 h-5 w-5" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-5 w-5" />
                          Start
                        </>
                      )}
                    </button>
                    <button
                      onClick={resetTimer}
                      className="flex items-center justify-center py-2 px-6 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors font-semibold text-lg"
                    >
                      <RotateCcw className="mr-2 h-5 w-5" />
                      Reset
                    </button>
                  </div>
                  <button
                    onClick={() => setShowDurationSettings((prev) => !prev)}
                    className="w-full mb-4 py-2 px-4 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors flex items-center justify-center font-medium"
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    Set Durations
                  </button>
                  {showDurationSettings && (
                    <div className="space-y-4 mb-6 w-full">
                      {Object.entries(durations).map(([key, value]) => (
                        <div key={key}>
                          <label
                            htmlFor={key}
                            className="block text-sm font-medium text-gray-700 mb-1"
                          >
                            {key.replace(/_/g, " ").toUpperCase()} Duration
                            (minutes)
                          </label>
                          <input
                            type="range"
                            id={key}
                            min="1"
                            max="60"
                            value={value}
                            onChange={(e) =>
                              handleDurationChange(
                                e,
                                key as keyof typeof TIMER_MODES
                              )
                            }
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                          />
                          <div className="text-right text-sm text-gray-500 mt-1">
                            {value} minutes
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {showMoodInput && (
                    <div className="grid grid-cols-2 gap-2 mb-4 w-full">
                      {Object.values(MOODS).map((moodOption) => (
                        <button
                          key={moodOption}
                          onClick={() =>
                            handleMoodSubmit(moodOption as keyof typeof MOODS)
                          }
                          className="py-2 px-4 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors text-sm"
                        >
                          {moodOption}
                        </button>
                      ))}
                    </div>
                  )}
                  {mood && (
                    <div className="text-sm text-center mb-4 text-gray-600">
                      {moodAction}
                    </div>
                  )}
                  <div className="containerLinks w-full">
                    <YoutubePlayer />
                    <BackGroundChanger setBackground={setBackground} />
                  </div>
                  <div className="text-center text-sm text-gray-500 mt-4">
                    Time studied: {formatTime(timeStudiedRef.current)}
                  </div>
                  <div className="text-center text-sm text-gray-500 mt-2">
                    <div className="flex items-center justify-center space-x-2">
                      <span className="text-xl">🔥</span>
                      <span>{streak} Day Streak</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </main>
          <Footer />
        </div>
      </div>
    </>
  );
}
