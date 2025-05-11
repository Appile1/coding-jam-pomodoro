import { authMiddleware } from "@clerk/nextjs";

export default authMiddleware({
  publicRoutes: ["/", "/signin", "/signup", "/generate"],

  // Optional: force redirect to /signin for non-authenticated users
  afterAuth(auth, req, evt) {
    if (!auth.userId && !auth.isPublicRoute) {
      const signinUrl = new URL("/signin", req.url);
      return Response.redirect(signinUrl);
    }

    return null; // allow to continue
  },
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
