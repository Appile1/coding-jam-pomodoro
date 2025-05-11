import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Header from "../componets/header/header.js";
import { ClerkProvider } from "@clerk/nextjs";
import Footer from "../componets/footer/footer.js";
import ChatPopup from "../componets/ChatPopup.jsx";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "FocusFlow: Pomodoro Scheduler & AI Productivity Coach",
  description:
    "FocusFlow helps you manage tasks, schedule Pomodoro sessions, and get AI-powered suggestions for balanced productivity. Stay focused, avoid burnout, and achieve more!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>
          <main style={{ flex: 1 }}>{children}</main>
          <ChatPopup />
        </body>
      </html>
    </ClerkProvider>
  );
}
