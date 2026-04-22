import { Hono } from "hono";
import {
  SF_FINAL_VOTE_DURATION_MS,
  SF_LOCATIONS,
  SF_MAX_PLAYERS,
  SF_MIN_PLAYERS,
  SF_RESULT_DURATION_MS,
  SF_ROUND_DURATION_MS,
  SF_STATUS_BY_PHASE,
} from "./constants.js";
import type { SFChatMessage, SFPlayer, SFResult, SFRoom } from "./types.js";

const spyfallRooms = new Map<string, SFRoom>();

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

function getRoom(roomId: string) {
  return spyfallRooms.get(roomId);
}

function getPlayer(room: SFRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

function clearRoomTimers(room: SFRoom) {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers = [];
}

function schedule(room: SFRoom, callback: () => void, delay: number) {
  const timer = setTimeout(callback, delay);
  room.timers.push(timer);
}

function bumpRoom(room: SFRoom) {
  room.updatedAt = now();
  room.version += 1;
}

function updateStatus(room: SFRoom, statusText?: string) {
  room.statusText = statusText || SF_STATUS_BY_PHASE[room.phase];
  bumpRoom(room);
}

function pushChatMessage(
  room: SFRoom,
  message: Omit<SFChatMessage, "id" | "createdAt">,
) {
  room.chatMessages.push({
    id: generateId(),
    createdAt: now(),
    ...message,
  });
  room.chatMessages = room.chatMessages.slice(-300);
  bumpRoom(room);
}

function cleanupSpyfallRooms() {
  const threshold = now() - 30 * 60 * 1000;
  for (const [roomId, room] of spyfallRooms.entries()) {
    if (room.players.length === 0 || room.updatedAt < threshold) {
      clearRoomTimers(room);
      spyfallRooms.delete(roomId);
    }
  }
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickCandidateLocations(actualLocation: string) {
  const others = shuffle(
    SF_LOCATIONS.filter((location) => location !== actualLocation),
  ).slice(0, 19);
  return shuffle([actualLocation, ...others]);
}

function majorityThreshold(room: SFRoom) {
  return Math.floor(room.players.length / 2) + 1;
}

function tallyVotes(room: SFRoom) {
  const counts = new Map<string, number>();
  room.players.forEach((player) => {
    if (player.voteTargetId) {
      counts.set(player.voteTargetId, (counts.get(player.voteTargetId) || 0) + 1);
    }
  });
  return counts;
}

function summarizeVoteLeader(room: SFRoom) {
  const counts = tallyVotes(room);
  const ranked = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  const [targetId, votes] = ranked[0];
  const isTie = ranked.length > 1 && ranked[1][1] === votes;
  return { targetId, votes, isTie };
}

function resetRoomToLobby(room: SFRoom, notice?: string) {
  clearRoomTimers(room);
  room.phase = "lobby";
  room.location = null;
  room.candidateLocations = [];
  room.spyPlayerId = null;
  room.roundEndsAt = null;
  room.voteEndsAt = null;
  room.result = null;
  room.players.forEach((player) => {
    player.ready = player.isHost;
    player.role = null;
    player.voteTargetId = null;
  });
  room.chatMessages = [];
  updateStatus(room, notice || SF_STATUS_BY_PHASE.lobby);
  if (notice) {
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: notice,
    });
  }
}

function finishGame(room: SFRoom, result: SFResult) {
  clearRoomTimers(room);
  room.phase = "result";
  room.roundEndsAt = null;
  room.voteEndsAt = null;
  room.result = result;
  updateStatus(room, result.caption);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: result.caption,
  });
  schedule(room, () => resetRoomToLobby(room), SF_RESULT_DURATION_MS);
}

function resolveVote(room: SFRoom, targetId: string, source: SFResult["source"]) {
  const target = getPlayer(room, targetId);
  const spy = room.spyPlayerId ? getPlayer(room, room.spyPlayerId) : null;
  const location = room.location || "";
  if (!target || !spy) return;

  const citizensWin = target.id === spy.id;
  finishGame(room, {
    winnerTeam: citizensWin ? "citizen" : "spy",
    caption: citizensWin
      ? `시민 승리! ${target.nickname} 님이 스파이였고 장소는 ${location} 이었습니다.`
      : `스파이 승리! 시민들이 ${target.nickname} 님을 잘못 지목했습니다. 실제 장소는 ${location} 이었습니다.`,
    location,
    spyPlayerId: spy.id,
    spyNickname: spy.nickname,
    accusedPlayerId: target.id,
    accusedNickname: target.nickname,
    source,
  });
}

function resolveTimeoutFinalVote(room: SFRoom) {
  if (room.phase !== "final_vote") return;
  const leader = summarizeVoteLeader(room);
  if (!leader || leader.isTie) {
    const spy = room.spyPlayerId ? getPlayer(room, room.spyPlayerId) : null;
    if (!spy || !room.location) return;
    finishGame(room, {
      winnerTeam: "spy",
      caption: `스파이 승리! 최종 투표에서 합의에 실패했습니다. 실제 장소는 ${room.location} 이었습니다.`,
      location: room.location,
      spyPlayerId: spy.id,
      spyNickname: spy.nickname,
      source: "timeout_no_consensus",
    });
    return;
  }
  resolveVote(room, leader.targetId, "timeout_vote");
}

function startFinalVote(room: SFRoom, reason: string) {
  if (room.phase !== "playing") return;
  clearRoomTimers(room);
  room.phase = "final_vote";
  room.voteEndsAt = now() + SF_FINAL_VOTE_DURATION_MS;
  room.roundEndsAt = null;
  room.players.forEach((player) => {
    player.voteTargetId = null;
  });
  updateStatus(room, reason);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: "시간이 종료되어 최종 투표가 시작되었습니다. 60초 안에 스파이를 지목하세요.",
  });
  schedule(room, () => resolveTimeoutFinalVote(room), SF_FINAL_VOTE_DURATION_MS);
}

function buildState(room: SFRoom, playerId: string, sinceVersion: number) {
  if (room.version <= sinceVersion) {
    return { changed: false, version: room.version };
  }

  const me = getPlayer(room, playerId);
  const spy = room.spyPlayerId ? getPlayer(room, room.spyPlayerId) : null;
  const voteCounts = tallyVotes(room);

  return {
    changed: true,
    version: room.version,
    room: {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      phase: room.phase,
      playerCount: room.players.length,
      maxPlayers: SF_MAX_PLAYERS,
      statusText: room.statusText,
      roundEndsAt: room.roundEndsAt,
      voteEndsAt: room.voteEndsAt,
      result: room.result,
    },
    players: room.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      ready: player.ready,
      isHost: player.isHost,
      voteTargetId: player.voteTargetId,
      receivedVotes: voteCounts.get(player.id) || 0,
      revealedRole:
        room.phase === "result" ? (player.id === room.spyPlayerId ? "spy" : "citizen") : null,
    })),
    chatMessages: room.chatMessages,
    myState: me
      ? {
          id: me.id,
          nickname: me.nickname,
          isHost: me.isHost,
          ready: me.ready,
          role: me.role,
          voteTargetId: me.voteTargetId,
          isSpy: me.role === "spy",
          location:
            room.phase === "result"
              ? room.location
              : me.role === "spy"
                ? ""
                : room.location,
          candidateLocations:
            room.phase === "playing" ||
            room.phase === "final_vote" ||
            room.phase === "guessing" ||
            room.phase === "result"
              ? room.candidateLocations
              : [],
          canGuess:
            me.role === "spy" && (room.phase === "playing" || room.phase === "final_vote"),
          spyNickname: room.phase === "result" ? spy?.nickname || "" : "",
        }
      : null,
  };
}

function createRoom(roomName: string, nickname: string) {
  const roomId = `sf-${generateId()}`;
  const hostId = generateId();
  const host: SFPlayer = {
    id: hostId,
    nickname,
    isHost: true,
    ready: true,
    connected: true,
    role: null,
    voteTargetId: null,
  };

  const room: SFRoom = {
    id: roomId,
    name: roomName || `스파이폴-${roomId.slice(-4)}`,
    hostId,
    phase: "lobby",
    createdAt: now(),
    updatedAt: now(),
    version: 1,
    players: [host],
    chatMessages: [],
    statusText: SF_STATUS_BY_PHASE.lobby,
    location: null,
    candidateLocations: [],
    spyPlayerId: null,
    roundEndsAt: null,
    voteEndsAt: null,
    result: null,
    timers: [],
  };

  spyfallRooms.set(room.id, room);
  pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text: "스파이폴 방이 생성되었습니다.",
  });
  return { roomId, playerId: hostId };
}

export function registerSpyfallRoutes(app: Hono) {
  app.get("/api/spyfall/rooms", (c) => {
    cleanupSpyfallRooms();
    return c.json({
      rooms: Array.from(spyfallRooms.values()).map((room) => ({
        id: room.id,
        name: room.name,
        phase: room.phase,
        playerCount: room.players.length,
        maxPlayers: SF_MAX_PLAYERS,
      })),
    });
  });

  app.post("/api/spyfall/rooms", async (c) => {
    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    const roomName = String(body.roomName || "").trim();
    if (!nickname) return c.json({ error: "닉네임을 입력해 주세요." }, 400);
    return c.json(createRoom(roomName, nickname));
  });

  app.post("/api/spyfall/rooms/:roomId/join", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") {
      return c.json({ error: "이미 진행 중인 방에는 입장할 수 없습니다." }, 400);
    }
    if (room.players.length >= SF_MAX_PLAYERS) {
      return c.json({ error: "방이 가득 찼습니다." }, 400);
    }

    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    if (!nickname) return c.json({ error: "닉네임을 입력해 주세요." }, 400);
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
      role: null,
      voteTargetId: null,
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

  app.post("/api/spyfall/rooms/:roomId/leave", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ success: true });
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const player = getPlayer(room, playerId);
    if (!player) return c.json({ success: true });

    room.players = room.players.filter((item) => item.id !== playerId);
    if (room.players.length === 0) {
      clearRoomTimers(room);
      spyfallRooms.delete(room.id);
      return c.json({ success: true });
    }

    if (room.hostId === playerId && room.players[0]) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      room.players[0].ready = true;
    }

    updateStatus(room);
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: `${player.nickname} 님이 방을 떠났습니다.`,
    });

    if (room.phase !== "lobby") {
      if (room.players.length < SF_MIN_PLAYERS) {
        resetRoomToLobby(room, "플레이어 수가 부족해 게임이 로비로 초기화되었습니다.");
      } else if (playerId === room.spyPlayerId) {
        resetRoomToLobby(room, "스파이가 방을 떠나 게임이 로비로 초기화되었습니다.");
      }
    }
    return c.json({ success: true });
  });

  app.post("/api/spyfall/rooms/:roomId/ready", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") {
      return c.json({ error: "로비에서만 준비 상태를 바꿀 수 있습니다." }, 400);
    }
    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    player.ready = player.isHost ? true : !player.ready;
    updateStatus(room);
    return c.json({ success: true, ready: player.ready });
  });

  app.post("/api/spyfall/rooms/:roomId/start", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "lobby") return c.json({ error: "이미 게임이 시작되었습니다." }, 400);

    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    if (playerId !== room.hostId) {
      return c.json({ error: "방장만 게임을 시작할 수 있습니다." }, 403);
    }
    if (room.players.length < SF_MIN_PLAYERS) {
      return c.json({ error: "최소 3명이 필요합니다." }, 400);
    }
    if (room.players.some((player) => !player.ready)) {
      return c.json({ error: "모든 플레이어가 준비해야 시작할 수 있습니다." }, 400);
    }

    clearRoomTimers(room);
    const location = SF_LOCATIONS[Math.floor(Math.random() * SF_LOCATIONS.length)];
    const spy = shuffle(room.players)[0];

    room.phase = "playing";
    room.location = location;
    room.candidateLocations = pickCandidateLocations(location);
    room.spyPlayerId = spy.id;
    room.roundEndsAt = now() + SF_ROUND_DURATION_MS;
    room.voteEndsAt = null;
    room.result = null;
    room.chatMessages = [];
    room.players.forEach((player) => {
      player.role = player.id === spy.id ? "spy" : "citizen";
      player.voteTargetId = null;
    });
    updateStatus(room, SF_STATUS_BY_PHASE.playing);
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: "스파이폴이 시작되었습니다. 질문과 답변으로 스파이를 추리해 보세요.",
    });
    schedule(room, () => startFinalVote(room, SF_STATUS_BY_PHASE.final_vote), SF_ROUND_DURATION_MS);
    return c.json({ success: true });
  });

  app.post("/api/spyfall/rooms/:roomId/chat", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (!["lobby", "playing", "final_vote"].includes(room.phase)) {
      return c.json({ error: "현재는 채팅을 보낼 수 없습니다." }, 400);
    }
    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    const text = String(body.text || "").trim();
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (!text) return c.json({ error: "메시지를 입력해 주세요." }, 400);
    pushChatMessage(room, {
      type: "chat",
      playerId: player.id,
      nickname: player.nickname,
      text,
    });
    return c.json({ success: true });
  });

  app.post("/api/spyfall/rooms/:roomId/vote", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "playing" && room.phase !== "final_vote") {
      return c.json({ error: "지금은 투표할 수 없습니다." }, 400);
    }

    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    const target = getPlayer(room, String(body.targetId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (!target) return c.json({ error: "지목한 플레이어를 찾을 수 없습니다." }, 404);

    player.voteTargetId = target.id;
    updateStatus(room, room.phase === "final_vote" ? SF_STATUS_BY_PHASE.final_vote : room.statusText);

    const counts = tallyVotes(room);
    if (room.phase === "playing" && (counts.get(target.id) || 0) >= majorityThreshold(room)) {
      resolveVote(room, target.id, "vote");
      return c.json({ success: true, resolved: true });
    }

    if (room.phase === "final_vote" && room.players.every((item) => item.voteTargetId)) {
      resolveTimeoutFinalVote(room);
      return c.json({ success: true, resolved: true });
    }

    return c.json({ success: true, resolved: false });
  });

  app.post("/api/spyfall/rooms/:roomId/declare-guess", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "playing" && room.phase !== "final_vote") {
      return c.json({ error: "지금은 장소 맞히기를 할 수 없습니다." }, 400);
    }
    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (player.id !== room.spyPlayerId) {
      return c.json({ error: "스파이만 장소를 맞힐 수 있습니다." }, 403);
    }

    clearRoomTimers(room);
    room.phase = "guessing";
    room.roundEndsAt = null;
    room.voteEndsAt = null;
    updateStatus(room, SF_STATUS_BY_PHASE.guessing);
    pushChatMessage(room, {
      type: "system",
      playerId: "system",
      nickname: "시스템",
      text: "스파이가 정체를 밝히고 장소를 선택하려고 합니다.",
    });
    return c.json({ success: true });
  });

  app.post("/api/spyfall/rooms/:roomId/guess", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    if (room.phase !== "guessing") {
      return c.json({ error: "지금은 장소를 선택할 수 없습니다." }, 400);
    }

    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    const guessedLocation = String(body.location || "").trim();
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    if (player.id !== room.spyPlayerId) {
      return c.json({ error: "스파이만 장소를 맞힐 수 있습니다." }, 403);
    }
    if (!guessedLocation) {
      return c.json({ error: "장소를 선택해 주세요." }, 400);
    }
    if (!room.location) {
      return c.json({ error: "현재 장소 정보가 없습니다." }, 400);
    }

    const spyWins = guessedLocation === room.location;
    finishGame(room, {
      winnerTeam: spyWins ? "spy" : "citizen",
      caption: spyWins
        ? `스파이 승리! ${player.nickname} 님이 장소 ${room.location} 을(를) 정확히 맞혔습니다.`
        : `시민 승리! 스파이가 ${guessedLocation} 을(를) 골랐지만 실제 장소는 ${room.location} 이었습니다.`,
      location: room.location,
      spyPlayerId: player.id,
      spyNickname: player.nickname,
      guessedLocation,
      source: "spy_guess",
    });
    return c.json({ success: true });
  });

  app.get("/api/spyfall/rooms/:roomId/state", (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);

    const playerId = String(c.req.query("playerId") || "");
    const sinceVersion = Number(c.req.query("v") || "0");
    const player = getPlayer(room, playerId);
    if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    return c.json(buildState(room, playerId, sinceVersion));
  });
}
