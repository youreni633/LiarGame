import { Hono } from "hono";
import {
  FW_ASSIGNMENT_DURATION_MS,
  FW_DEFAULT_WORDS,
  FW_MAX_PLAYERS,
  FW_MIN_PLAYERS,
  FW_RESULT_DURATION_MS,
  FW_STATUS_BY_PHASE,
} from "./constants.js";
import type { FWChatMessage, FWPlayer, FWResult, FWRoom } from "./types.js";

const forbiddenWordRooms = new Map<string, FWRoom>();

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

function getRoom(roomId: string) {
  return forbiddenWordRooms.get(roomId);
}

function getPlayer(room: FWRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

function getAlivePlayers(room: FWRoom) {
  return room.players.filter((player) => player.isAlive);
}

function clearRoomTimers(room: FWRoom) {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers = [];
}

function schedule(room: FWRoom, callback: () => void, delay: number) {
  const timer = setTimeout(callback, delay);
  room.timers.push(timer);
}

function bumpRoom(room: FWRoom) {
  room.updatedAt = now();
  room.version += 1;
}

function updateStatus(room: FWRoom, statusText?: string) {
  room.statusText = statusText || FW_STATUS_BY_PHASE[room.phase];
  bumpRoom(room);
}

function pushChatMessage(
  room: FWRoom,
  message: Omit<FWChatMessage, "id" | "createdAt">,
) {
  room.chatMessages.push({
    id: generateId(),
    createdAt: now(),
    ...message,
  });
  room.chatMessages = room.chatMessages.slice(-300);
  bumpRoom(room);
}

function cleanupForbiddenWordRooms() {
  const threshold = now() - 30 * 60 * 1000;
  for (const [roomId, room] of forbiddenWordRooms.entries()) {
    if (room.players.length === 0 || room.updatedAt < threshold) {
      clearRoomTimers(room);
      forbiddenWordRooms.delete(roomId);
    }
  }
}

function normalizeText(value: string) {
  return value.trim().toLocaleLowerCase("ko-KR");
}

function randomDefaultWord(excluded: string[]) {
  const available = FW_DEFAULT_WORDS.filter((word) => !excluded.includes(word));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return FW_DEFAULT_WORDS[Math.floor(Math.random() * FW_DEFAULT_WORDS.length)];
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildTargetAssignments(players: FWPlayer[]) {
  if (players.length < 2) {
    return players.map((player) => ({ setterId: player.id, targetId: null }));
  }

  const playerIds = players.map((player) => player.id);
  for (let tries = 0; tries < 500; tries += 1) {
    const shuffled = shuffle(playerIds);
    if (shuffled.every((targetId, index) => targetId !== playerIds[index])) {
      return playerIds.map((setterId, index) => ({
        setterId,
        targetId: shuffled[index],
      }));
    }
  }

  return playerIds.map((setterId, index) => ({
    setterId,
    targetId: playerIds[(index + 1) % playerIds.length],
  }));
}

function assignTargets(room: FWRoom) {
  const assignments = buildTargetAssignments(room.players);
  room.players.forEach((player) => {
    player.assignedTargetId =
      assignments.find((assignment) => assignment.setterId === player.id)?.targetId ||
      null;
    player.submittedWord = "";
    player.forbiddenWord = "";
    player.isAlive = true;
    player.eliminatedOrder = null;
  });
}

function finalizeAssignmentPhase(room: FWRoom) {
  if (room.phase !== "assignment") return;

  clearRoomTimers(room);

  const usedWords: string[] = room.players
    .map((player) => player.submittedWord.trim())
    .filter(Boolean);

  room.players.forEach((player) => {
    if (!player.submittedWord.trim()) {
      player.submittedWord = randomDefaultWord(usedWords);
      usedWords.push(player.submittedWord);
    }
  });

  room.players.forEach((setter) => {
    const target = setter.assignedTargetId
      ? getPlayer(room, setter.assignedTargetId)
      : null;
    if (target) {
      target.forbiddenWord = setter.submittedWord.trim();
    }
  });

  room.phase = "playing";
  room.assignmentEndsAt = null;
  room.result = null;
  room.chatMessages = [];
  updateStatus(room, FW_STATUS_BY_PHASE.playing);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: "금지어 설정이 완료되었습니다. 지금부터 자유롭게 채팅할 수 있습니다.",
  });
}

function restartAssignmentPhase(room: FWRoom, reasonText: string) {
  room.phase = "assignment";
  room.assignmentEndsAt = now() + FW_ASSIGNMENT_DURATION_MS;
  room.result = null;
  room.chatMessages = [];
  assignTargets(room);
  updateStatus(room, FW_STATUS_BY_PHASE.assignment);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: reasonText,
  });
  clearRoomTimers(room);
  schedule(room, () => finalizeAssignmentPhase(room), FW_ASSIGNMENT_DURATION_MS);
}

function resetRoomToLobby(room: FWRoom) {
  clearRoomTimers(room);
  room.phase = "lobby";
  room.assignmentEndsAt = null;
  room.result = null;
  room.chatMessages = [];
  room.players.forEach((player) => {
    player.ready = player.isHost;
    player.isAlive = true;
    player.assignedTargetId = null;
    player.submittedWord = "";
    player.forbiddenWord = "";
    player.eliminatedOrder = null;
  });
  updateStatus(room, FW_STATUS_BY_PHASE.lobby);
}

function finishGameIfNeeded(room: FWRoom) {
  const alivePlayers = getAlivePlayers(room);
  if (alivePlayers.length > 1) return;

  const winner = alivePlayers[0];
  const result: FWResult = {
    winnerId: winner?.id || "",
    winnerNickname: winner?.nickname || "승자 없음",
    caption: winner
      ? `최후의 1인 ${winner.nickname} 님이 승리했습니다!`
      : "모든 플레이어가 탈락하여 승자가 없습니다.",
  };
  room.phase = "result";
  room.result = result;
  updateStatus(room, result.caption);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: `🏆 ${result.caption} 잠시 후 로비로 돌아갑니다.`,
  });
  clearRoomTimers(room);
  schedule(room, () => resetRoomToLobby(room), FW_RESULT_DURATION_MS);
}

function buildState(room: FWRoom, playerId: string, sinceVersion: number) {
  if (room.version <= sinceVersion) {
    return { changed: false, version: room.version };
  }

  const me = getPlayer(room, playerId);
  const myTarget = me?.assignedTargetId ? getPlayer(room, me.assignedTargetId) : null;
  const eliminatedCount = room.players.filter((player) => !player.isAlive).length;

  return {
    changed: true,
    version: room.version,
    room: {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      phase: room.phase,
      playerCount: room.players.length,
      maxPlayers: FW_MAX_PLAYERS,
      statusText: room.statusText,
      assignmentEndsAt: room.assignmentEndsAt,
      eliminatedCount,
      result: room.result,
    },
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      ready: player.ready,
      isHost: player.isHost,
      isAlive: player.isAlive,
      eliminatedOrder: player.eliminatedOrder,
      forbiddenWord:
        room.phase === "playing" || room.phase === "result"
          ? player.id === playerId
            ? ""
            : player.forbiddenWord
          : "",
    })),
    chatMessages: room.chatMessages,
    myState: me
      ? {
          id: me.id,
          nickname: me.nickname,
          ready: me.ready,
          isHost: me.isHost,
          isAlive: me.isAlive,
          assignedTargetId: me.assignedTargetId,
          targetNickname: myTarget?.nickname || "",
          submittedWord: me.submittedWord,
          forbiddenWord: me.forbiddenWord,
        }
      : null,
  };
}

function createRoom(roomName: string, nickname: string) {
  const roomId = `fw-${generateId()}`;
  const hostId = generateId();
  const host: FWPlayer = {
    id: hostId,
    nickname,
    isHost: true,
    ready: true,
    connected: true,
    isAlive: true,
    assignedTargetId: null,
    submittedWord: "",
    forbiddenWord: "",
    eliminatedOrder: null,
  };

  const room: FWRoom = {
    id: roomId,
    name: roomName || `금지어-${roomId.slice(-4)}`,
    hostId,
    phase: "lobby",
    createdAt: now(),
    updatedAt: now(),
    version: 1,
    players: [host],
    chatMessages: [],
    assignmentEndsAt: null,
    statusText: FW_STATUS_BY_PHASE.lobby,
    result: null,
    timers: [],
  };

  forbiddenWordRooms.set(room.id, room);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: "금지어 게임 방이 생성되었습니다.",
  });
  return { roomId, playerId: hostId };
}

export function registerForbiddenWordRoutes(app: Hono) {
  app.get("/api/forbidden-word/rooms", (c) => {
    cleanupForbiddenWordRooms();
    return c.json({
      rooms: Array.from(forbiddenWordRooms.values()).map((room) => ({
        id: room.id,
        name: room.name,
        phase: room.phase,
        playerCount: room.players.length,
        maxPlayers: FW_MAX_PLAYERS,
      })),
    });
  });

  app.post("/api/forbidden-word/rooms", async (c) => {
    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    const roomName = String(body.roomName || "").trim();
    if (!nickname) return c.json({ error: "닉네임을 입력해주세요." }, 400);
    return c.json(createRoom(roomName, nickname));
  });

  app.post("/api/forbidden-word/rooms/:roomId/join", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") {
      return c.json({ error: "게임 진행 중인 방에는 입장할 수 없습니다." }, 400);
    }
    if (room.players.length >= FW_MAX_PLAYERS) {
      return c.json({ error: "방이 가득 찼습니다." }, 400);
    }

    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    if (!nickname) return c.json({ error: "닉네임을 입력해주세요." }, 400);
    if (room.players.some((player) => player.nickname === nickname)) {
      return c.json({ error: "이미 사용 중인 닉네임입니다." }, 400);
    }

    const playerId = generateId();
    room.players.push({
      id: playerId,
      nickname,
      isHost: false,
      ready: false,
      connected: true,
      isAlive: true,
      assignedTargetId: null,
      submittedWord: "",
      forbiddenWord: "",
      eliminatedOrder: null,
    });
    updateStatus(room);
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: `${nickname} 님이 방에 참가했습니다.`,
    });
    return c.json({ roomId: room.id, playerId });
  });

  app.post("/api/forbidden-word/rooms/:roomId/leave", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ success: true });
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const player = getPlayer(room, playerId);
    if (!player) return c.json({ success: true });

    room.players = room.players.filter((item) => item.id !== playerId);
    if (room.hostId === playerId && room.players[0]) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      room.players[0].ready = true;
    }

    if (room.players.length === 0) {
      clearRoomTimers(room);
      forbiddenWordRooms.delete(room.id);
      return c.json({ success: true });
    }

    updateStatus(room);
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: `${player.nickname} 님이 방을 나갔습니다.`,
    });

    if (room.phase === "assignment") {
      restartAssignmentPhase(
        room,
        "참가자 구성이 바뀌어 금지어 설정 단계를 다시 시작합니다.",
      );
      return c.json({ success: true });
    }

    if (room.phase === "playing" || room.phase === "result") {
      finishGameIfNeeded(room);
    }
    return c.json({ success: true });
  });

  app.post("/api/forbidden-word/rooms/:roomId/ready", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") {
      return c.json({ error: "로비에서만 준비 상태를 바꿀 수 있습니다." }, 400);
    }

    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (player.isHost) {
      player.ready = true;
    } else {
      player.ready = !player.ready;
    }
    updateStatus(room);
    return c.json({ success: true, ready: player.ready });
  });

  app.post("/api/forbidden-word/rooms/:roomId/start", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") return c.json({ error: "이미 시작된 게임입니다." }, 400);

    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    if (playerId !== room.hostId) {
      return c.json({ error: "방장만 게임을 시작할 수 있습니다." }, 403);
    }
    if (room.players.length < FW_MIN_PLAYERS) {
      return c.json({ error: "최소 2명이 필요합니다." }, 400);
    }
    if (room.players.some((player) => !player.ready)) {
      return c.json({ error: "모든 플레이어가 준비해야 시작할 수 있습니다." }, 400);
    }

    room.phase = "assignment";
    room.assignmentEndsAt = now() + FW_ASSIGNMENT_DURATION_MS;
    room.result = null;
    room.chatMessages = [];
    assignTargets(room);
    updateStatus(room, FW_STATUS_BY_PHASE.assignment);
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: "타겟에게 넣을 금지어를 입력해주세요. 3분 뒤 자동으로 마감됩니다.",
    });
    clearRoomTimers(room);
    schedule(room, () => finalizeAssignmentPhase(room), FW_ASSIGNMENT_DURATION_MS);
    return c.json({ success: true });
  });

  app.post("/api/forbidden-word/rooms/:roomId/word", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "assignment") {
      return c.json({ error: "금지어 설정 단계가 아닙니다." }, 400);
    }

    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (player.submittedWord.trim()) {
      return c.json({ success: true, submitted: true });
    }

    const word = String(body.word || "").trim();
    if (!word) return c.json({ error: "금지어를 입력해주세요." }, 400);
    player.submittedWord = word;
    updateStatus(
      room,
      `${player.nickname} 님이 금지어를 제출했습니다. (${room.players.filter((item) => item.submittedWord.trim()).length}/${room.players.length})`,
    );

    if (room.players.every((item) => item.submittedWord.trim())) {
      finalizeAssignmentPhase(room);
    }

    return c.json({ success: true, submitted: true });
  });

  app.post("/api/forbidden-word/rooms/:roomId/chat", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "playing") {
      return c.json({ error: "지금은 채팅 가능한 단계가 아닙니다." }, 400);
    }

    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (!player.isAlive) {
      return c.json({ error: "탈락한 플레이어는 채팅할 수 없습니다." }, 400);
    }

    const text = String(body.text || body.message || "").trim();
    if (!text) return c.json({ success: true });

    pushChatMessage(room, {
      type: "chat",
      playerId: player.id,
      nickname: player.nickname,
      text,
    });

    const normalizedMessage = normalizeText(text);
    const normalizedForbiddenWord = normalizeText(player.forbiddenWord);
    if (
      normalizedForbiddenWord &&
      normalizedMessage.includes(normalizedForbiddenWord)
    ) {
      player.isAlive = false;
      player.eliminatedOrder =
        room.players.filter((item) => item.eliminatedOrder !== null).length + 1;
      bumpRoom(room);
      pushChatMessage(room, {
        type: "system",
        playerId: "system",
        nickname: "시스템",
        text: `🚨 잡았다 요놈! ${player.nickname} 님이 금지어(${player.forbiddenWord})를 말하여 탈락했습니다!`,
      });
      finishGameIfNeeded(room);
      return c.json({ success: true, caught: true });
    }

    return c.json({ success: true, caught: false });
  });

  app.get("/api/forbidden-word/rooms/:roomId/state", (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const playerId = c.req.query("playerId") || "";
    if (!getPlayer(room, playerId)) {
      return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    }
    const sinceVersion = Number(c.req.query("v") || "0");
    return c.json(buildState(room, playerId, sinceVersion));
  });
}
