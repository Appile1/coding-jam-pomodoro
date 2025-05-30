"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { Menu, X, LogIn } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

const navItems = [
  { name: "Home", href: "/" },
  { name: "Tasks", href: "/tasks" },
  { name: "Calendar", href: "/calendar" },
  { name: "Notes", href: "/notes" },
  { name: "Leaderboard", href: "/leaderboard" },
  { name: "PomodoroTimer", href: "/promodoroTimer" },
];

export default function Header() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const sidebarRef = useRef(null);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);

    // Prevent scrolling when the menu is open
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      document.body.style.overflow = "unset";
    };
  }, [isMenuOpen]);

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    if (isLeftSwipe) {
      setIsMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white shadow-md border-b border-gray-200 w-full">
      <div className="container mx-auto px-4 flex items-center justify-between py-3">
        <Link href="/" className="flex items-center space-x-2 group">
          <div className="relative w-10 h-10 overflow-hidden rounded-full shadow-md group-hover:shadow-lg transition-shadow duration-300">
            <Image
              src="/title.png"
              alt="FocusFlow Logo"
              width={40}
              height={40}
              sizes="40px"
              className="transition-transform duration-300 group-hover:scale-105"
              priority
            />
          </div>
          <span className="text-blue-700 text-2xl font-bold group-hover:text-blue-600 transition-colors duration-300">
            FocusFlow
          </span>
        </Link>
        <nav className="hidden md:flex space-x-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-gray-600 hover:text-blue-600 transition-colors duration-300 relative group"
            >
              <span className="relative z-10">{item.name}</span>
              <span className="absolute left-0 bottom-0 w-full h-0.5 bg-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></span>
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <Link href="/signup">
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                <LogIn className="inline-block mr-2" size={18} />
                Sign In
              </button>
            </Link>
          </SignedOut>
        </div>
        <button
          className="md:hidden text-gray-600 hover:text-blue-600 transition-colors duration-300"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
        >
          {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {/* Mobile menu */}
      <div
        ref={sidebarRef}
        className={`md:hidden fixed inset-0 z-50 bg-white transform ${
          isMenuOpen ? "translate-x-0" : "translate-x-full"
        } transition-transform duration-300 ease-in-out shadow-2xl`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <button
          className="absolute top-4 right-4 text-gray-600 hover:text-blue-600 transition-colors duration-300"
          onClick={() => setIsMenuOpen(false)}
        >
          <X size={24} />
        </button>
        <div className="flex flex-col items-center justify-center h-full space-y-8">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="text-gray-800 text-2xl hover:text-blue-600 transition-colors duration-300"
              onClick={() => setIsMenuOpen(false)}
            >
              {item.name}
            </Link>
          ))}
          <SignedIn>
            <UserButton />
          </SignedIn>
          <SignedOut>
            <Link href="/signup">
              <button
                onClick={() => setIsMenuOpen(false)}
                className="bg-blue-600 text-white px-6 py-3 rounded-md text-lg hover:bg-blue-700 transition-colors duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
              >
                <LogIn className="inline-block mr-2" size={18} />
                Sign In
              </button>
            </Link>
          </SignedOut>
        </div>
      </div>
    </header>
  );
}
