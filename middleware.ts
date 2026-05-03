import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow login page and its API route
  if (pathname.startsWith("/login") || pathname === "/api/auth") {
    return NextResponse.next();
  }

  const authed = await getSessionFromRequest(req);
  if (!authed) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
