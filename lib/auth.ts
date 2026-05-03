import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "fallback-secret-change-me");
const COOKIE = "pb_session";

export async function createSession(): Promise<string> {
  return new SignJWT({ auth: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(SECRET);
}

export async function verifySession(token: string): Promise<boolean> {
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function getSessionFromCookies(): Promise<boolean> {
  const cookieStore = cookies();
  const token = cookieStore.get(COOKIE)?.value;
  if (!token) return false;
  return verifySession(token);
}

export async function getSessionFromRequest(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return false;
  return verifySession(token);
}

export { COOKIE };
