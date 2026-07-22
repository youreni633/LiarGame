import { randomUUID } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";

export type SessionUser = { id: string; nickname: string };

const COOKIE_NAME = "three_mok_session";
const sessions = new Map<string, SessionUser>();
const oauthStates = new Map<string, number>();

export function createSession(reply: FastifyReply, user: SessionUser): void {
  const sessionId = randomUUID();
  sessions.set(sessionId, user);
  reply.setCookie(COOKIE_NAME, sessionId, { httpOnly: true, sameSite: "lax", secure: false, path: "/" });
}

export function getSessionUser(request: FastifyRequest): SessionUser | null {
  const id = request.cookies[COOKIE_NAME];
  return id ? sessions.get(id) ?? null : null;
}

export function clearSession(reply: FastifyReply, request: FastifyRequest): void {
  const id = request.cookies[COOKIE_NAME];
  if (id) sessions.delete(id);
  reply.clearCookie(COOKIE_NAME, { path: "/" });
}

export function createOAuthState(): string {
  const state = randomUUID();
  oauthStates.set(state, Date.now() + 10 * 60 * 1000);
  return state;
}

export function consumeOAuthState(state: string): boolean {
  const expiresAt = oauthStates.get(state);
  oauthStates.delete(state);
  return Boolean(expiresAt && expiresAt > Date.now());
}
