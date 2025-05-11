"use client";
import React, { useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { collection, query, orderBy, getDocs } from "firebase/firestore";
import { db } from "../app/firebase";

export default function ChatPopup() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "system", content: "You are a helpful productivity assistant. Suggest next tasks based on user's completed task history. Always respond concisely." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Fetch current tasks from Firebase
  const getCurrentTasks = async () => {
    if (!user) return [];
    setTaskLoading(true);
    try {
      const tasksRef = collection(db, `users/${user.id}/tasks`);
      const q = query(tasksRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return [];
    } finally {
      setTaskLoading(false);
    }
  };

  // Fetch completed tasks from Firebase
  const getCompletedTasks = async () => {
    if (!user) return [];
    setTaskLoading(true);
    try {
      const tasksRef = collection(db, `users/${user.id}/completedTasks`);
      const q = query(tasksRef, orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
      return [];
    } finally {
      setTaskLoading(false);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setAiLoading(true);
    setLoading(true);
    setInput("");
    const userMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);

    // Fetch tasks
    const [currentTasks, completedTasks] = await Promise.all([
      getCurrentTasks(),
      getCompletedTasks(),
    ]);

    // If no current tasks, show message and do not call API
    if (!currentTasks.length) {
      setMessages((prev) => [...prev, { role: "assistant", content: "You have done all your tasks!" }]);
      setAiLoading(false);
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      return;
    }

    // Build context for AI
    let context = "";
    context += `\n\nCurrent tasks: ${currentTasks.map(t => `${t.name} (${t.completedSessions || 0}/${t.totalSessions} sessions${t.dueDate ? ", due " + t.dueDate : ""})`).join("; ")}`;
    if (completedTasks.length) {
      context += `\n\nCompleted tasks: ${completedTasks.map(t => `${t.name} (${t.totalSessions} sessions${t.dueDate ? ", due " + t.dueDate : ""})`).join("; ")}`;
    }
    context += "\n\nBased on my current and completed tasks, please suggest what I should focus on next or how to improve my productivity. Please keep your response concise.";

    try {
      const res = await fetch("/api/chatai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: input + context }],
        }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message || "No reply received." }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Error talking to AI." }]);
    } finally {
      setAiLoading(false);
      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  // Only show if user is logged in
  if (!user) return null;

  return (
    <div className="fixed bottom-8 right-8 z-50">
      {open ? (
        <div className="w-[420px] h-[600px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col">
          <div className="flex items-center justify-between px-6 py-3 border-b bg-blue-600 rounded-t-2xl">
            <span className="flex items-center gap-2 text-white font-semibold text-lg">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#f43f5e" />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontFamily="Arial">FF</text>
              </svg>
              FocusFlow AI
            </span>
            <button onClick={() => setOpen(false)} className="text-white text-2xl hover:text-gray-300">×</button>
          </div>
          {/* Loading bar for AI response */}
          {aiLoading && (
            <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 animate-pulse rounded-t" style={{ width: '100%' }} />
          )}
          <div className="flex-1 overflow-y-auto p-6 space-y-3" style={{ maxHeight: 480 }}>
            {messages.slice(1).map((msg, i) => (
              <div key={i} className={`text-base p-3 rounded-xl max-w-[90%] ${msg.role === "user" ? "bg-blue-100 text-right ml-16" : "bg-gray-100 text-left mr-16"}`}>{msg.content}</div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="flex border-t p-4 bg-gray-50 gap-2">
            <input
              type="text"
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 text-base"
              placeholder="Ask something..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="ml-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-base font-semibold" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-blue-600 text-white rounded-full shadow-lg p-5 hover:bg-blue-700 focus:outline-none flex items-center justify-center"
          title="AI Task Chat"
        >
          {/* New chat bubble icon */}
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12c0-4.556 4.694-8.25 10.5-8.25s10.5 3.694 10.5 8.25-4.694 8.25-10.5 8.25c-1.13 0-2.22-.13-3.24-.37a.75.75 0 0 0-.53.04l-3.32 1.66a.75.75 0 0 1-1.07-.85l.47-2.35a.75.75 0 0 0-.22-.7C3.14 15.13 2.25 13.64 2.25 12Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
 