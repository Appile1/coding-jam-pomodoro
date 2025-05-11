"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Header from "@/componets/header/header";
import Footer from "@/componets/footer/footer";
import { useUser } from "@clerk/nextjs";
import ChatPopup from "@/componets/chatPopup/chatPopup";
import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";

const features = [
  // {
  //   icon: "📚",
  //   title: "Flashcard",
  //   description: "Create and study flashcards for efficient learning.",
  //   link: "generate",
  // },
  {
    icon: "🧠",
    title: "Home",
    description: "Landing Page",
    link: "",
  },
  {
    icon: "📋",
    title: "Tasks",
    description: "Manage your tasks and track progress with Pomodoro sessions",
    link: "tasks",
  },
  {
    icon: "📅",
    title: "Calendar",
    description: "View your daily schedule and focus sessions",
    link: "calendar",
  },
  {
    icon: "🖊️",
    title: "Notes",
    description: "Take and organize notes with ease.",
    link: "notes",
  },
  {
    icon: "🏆",
    title: "Leaderboard",
    description: "Compete with friends and track your progress.",
    link: "leaderboard",
  },
  {
    icon: "⏰",
    title: "Pomodoro Timer",
    description: "Boost productivity with timed work sessions.",
    link: "promodoroTimer",
  },
];
const testimonials = [
  {
    name: "Sarah L.",
    quote: "Productivity Pro has revolutionized my study habits!",
    rating: 5,
  },
  {
    name: "John D.",
    quote: "I've seen a significant boost in my productivity.",
    rating: 4,
  },
  {
    name: "Emily R.",
    quote: "The Pomodoro Timer is a game-changer for me.",
    rating: 5,
  },
];

export default function HomePage() {
  const [isVisible, setIsVisible] = useState({
    features: false,
    testimonials: false,
  });

  useEffect(() => {
    const handleScroll = () => {
      const featuresSection = document.getElementById("features");
      const testimonialsSection = document.getElementById("testimonials");

      if (featuresSection) {
        const featureRect = featuresSection.getBoundingClientRect();
        setIsVisible((prev) => ({
          ...prev,
          features: featureRect.top < window.innerHeight,
        }));
      }

      if (testimonialsSection) {
        const testimonialRect = testimonialsSection.getBoundingClientRect();
        setIsVisible((prev) => ({
          ...prev,
          testimonials: testimonialRect.top < window.innerHeight,
        }));
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  const { user } = useUser();

  // Function to get completed tasks for the AI
  const getCompletedTasks = async () => {
    if (!user) return [];
    const tasksRef = collection(db, `users/${user.id}/tasks`);
    const querySnapshot = await getDocs(tasksRef);
    return querySnapshot.docs
      .map(doc => doc.data())
      .filter(task => task.completedSessions >= task.totalSessions);
  };

  return (
    <>
      <Header />
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white text-gray-800 flex flex-col">
        <main className="flex-1">
          {/* Hero Section */}
          <section className="container mx-auto px-4 py-20 flex flex-col md:flex-row items-center gap-8">
            <div className="md:w-1/2 mb-10 md:mb-0">
              <h1 className="text-5xl md:text-6xl font-extrabold mb-6 text-blue-700 leading-tight">
                Welcome to <span className="text-rose-500">FocusFlow</span>
              </h1>
              <p className="text-xl mb-8 text-gray-600">
                Your all-in-one Pomodoro scheduler, task manager, and productivity coach. Plan, focus, and achieve more—smarter.
              </p>
              <a
                href="/promodoroTimer"
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 font-semibold shadow-lg"
              >
                Start Focusing
              </a>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <Image
                src="/favicon.ico"
                alt="FocusFlow Hero"
                width={400}
                height={300}
                sizes="(max-width: 768px) 100vw, 400px"
                className="w-80 md:w-full max-w-md rounded-2xl shadow-xl"
                priority
              />
            </div>
          </section>

          {/* Features Section */}
          <section id="features" className="bg-white py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-12 text-blue-700">
                Key Features
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => (
                  <div
                    key={feature.title}
                    className="border rounded-2xl p-8 shadow-md bg-gradient-to-br from-blue-50 to-white hover:shadow-xl transition-all"
                  >
                    <div className="text-4xl mb-4">{feature.icon}</div>
                    <h3 className="text-xl font-semibold mb-2 text-blue-800">
                      {feature.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {feature.description}
                    </p>
                    <a
                      href={`/${feature.link}`}
                      className="text-blue-600 hover:underline inline-flex items-center font-medium"
                    >
                      Learn More
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Testimonials Section */}
          <section id="testimonials" className="bg-blue-50 py-20">
            <div className="container mx-auto px-4">
              <h2 className="text-3xl font-bold text-center mb-12 text-blue-700">
                What Our Users Say
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {testimonials.map((testimonial, index) => (
                  <div
                    key={testimonial.name}
                    className="border rounded-2xl p-6 shadow-md bg-white"
                  >
                    <p className="text-gray-600 mb-4">
                      "{testimonial.quote}"
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {testimonial.name}
                      </span>
                      <div className="flex">
                        {[...Array(testimonial.rating)].map((_, i) => (
                          <span key={i} className="text-yellow-400">
                            ⭐
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
        <ChatPopup getTaskHistory={getCompletedTasks} />
        <Footer />
      </div>
    </>
  );
}
