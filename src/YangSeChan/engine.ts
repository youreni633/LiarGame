import { Hono } from "hono";
import {
  YS_DEFAULT_WORDS,
  YS_MAX_PLAYERS,
  YS_MIN_PLAYERS,
  YS_PROMPT_INPUT_DURATION_MS,
  YS_STATUS_BY_PHASE,
} from "./constants.js";
import type {
  YSChatMessage,
  YSGameMessage,
  YSPlayer,
  YSRoom,
} from "./types.js";

const yangSeChanRooms = new Map<string, YSRoom>();

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

function pushGameMessage(
  room: YSRoom,
  type: YSGameMessage["type"],
  text: string,
) {
  room.gameMessages.push({
    id: generateId(),
    type,
    text,
    createdAt: now(),
  });
  room.gameMessages = room.gameMessages.slice(-200);
  room.updatedAt = now();
  room.version += 1;
}

function pushChatMessage(room: YSRoom, playerId: string, nickname: string, text: string) {
  room.chatMessages.push({
    id: generateId(),
    playerId,
    nickname,
    text,
    createdAt: now(),
  });
  room.chatMessages = room.chatMessages.slice(-200);
  room.updatedAt = now();
  room.version += 1;
}

function clearRoomTimers(room: YSRoom) {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers = [];
}

function schedule(room: YSRoom, callback: () => void, delay: number) {
  const timer = setTimeout(callback, delay);
  room.timers.push(timer);
}

function getRoom(roomId: string) {
  return yangSeChanRooms.get(roomId);
}

function getPlayer(room: YSRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

function getPlayingPlayers(room: YSRoom) {
  return room.players.filter((player) => player.isPlaying);
}

function updateStatus(room: YSRoom, extra?: string) {
  room.statusText = extra || YS_STATUS_BY_PHASE[room.phase] || "";
  room.updatedAt = now();
  room.version += 1;
}

function randomDefaultWord(excluded: string[]) {
  const available = YS_DEFAULT_WORDS.filter((word) => !excluded.includes(word));
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return YS_DEFAULT_WORDS[Math.floor(Math.random() * YS_DEFAULT_WORDS.length)];
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function buildDerangement(players: YSPlayer[]) {
  const prompts = players.map((player) => ({
    ownerId: player.id,
    prompt: player.submittedPrompt.trim(),
  }));

  if (players.length < 2) {
    return prompts;
  }

  for (let tries = 0; tries < 500; tries += 1) {
    const shuffled = shuffle(prompts);
    if (shuffled.every((item, index) => item.ownerId !== players[index].id)) {
      return shuffled;
    }
  }

  if (players.length === 2) {
    return [prompts[1], prompts[0]];
  }

  return prompts.map((_, index) => prompts[(index + 1) % prompts.length]);
}

function moveToNextTurn(room: YSRoom) {
  const playingPlayers = getPlayingPlayers(room);
  if (playingPlayers.length <= 1) {
    room.lastCompletedLeaderboard = [...room.leaderboard];
    room.phase = "lobby";
    room.players.forEach((player) => {
      player.ready = player.isHost;
      player.submittedPrompt = "";
      player.receivedPrompt = "";
      player.isPlaying = true;
      player.isSpectator = false;
      player.rank = null;
    });
    room.turnOrder = [];
    room.currentTurnIndex = 0;
    room.pendingTurn = null;
    room.promptInputEndsAt = null;
    room.gameMessages = [];
    updateStatus(
      room,
      "게임이 종료되어 로비로 복귀했습니다. 다시 준비 후 시작할 수 있습니다.",
    );
    pushGameMessage(room, "system", "게임 종료! 로비로 돌아갑니다.");
    clearRoomTimers(room);
    return;
  }

  const activeIds = room.turnOrder.filter((id) =>
    room.players.some((player) => player.id === id && player.isPlaying),
  );
  if (activeIds.length === 0) {
    room.turnOrder = playingPlayers.map((player) => player.id);
    room.currentTurnIndex = 0;
  } else {
    room.turnOrder = activeIds;
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  }

  const actor = room.players.find(
    (player) => player.id === room.turnOrder[room.currentTurnIndex],
  );
  room.pendingTurn = actor
    ? {
        actorId: actor.id,
        targetId: null,
        question: "",
        answer: "",
        awaitingAnswer: false,
      }
    : null;
  updateStatus(
    room,
    actor
      ? `${actor.nickname}님의 턴입니다. 질문을 하거나 정답 시도를 진행하세요.`
      : YS_STATUS_BY_PHASE.turn,
  );
}

function finalizePromptPhase(room: YSRoom) {
  if (room.phase !== "prompt_input") return;
  clearRoomTimers(room);

  const usedWords: string[] = [];
  room.players.forEach((player) => {
    if (!player.submittedPrompt.trim()) {
      const fallback = randomDefaultWord(usedWords);
      player.submittedPrompt = fallback;
      usedWords.push(fallback);
    } else {
      usedWords.push(player.submittedPrompt.trim());
    }
  });

  const deranged = buildDerangement(room.players);
  room.players.forEach((player, index) => {
    player.receivedPrompt = deranged[index]?.prompt || "";
    player.isPlaying = true;
    player.isSpectator = false;
    player.rank = null;
  });

  room.phase = "turn";
  room.leaderboard = [];
  room.turnOrder = room.players.map((player) => player.id);
  room.currentTurnIndex = -1;
  room.pendingTurn = null;
  room.promptInputEndsAt = null;
  room.gameMessages = [];
  pushGameMessage(
    room,
    "system",
    "모든 제시어 배정이 완료되었습니다. 스무고개 턴을 시작합니다.",
  );
  moveToNextTurn(room);
}

function buildState(room: YSRoom, playerId: string, sinceVersion: number) {
  if (room.version <= sinceVersion) {
    return { changed: false, version: room.version };
  }

  const me = getPlayer(room, playerId);
  const currentActorId = room.pendingTurn?.actorId || "";
  const currentTargetId = room.pendingTurn?.targetId || "";

  return {
    changed: true,
    version: room.version,
    room: {
      id: room.id,
      name: room.name,
      phase: room.phase,
      hostId: room.hostId,
      statusText: room.statusText,
      promptInputEndsAt: room.promptInputEndsAt,
      currentActorId,
      currentTargetId,
      currentActorNickname:
        room.players.find((player) => player.id === currentActorId)?.nickname || "",
    },
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      ready: player.ready,
      isHost: player.isHost,
      isPlaying: player.isPlaying,
      isSpectator: player.isSpectator,
      rank: player.rank,
      receivedPrompt:
        me?.isSpectator || room.phase === "lobby" ? player.receivedPrompt : undefined,
    })),
    leaderboard: room.leaderboard,
    lastCompletedLeaderboard: room.lastCompletedLeaderboard,
    gameMessages: room.gameMessages,
    chatMessages: room.chatMessages,
    myState: me
      ? {
          id: me.id,
          nickname: me.nickname,
          ready: me.ready,
          isHost: me.isHost,
          isPlaying: me.isPlaying,
          isSpectator: me.isSpectator,
          rank: me.rank,
          submittedPrompt: me.submittedPrompt,
          receivedPrompt: me.receivedPrompt,
        }
      : null,
    canSubmitPrompt: room.phase === "prompt_input",
    canAskQuestion:
      room.phase === "turn" &&
      !!me?.isPlaying &&
      room.pendingTurn?.actorId === playerId &&
      !room.pendingTurn?.awaitingAnswer,
    canAnswerQuestion:
      room.phase === "turn" &&
      room.pendingTurn?.awaitingAnswer === true &&
      room.pendingTurn?.targetId === playerId,
    pendingTurn: room.pendingTurn,
  };
}

function createRoom(roomName: string, nickname: string) {
  const roomId = `ys-${generateId()}`;
  const hostId = generateId();
  const host: YSPlayer = {
    id: hostId,
    nickname,
    isHost: true,
    ready: true,
    connected: true,
    submittedPrompt: "",
    receivedPrompt: "",
    isPlaying: true,
    isSpectator: false,
    rank: null,
  };

  const room: YSRoom = {
    id: roomId,
    name: roomName || `양세찬-${roomId.slice(-4)}`,
    hostId,
    phase: "lobby",
    createdAt: now(),
    updatedAt: now(),
    version: 1,
    players: [host],
    leaderboard: [],
    gameMessages: [],
    chatMessages: [],
    promptInputEndsAt: null,
    turnOrder: [],
    currentTurnIndex: 0,
    pendingTurn: null,
    statusText: YS_STATUS_BY_PHASE.lobby,
    lastCompletedLeaderboard: [],
    timers: [],
  };

  yangSeChanRooms.set(room.id, room);
  pushGameMessage(room, "system", "양세찬 게임 방이 생성되었습니다.");
  return { roomId, playerId: hostId };
}

export function registerYangSeChanRoutes(app: Hono) {
  app.get("/api/yangsechan/rooms", (c) => {
    return c.json({
      rooms: Array.from(yangSeChanRooms.values()).map((room) => ({
        id: room.id,
        name: room.name,
        phase: room.phase,
        playerCount: room.players.length,
        maxPlayers: YS_MAX_PLAYERS,
      })),
    });
  });

  app.post("/api/yangsechan/rooms", async (c) => {
    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    const roomName = String(body.roomName || "").trim();
    if (!nickname) return c.json({ error: "닉네임을 입력해주세요." }, 400);
    return c.json(createRoom(roomName, nickname));
  });

  app.post("/api/yangsechan/rooms/:roomId/join", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") {
      return c.json({ error: "게임이 진행 중인 방에는 참가할 수 없습니다." }, 400);
    }
    if (room.players.length >= YS_MAX_PLAYERS) {
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
      submittedPrompt: "",
      receivedPrompt: "",
      isPlaying: true,
      isSpectator: false,
      rank: null,
    });
    updateStatus(room);
    pushGameMessage(room, "system", `${nickname}님이 방에 참가했습니다.`);
    return c.json({ roomId: room.id, playerId });
  });

  app.post("/api/yangsechan/rooms/:roomId/leave", async (c) => {
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
      yangSeChanRooms.delete(room.id);
      return c.json({ success: true });
    }

    updateStatus(room);
    pushGameMessage(room, "system", `${player.nickname}님이 방을 나갔습니다.`);
    return c.json({ success: true });
  });

  app.post("/api/yangsechan/rooms/:roomId/ready", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") return c.json({ error: "로비에서만 준비할 수 있습니다." }, 400);

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

  app.post("/api/yangsechan/rooms/:roomId/start", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") return c.json({ error: "이미 게임이 시작되었습니다." }, 400);

    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    if (playerId !== room.hostId) return c.json({ error: "방장만 시작할 수 있습니다." }, 403);
    if (room.players.length < YS_MIN_PLAYERS) {
      return c.json({ error: "최소 2명이 필요합니다." }, 400);
    }
    if (room.players.some((player) => !player.ready)) {
      return c.json({ error: "모든 유저가 준비해야 시작할 수 있습니다." }, 400);
    }

    room.phase = "prompt_input";
    room.promptInputEndsAt = now() + YS_PROMPT_INPUT_DURATION_MS;
    room.players.forEach((player) => {
      player.submittedPrompt = "";
      player.receivedPrompt = "";
      player.isPlaying = true;
      player.isSpectator = false;
      player.rank = null;
    });
    room.leaderboard = [];
    room.lastCompletedLeaderboard = [];
    room.pendingTurn = null;
    room.turnOrder = [];
    room.currentTurnIndex = 0;
    room.gameMessages = [];
    updateStatus(room, YS_STATUS_BY_PHASE.prompt_input);
    pushGameMessage(
      room,
      "system",
      "게임 시작! 3분 안에 각자 제시어를 입력하세요.",
    );
    clearRoomTimers(room);
    schedule(room, () => finalizePromptPhase(room), YS_PROMPT_INPUT_DURATION_MS);
    return c.json({ success: true });
  });

  app.post("/api/yangsechan/rooms/:roomId/prompt", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "prompt_input") {
      return c.json({ error: "제시어 입력 단계가 아닙니다." }, 400);
    }
    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return c.json({ error: "제시어를 입력해주세요." }, 400);
    player.submittedPrompt = prompt;
    updateStatus(room, `${player.nickname}님이 제시어를 입력했습니다.`);

    if (room.players.every((item) => item.submittedPrompt.trim())) {
      finalizePromptPhase(room);
    }

    return c.json({ success: true });
  });

  app.post("/api/yangsechan/rooms/:roomId/question", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "turn") return c.json({ error: "턴 진행 단계가 아닙니다." }, 400);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const targetId = String(body.targetId || "");
    const question = String(body.question || "").trim();
    if (!question) return c.json({ error: "질문을 입력해주세요." }, 400);
    if (!room.pendingTurn || room.pendingTurn.actorId !== playerId) {
      return c.json({ error: "지금은 질문할 차례가 아닙니다." }, 400);
    }
    const target = getPlayer(room, targetId);
    if (!target || !target.isPlaying || target.id === playerId) {
      return c.json({ error: "질문 대상을 다시 선택해주세요." }, 400);
    }

    room.pendingTurn = {
      actorId: playerId,
      targetId,
      question,
      answer: "",
      awaitingAnswer: true,
    };
    pushGameMessage(
      room,
      "question",
      `${getPlayer(room, playerId)?.nickname} → ${target.nickname}: ${question}`,
    );
    updateStatus(room, `${target.nickname}님이 답변해야 합니다.`);
    return c.json({ success: true });
  });

  app.post("/api/yangsechan/rooms/:roomId/answer", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "turn" || !room.pendingTurn?.awaitingAnswer) {
      return c.json({ error: "현재 답변할 질문이 없습니다." }, 400);
    }
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const answer = String(body.answer || "").trim();
    if (!answer) return c.json({ error: "답변을 입력해주세요." }, 400);
    if (room.pendingTurn.targetId !== playerId) {
      return c.json({ error: "지금은 답변할 차례가 아닙니다." }, 400);
    }

    room.pendingTurn.answer = answer;
    room.pendingTurn.awaitingAnswer = false;
    pushGameMessage(
      room,
      "answer",
      `${getPlayer(room, playerId)?.nickname}: ${answer}`,
    );
    moveToNextTurn(room);
    return c.json({ success: true });
  });

  app.post("/api/yangsechan/rooms/:roomId/guess", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "turn") return c.json({ error: "턴 진행 단계가 아닙니다." }, 400);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const guess = String(body.guess || "").trim();
    if (!guess) return c.json({ error: "정답을 입력해주세요." }, 400);
    if (!room.pendingTurn || room.pendingTurn.actorId !== playerId) {
      return c.json({ error: "지금은 정답 시도 차례가 아닙니다." }, 400);
    }
    const player = getPlayer(room, playerId);
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);

    const isCorrect = player.receivedPrompt.trim().toLowerCase() === guess.toLowerCase();
    pushGameMessage(
      room,
      "guess",
      `${player.nickname}님이 정답 시도: ${guess}${isCorrect ? " (정답)" : " (오답)"}`,
    );

    if (isCorrect) {
      player.isPlaying = false;
      player.isSpectator = true;
      player.rank = room.leaderboard.length + 1;
      room.leaderboard.push(player.nickname);
    }

    moveToNextTurn(room);
    return c.json({ success: true, correct: isCorrect });
  });

  app.post("/api/yangsechan/rooms/:roomId/chat", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const nickname = String(body.nickname || "").trim();
    const text = String(body.text || body.message || "").trim();
    if (!text) return c.json({ success: true });
    const player =
      getPlayer(room, playerId) || room.players.find((item) => item.nickname === nickname);
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);

    pushChatMessage(room, player.id, player.nickname, text);
    return c.json({ success: true });
  });

  app.get("/api/yangsechan/rooms/:roomId/state", (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const playerId = c.req.query("playerId") || "";
    const sinceVersion = Number(c.req.query("v") || "0");
    return c.json(buildState(room, playerId, sinceVersion));
  });
}
