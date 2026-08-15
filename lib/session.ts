import { cookies } from "next/headers";
import { randomUUID } from "crypto";

export const SESSION_COOKIE = "session_id";

export async function getOrCreateSessionId(): Promise<string> {
  const jar = cookies();
  const existing = jar.get(SESSION_COOKIE)?.value;
  if (existing) {
    return existing;
  }

  const sessionId = randomUUID();
  jar.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === "production",
  });
  return sessionId;
}

export async function getSessionId(): Promise<string | null> {
  return cookies().get(SESSION_COOKIE)?.value ?? null;
}
