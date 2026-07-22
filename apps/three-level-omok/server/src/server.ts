import Fastify, { type FastifyInstance, type FastifyRequest } from "fastify";
import { readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { Server as SocketServer } from "socket.io";
import { gameCommandSchema, roomCreateSchema, roomJoinSchema } from "@three-level-omok/contracts";
import { createSession, getSessionUser, clearSession, createOAuthState, consumeOAuthState } from "./session.js";
import { createRoom, executeCommand, getRoom, joinRoom, listRooms, reconcileExpiredRoom, roomView, type RoomRecord } from "./room-store.js";
import { loadConfig } from "./config.js";
import { randomUUID } from "node:crypto";

function publicError(error: unknown): { statusCode: number; message: string } {
  if (typeof error === "object" && error !== null && "code" in error) {
    const candidate = error as { code?: string; message?: string };
    return { statusCode: candidate.code === "STALE_STATE" ? 409 : 400, message: candidate.message ?? "Invalid command." };
  }
  return { statusCode: 400, message: error instanceof Error ? error.message : "Invalid request." };
}

function contentType(filePath: string): string {
  return ({ ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".json": "application/json" } as Record<string, string>)[extname(filePath)] ?? "application/octet-stream";
}

function requireUser(request: FastifyRequest): { id: string; nickname: string } {
  const user = getSessionUser(request);
  if (!user) throw new Error("Authentication is required.");
  return user;
}

export async function buildServer(): Promise<{ app: FastifyInstance; io: SocketServer }> {
  const config = loadConfig();
  const app = Fastify({ logger: true });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(cors, { origin: [config.LEGACY_ORIGIN, "http://localhost:5173"], credentials: true });
  await app.register(helmet);
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });

  app.get("/health", async () => ({ ok: true, service: "three-level-omok", node: process.version }));
  const webDist = resolve(process.cwd(), process.env.THREE_MOK_WEB_DIST || "apps/three-level-omok/web/dist");
  app.get("/threemok", async (_request, reply) => reply.redirect("/threemok/"));
  app.get("/threemok/*", async (request, reply) => {
    const relativePath = ((request.params as { "*"?: string })["*"] || "index.html").replace(/^\/+/, "");
    const filePath = resolve(webDist, relativePath);
    if (!filePath.startsWith(webDist)) return reply.code(403).send({ message: "Forbidden" });
    try {
      const body = await readFile(filePath);
      return reply.type(contentType(filePath)).send(body);
    } catch {
      const body = await readFile(resolve(webDist, "index.html"));
      return reply.type("text/html; charset=utf-8").send(body);
    }
  });
  app.get("/api/session", async (request) => ({ user: getSessionUser(request) }));
  app.post("/api/auth/dev", async (request, reply) => {
    if (config.NODE_ENV === "production" && !config.ENABLE_DEV_AUTH) return reply.code(404).send({ message: "Not found" });
    const body = typeof request.body === "object" && request.body !== null ? request.body as { nickname?: string } : {};
    const nickname = (body.nickname ?? "게스트").trim().slice(0, 24) || "게스트";
    const user = { id: `dev-${randomUUID()}`, nickname };
    createSession(reply, user);
    return { user };
  });
  app.get("/api/auth/google/start", async (_request, reply) => {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_REDIRECT_URI) return reply.code(503).send({ message: "Google OAuth is not configured." });
    const state = createOAuthState();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: config.GOOGLE_CLIENT_ID, redirect_uri: config.GOOGLE_REDIRECT_URI, response_type: "code", scope: "openid email profile", state, access_type: "online" }).toString();
    return reply.redirect(url.toString());
  });
  app.get("/api/auth/google/callback", async (request, reply) => {
    if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET || !config.GOOGLE_REDIRECT_URI) return reply.code(503).send({ message: "Google OAuth is not configured." });
    const query = request.query as { code?: string; state?: string };
    if (!query.code || !query.state || !consumeOAuthState(query.state)) return reply.code(400).send({ message: "Invalid OAuth callback." });
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ code: query.code, client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET, redirect_uri: config.GOOGLE_REDIRECT_URI, grant_type: "authorization_code" }) });
    if (!tokenResponse.ok) return reply.code(502).send({ message: "Google token exchange failed." });
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) return reply.code(502).send({ message: "Google access token was not returned." });
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${token.access_token}` } });
    if (!profileResponse.ok) return reply.code(502).send({ message: "Google profile lookup failed." });
    const profile = await profileResponse.json() as { sub?: string; name?: string; email?: string };
    if (!profile.sub) return reply.code(502).send({ message: "Google profile has no subject." });
    createSession(reply, { id: `google-${profile.sub}`, nickname: (profile.name || profile.email || "Google 사용자").slice(0, 24) });
    return reply.redirect(config.THREE_MOK_PUBLIC_URL);
  });
  app.post("/api/auth/logout", async (request, reply) => { clearSession(reply, request); return { ok: true }; });

  app.post("/api/rooms", async (request, reply) => {
    try {
      const user = requireUser(request);
      const body = roomCreateSchema.parse(request.body);
      const room = createRoom({ ...user, nickname: body.nickname });
      return reply.code(201).send(roomView(room));
    } catch (error) {
      return reply.code(401).send({ message: error instanceof Error ? error.message : "Authentication is required." });
    }
  });
  app.post("/api/rooms/:roomCode/join", async (request, reply) => {
    try {
      const user = requireUser(request);
      const params = request.params as { roomCode: string };
      const body = roomJoinSchema.parse({ ...(request.body as object), roomCode: params.roomCode });
      const room = joinRoom(params.roomCode, { ...user, nickname: body.nickname });
      if (!room) return reply.code(409).send({ message: "Room not found or already full." });
      return roomView(room);
    } catch (error) {
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Unable to join room." });
    }
  });
  app.get("/api/rooms/:roomCode", async (request, reply) => {
    const room = getRoom((request.params as { roomCode: string }).roomCode);
    return room ? roomView(room) : reply.code(404).send({ message: "Room not found." });
  });
  app.post("/api/rooms/:roomCode/commands", async (request, reply) => {
    try {
      const user = requireUser(request);
      const command = gameCommandSchema.parse(request.body);
      if ("playerId" in command && command.playerId !== user.id) return reply.code(403).send({ message: "Player mismatch." });
      const room = getRoom((request.params as { roomCode: string }).roomCode);
      if (!room) return reply.code(404).send({ message: "Room not found." });
      return await executeCommand(room, command as never);
    } catch (error) {
      const result = publicError(error);
      return reply.code(result.statusCode).send({ message: result.message });
    }
  });

  const io = new SocketServer(app.server, { path: "/threemok/socket.io", cors: { origin: true, credentials: true } });
  io.on("connection", (socket) => {
    socket.on("room:watch", (code: string) => { const room = getRoom(code); if (room) { socket.join(code); socket.emit("room:state", roomView(room)); } });
    socket.on("game:command", async (payload: unknown, acknowledge?: (value: unknown) => void) => {
      try {
        const command = gameCommandSchema.parse(payload);
        const roomCode = typeof payload === "object" && payload !== null && "roomCode" in payload ? String((payload as { roomCode: string }).roomCode) : "";
        const room = getRoom(roomCode);
        if (!room) throw new Error("Room not found.");
        const result = await executeCommand(room, command as never);
        io.to(roomCode).emit("room:state", { ...roomView(room), events: result.events });
        acknowledge?.({ ok: true, state: result.state });
      } catch (error) { acknowledge?.({ ok: false, message: publicError(error).message }); }
    });
  });
  const timer = setInterval(() => {
    void Promise.all(listRooms().map((room) => reconcileExpiredRoom(room, Date.now()).catch(() => false)));
  }, 1000);
  timer.unref();
  return { app, io };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const { app } = await buildServer();
  await app.listen({ host: config.HOST, port: config.PORT });
}
