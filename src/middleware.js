import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Define which routes are public
const isPublicRoute = createRouteMatcher([
  "/signin",
  "/signup",
  "/",
  "/generate",
]);

export default clerkMiddleware((auth, req) => {
  const { userId } = auth(); // Get the authenticated user

  // If no userId and it's not a public route, redirect to signin
  if (!userId && !isPublicRoute(req)) {
    return NextResponse.redirect(new URL("/signin", req.url));
  }

  // Otherwise, continue as normal
  return NextResponse.next();
});

// Matcher config to exclude static files and apply to API routes too
export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
