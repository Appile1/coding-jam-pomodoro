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
    <div className="fixed bottom-6 right-6 z-50">
      {open ? (
        <div className="w-80 bg-white rounded-xl shadow-2xl border border-gray-200 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-blue-600 rounded-t-xl">
            <span className="flex items-center gap-2 text-white font-semibold">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-rose-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#f43f5e" />
                <text x="12" y="16" textAnchor="middle" fontSize="10" fill="white" fontFamily="Arial">FF</text>
              </svg>
              FocusFlow AI
            </span>
            <button onClick={() => setOpen(false)} className="text-white text-lg hover:text-gray-300">×</button>
          </div>
          {/* Loading bar for AI response */}
          {aiLoading && (
            <div className="h-1 bg-gradient-to-r from-blue-400 via-blue-600 to-blue-400 animate-pulse rounded-t" style={{ width: '100%' }} />
          )}
          <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ maxHeight: 320 }}>
            {messages.slice(1).map((msg, i) => (
              <div key={i} className={`text-sm p-2 rounded-lg max-w-[90%] ${msg.role === "user" ? "bg-blue-100 text-right ml-8" : "bg-gray-100 text-left mr-8"}`}>{msg.content}</div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <form onSubmit={handleSend} className="flex border-t p-2 bg-gray-50">
            <input
              type="text"
              className="flex-1 px-2 py-1 rounded border border-gray-300 focus:outline-none"
              placeholder="Ask something..."
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={loading}
            />
            <button type="submit" className="ml-2 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={loading || !input.trim()}>
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="bg-blue-600 text-white rounded-full shadow-lg p-4 hover:bg-blue-700 focus:outline-none flex items-center justify-center"
          title="AI Task Chat"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20h9" />
            <circle cx="12" cy="7" r="4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 20h.01" />
          </svg>
        </button>
      )}
    </div>
  );
}
 