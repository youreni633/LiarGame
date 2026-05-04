import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Hono } from "hono";
import { Server } from "socket.io";
import type { Namespace, Socket } from "socket.io";
import {
  CM_CANVAS_BACKGROUND,
  CM_DEFAULT_MAX_PLAYERS,
  CM_DEFAULT_ROUNDS,
  CM_DEFAULT_TURN_DURATION_SECONDS,
  CM_DRAWER_POINTS,
  CM_GUESSER_POINTS,
  CM_MAX_PLAYERS,
  CM_MAX_ROUNDS,
  CM_MAX_TURN_DURATION_SECONDS,
  CM_MIN_PLAYERS,
  CM_MIN_TURN_DURATION_SECONDS,
  CM_RESULT_DURATION_MS,
  CM_STALE_ROOM_MS,
  CM_STATUS_BY_PHASE,
  CM_TURN_RESULT_DELAY_MS,
} from "./constants.js";
import { getCatchMindHTML } from "./html.js";
import type {
  CatchMindChatMessage,
  CatchMindDrawEvent,
  CatchMindPlayer,
  CatchMindResultEntry,
  CatchMindRoom,
  CatchMindStateResponse,
  CatchMindTurnEntry,
} from "./types.js";

const catchMindRooms = new Map<string, CatchMindRoom>();
const socketCountsByPlayerId = new Map<string, number>();

let catchMindNamespace: Namespace | null = null;

const moduleDir = dirname(fileURLToPath(import.meta.url));

function loadWordPool(): string[] {
  const candidates = [
    join(moduleDir, "words.json"),
    join(moduleDir, "../../src/CatchMind/words.json"),
  ];

  for (const candidate of candidates) {
    if (!existsSync(candidate)) {
      continue;
    }

    const parsed = JSON.parse(readFileSync(candidate, "utf8"));
    if (Array.isArray(parsed)) {
      const words = parsed
        .map((value) => String(value || "").trim())
        .filter((value) => value.length >= 2);
      if (words.length > 0) {
        return Array.from(new Set(words));
      }
    }
  }

  return [
    "사과",
    "자동차",
    "기차",
    "고양이",
    "강아지",
    "학교",
    "축구",
    "피자",
    "아이스크림",
    "연필",
  ];
}

const WORD_POOL = loadWordPool();

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function getRoom(roomId: string) {
  return catchMindRooms.get(roomId);
}

function getPlayer(room: CatchMindRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

function playerChannel(playerId: string) {
  return `catchmind:player:${playerId}`;
}

function getCurrentTurnEntry(room: CatchMindRoom) {
  if (room.turnIndex < 0 || room.turnIndex >= room.turnQueue.length) {
    return null;
  }
  return room.turnQueue[room.turnIndex] || null;
}

function getCurrentRound(room: CatchMindRoom) {
  return getCurrentTurnEntry(room)?.round || 0;
}

function getTotalTurns(room: CatchMindRoom) {
  return room.turnQueue.length;
}

function getDrawer(room: CatchMindRoom) {
  if (!room.currentDrawerId) {
    return null;
  }
  return getPlayer(room, room.currentDrawerId) || null;
}

function getVisibleWordMask(word: string) {
  const visibleLength = Array.from(word.replace(/\s+/g, "")).length;
  const masked = Array.from(word)
    .map((char) => (char === " " ? " " : "O"))
    .join("");
  return `${masked} (${visibleLength}글자)`;
}

function getChoseongHint(word: string) {
  const choseong = [
    "ㄱ",
    "ㄲ",
    "ㄴ",
    "ㄷ",
    "ㄸ",
    "ㄹ",
    "ㅁ",
    "ㅂ",
    "ㅃ",
    "ㅅ",
    "ㅆ",
    "ㅇ",
    "ㅈ",
    "ㅉ",
    "ㅊ",
    "ㅋ",
    "ㅌ",
    "ㅍ",
    "ㅎ",
  ];

  return Array.from(word)
    .map((char) => {
      if (char === " ") {
        return " ";
      }

      const code = char.charCodeAt(0);
      if (code >= 0xac00 && code <= 0xd7a3) {
        return choseong[Math.floor((code - 0xac00) / 588)] || char;
      }

      return char.toUpperCase();
    })
    .join("");
}

function shouldRevealHint(room: CatchMindRoom) {
  return (
    room.phase === "turn" &&
    !!room.turnEndsAt &&
    room.turnEndsAt - now() <= 10_000
  );
}

function getDisplayWordForPlayer(room: CatchMindRoom, isDrawer: boolean) {
  if (room.phase !== "turn") {
    return room.currentWord || "";
  }

  if (isDrawer) {
    return room.currentWord;
  }

  if (!shouldRevealHint(room)) {
    return room.currentWordMask;
  }

  return `${room.currentWordMask} · 초성: ${getChoseongHint(room.currentWord)}`;
}

function bumpRoom(room: CatchMindRoom) {
  room.updatedAt = now();
  room.version += 1;
}

function bumpDrawVersion(room: CatchMindRoom) {
  room.drawVersion += 1;
}

function clearRoomTimers(room: CatchMindRoom) {
  room.timers.forEach((timer) => clearTimeout(timer));
  room.timers = [];
}

function resetCanvas(room: CatchMindRoom) {
  room.drawEvents = [];
  bumpDrawVersion(room);
}

function schedule(room: CatchMindRoom, callback: () => void, delay: number) {
  const timer = setTimeout(callback, delay);
  room.timers.push(timer);
  return timer;
}

function pushChatMessage(
  room: CatchMindRoom,
  message: Omit<CatchMindChatMessage, "id" | "createdAt">,
) {
  const entry: CatchMindChatMessage = {
    id: generateId(),
    createdAt: now(),
    ...message,
  };
  room.chatMessages.push(entry);
  room.chatMessages = room.chatMessages.slice(-200);
  bumpRoom(room);
  return entry;
}

function pushSystemMessage(room: CatchMindRoom, text: string) {
  return pushChatMessage(room, {
    type: "system",
    playerId: "system",
    nickname: "시스템",
    text,
  });
}

function buildState(
  room: CatchMindRoom,
  playerId: string,
  sinceVersion = -1,
  includeCanvas = false,
): CatchMindStateResponse {
  if (sinceVersion >= 0 && room.version <= sinceVersion) {
    return { changed: false, version: room.version, drawVersion: room.drawVersion };
  }

  const player = getPlayer(room, playerId);
  const drawer = getDrawer(room);
  const isDrawer = !!player && room.currentDrawerId === player.id;
  const displayWord = getDisplayWordForPlayer(room, isDrawer);

  return {
    changed: true,
    version: room.version,
    drawVersion: room.drawVersion,
    room: {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      phase: room.phase,
      statusText: room.statusText,
      maxPlayers: room.maxPlayers,
      maxRounds: room.maxRounds,
      turnDurationSeconds: room.turnDurationSeconds,
      currentRound: getCurrentRound(room),
      currentTurn: room.turnIndex + 1,
      totalTurns: getTotalTurns(room),
      currentDrawerId: room.currentDrawerId,
      currentDrawerNickname: drawer?.nickname || "",
      displayWord,
      revealedWord:
        room.phase === "turn_result" || room.phase === "result"
          ? room.currentWord
          : undefined,
      turnStartedAt: room.turnStartedAt,
      turnEndsAt: room.turnEndsAt,
    },
    players: room.players.map((entry) => ({
      id: entry.id,
      nickname: entry.nickname,
      isHost: entry.isHost,
      ready: entry.ready,
      connected: entry.connected,
      score: entry.score,
      isDrawer: room.currentDrawerId === entry.id,
    })),
    myState: player
      ? {
          id: player.id,
          nickname: player.nickname,
          isHost: player.isHost,
          canDraw: isDrawer && room.phase === "turn",
          isDrawer,
          score: player.score,
        }
      : null,
    messages: room.chatMessages.slice(-150),
    drawEvents: includeCanvas ? room.drawEvents.slice() : undefined,
    resultEntries: room.resultEntries,
  };
}

function emitRoomState(room: CatchMindRoom, includeCanvas = false) {
  if (!catchMindNamespace) {
    return;
  }

  room.players.forEach((player) => {
    catchMindNamespace!
      .to(playerChannel(player.id))
      .emit("catchmind:state", buildState(room, player.id, -1, includeCanvas));
  });
}

function emitCanvasClear(room: CatchMindRoom) {
  catchMindNamespace?.to(room.id).emit("catchmind:canvas-clear", {
    roomId: room.id,
    background: CM_CANVAS_BACKGROUND,
    drawVersion: room.drawVersion,
  });
}

function emitSocketError(socket: Socket, message: string) {
  socket.emit("catchmind:error", { message });
}

function makeResultEntries(players: CatchMindPlayer[]): CatchMindResultEntry[] {
  const sorted = [...players].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.joinedAt - right.joinedAt;
  });

  let lastScore: number | null = null;
  let lastRank = 0;

  return sorted.map((player, index) => {
    if (player.score !== lastScore) {
      lastRank = index + 1;
      lastScore = player.score;
    }
    return {
      playerId: player.id,
      nickname: player.nickname,
      score: player.score,
      rank: lastRank,
    };
  });
}

function buildTurnQueue(players: CatchMindPlayer[], maxRounds: number) {
  const order = shuffle(players.map((player) => player.id));
  const queue: CatchMindTurnEntry[] = [];

  for (let round = 1; round <= maxRounds; round += 1) {
    order.forEach((playerId) => {
      queue.push({ playerId, round });
    });
  }

  return queue;
}

function chooseNextHost(room: CatchMindRoom, excludePlayerId?: string) {
  const candidates = room.players
    .filter((player) => player.id !== excludePlayerId)
    .sort((left, right) => {
      if (Number(right.connected) !== Number(left.connected)) {
        return Number(right.connected) - Number(left.connected);
      }
      return left.joinedAt - right.joinedAt;
    });

  return candidates[0] || null;
}

function transferHost(room: CatchMindRoom, excludePlayerId?: string) {
  const nextHost = chooseNextHost(room, excludePlayerId);
  if (!nextHost) {
    return null;
  }

  room.hostId = nextHost.id;
  room.players.forEach((player) => {
    player.isHost = player.id === nextHost.id;
  });
  nextHost.ready = true;
  return nextHost;
}

function pruneFutureTurns(room: CatchMindRoom, playerId: string) {
  if (room.turnQueue.length === 0) {
    return;
  }

  room.turnQueue = room.turnQueue.filter(
    (entry, index) => index <= room.turnIndex || entry.playerId !== playerId,
  );
}

function pickWord(room: CatchMindRoom) {
  const recent = room.recentWords.slice(-40);
  const available = WORD_POOL.filter((word) => !recent.includes(word));
  const source = available.length > 0 ? available : WORD_POOL;
  const word = source[Math.floor(Math.random() * source.length)] || "사과";
  room.recentWords.push(word);
  room.recentWords = room.recentWords.slice(-60);
  return word;
}

function resetRoomToLobby(room: CatchMindRoom, notice?: string) {
  clearRoomTimers(room);
  room.phase = "lobby";
  room.turnQueue = [];
  room.turnIndex = -1;
  room.currentDrawerId = null;
  room.currentWord = "";
  room.currentWordMask = "";
  room.turnStartedAt = null;
  room.turnEndsAt = null;
  resetCanvas(room);
  room.chatMessages = [];
  room.resultEntries = [];
  room.recentWords = [];
  room.players.forEach((player) => {
    player.ready = player.isHost;
    player.score = 0;
  });
  room.statusText = notice || CM_STATUS_BY_PHASE.lobby;
  bumpRoom(room);
  if (notice) {
    pushSystemMessage(room, notice);
  }
  emitCanvasClear(room);
  emitRoomState(room);
}

function finishGame(room: CatchMindRoom, notice?: string) {
  clearRoomTimers(room);
  room.phase = "result";
  room.currentDrawerId = null;
  room.turnStartedAt = null;
  room.turnEndsAt = null;
  room.resultEntries = makeResultEntries(room.players);
  room.statusText =
    notice ||
    (room.resultEntries.length > 0
      ? `${room.resultEntries[0].nickname}님이 1위입니다.`
      : "최종 결과를 집계하고 있습니다.");
  bumpRoom(room);
  pushSystemMessage(
    room,
    notice || "모든 출제 순서가 끝났습니다. 최종 순위를 확인해 주세요.",
  );
  emitRoomState(room);

  schedule(room, () => {
    const currentRoom = catchMindRooms.get(room.id);
    if (!currentRoom) {
      return;
    }
    resetRoomToLobby(currentRoom, "캐치마인드 결과를 마치고 로비로 돌아왔습니다.");
  }, CM_RESULT_DURATION_MS);
}

function scheduleNextTurn(room: CatchMindRoom) {
  schedule(room, () => {
    const currentRoom = catchMindRooms.get(room.id);
    if (!currentRoom) {
      return;
    }
    startNextTurn(currentRoom);
  }, CM_TURN_RESULT_DELAY_MS);
}

function closeCurrentTurn(room: CatchMindRoom, statusText: string, message: string) {
  clearRoomTimers(room);
  room.phase = "turn_result";
  room.turnEndsAt = null;
  room.statusText = statusText;
  bumpRoom(room);
  pushSystemMessage(room, message);
  emitRoomState(room);
  scheduleNextTurn(room);
}

function startNextTurn(room: CatchMindRoom) {
  clearRoomTimers(room);

  let nextTurnIndex = room.turnIndex + 1;
  let nextEntry: CatchMindTurnEntry | null = null;

  while (nextTurnIndex < room.turnQueue.length) {
    const candidate = room.turnQueue[nextTurnIndex];
    if (candidate && getPlayer(room, candidate.playerId)) {
      nextEntry = candidate;
      break;
    }
    nextTurnIndex += 1;
  }

  if (!nextEntry) {
    finishGame(room);
    return;
  }

  room.turnIndex = nextTurnIndex;
  room.phase = "turn";
  room.currentDrawerId = nextEntry.playerId;
  room.currentWord = pickWord(room);
  room.currentWordMask = getVisibleWordMask(room.currentWord);
  room.turnStartedAt = now();
  room.turnEndsAt = room.turnStartedAt + room.turnDurationSeconds * 1000;
  resetCanvas(room);

  const drawer = getDrawer(room);
  room.statusText = drawer?.connected
    ? `${drawer.nickname}님이 그림을 그리고 있습니다.`
    : `${drawer?.nickname || "출제자"}님이 오프라인 상태입니다. 제한시간이 끝나면 다음 턴으로 넘어갑니다.`;
  bumpRoom(room);

  const totalTurns = getTotalTurns(room);
  pushSystemMessage(
    room,
    `라운드 ${nextEntry.round}/${room.maxRounds}, ${room.turnIndex + 1}/${totalTurns}턴: ${
      drawer?.nickname || "출제자"
    }님의 차례입니다.`,
  );
  emitCanvasClear(room);
  emitRoomState(room, true);

  const hintDelayMs = Math.max(0, room.turnDurationSeconds * 1000 - 10_000);
  schedule(room, () => {
    const activeRoom = catchMindRooms.get(room.id);
    if (!activeRoom || activeRoom.phase !== "turn") {
      return;
    }

    activeRoom.statusText = `10초 남았습니다! 초성 힌트: ${getChoseongHint(activeRoom.currentWord)}`;
    bumpRoom(activeRoom);
    pushSystemMessage(
      activeRoom,
      `힌트 공개! 초성은 ${getChoseongHint(activeRoom.currentWord)} 입니다.`,
    );
    emitRoomState(activeRoom);
  }, hintDelayMs);

  schedule(room, () => {
    const activeRoom = catchMindRooms.get(room.id);
    if (!activeRoom || activeRoom.phase !== "turn") {
      return;
    }

    closeCurrentTurn(
      activeRoom,
      `시간 종료! 정답은 "${activeRoom.currentWord}"였습니다.`,
      `제한시간이 끝났습니다. 이번 턴의 정답은 "${activeRoom.currentWord}"였습니다.`,
    );
  }, room.turnDurationSeconds * 1000);
}

function startGame(room: CatchMindRoom) {
  clearRoomTimers(room);
  room.players.forEach((player) => {
    player.ready = false;
    player.score = 0;
  });
  room.turnQueue = buildTurnQueue(room.players, room.maxRounds);
  room.turnIndex = -1;
  room.currentDrawerId = null;
  room.currentWord = "";
  room.currentWordMask = "";
  room.turnStartedAt = null;
  room.turnEndsAt = null;
  resetCanvas(room);
  room.chatMessages = [];
  room.resultEntries = [];
  room.recentWords = [];
  room.statusText = CM_STATUS_BY_PHASE.turn;
  bumpRoom(room);
  startNextTurn(room);
}

function appendDrawEvent(room: CatchMindRoom, event: CatchMindDrawEvent) {
  room.drawEvents.push(event);
  if (room.drawEvents.length > 5000) {
    room.drawEvents = room.drawEvents.slice(-5000);
  }
  bumpDrawVersion(room);
  bumpRoom(room);
}

function handleCorrectGuess(room: CatchMindRoom, guesser: CatchMindPlayer) {
  const drawer = getDrawer(room);

  clearRoomTimers(room);
  guesser.score += CM_GUESSER_POINTS;
  if (drawer) {
    drawer.score += CM_DRAWER_POINTS;
  }
  room.phase = "turn_result";
  room.turnEndsAt = null;
  room.statusText = `${guesser.nickname}님이 정답을 맞혔습니다.`;
  bumpRoom(room);
  pushSystemMessage(
    room,
    `🎉 ${guesser.nickname} 님이 정답(${room.currentWord})을 맞혔습니다!`,
  );
  pushSystemMessage(
    room,
    `점수 획득: 출제자 ${drawer?.nickname || "없음"} +${drawer ? CM_DRAWER_POINTS : 0}, 정답자 ${guesser.nickname} +${CM_GUESSER_POINTS}`,
  );
  emitRoomState(room);
  scheduleNextTurn(room);
}

function maybeFinishBecauseTooFewPlayers(room: CatchMindRoom, notice: string) {
  if (room.players.length >= CM_MIN_PLAYERS) {
    return false;
  }
  finishGame(room, notice);
  return true;
}

function removePlayerFromRoom(room: CatchMindRoom, playerId: string) {
  const removedPlayer = getPlayer(room, playerId);
  if (!removedPlayer) {
    return;
  }

  const wasHost = room.hostId === playerId || removedPlayer.isHost;
  const wasCurrentDrawer = room.currentDrawerId === playerId;

  room.players = room.players.filter((player) => player.id !== playerId);
  pruneFutureTurns(room, playerId);

  if (room.players.length === 0) {
    clearRoomTimers(room);
    catchMindRooms.delete(room.id);
    return;
  }

  let nextHost: CatchMindPlayer | null = null;
  if (wasHost || !getPlayer(room, room.hostId)) {
    nextHost = transferHost(room, playerId);
  }

  if (room.phase === "lobby") {
    room.statusText = CM_STATUS_BY_PHASE.lobby;
    bumpRoom(room);
    pushSystemMessage(room, `${removedPlayer.nickname}님이 방을 나갔습니다.`);
    if (nextHost) {
      pushSystemMessage(room, `${nextHost.nickname}님이 방장을 이어받았습니다.`);
    }
    emitRoomState(room);
    return;
  }

  if (maybeFinishBecauseTooFewPlayers(room, `${removedPlayer.nickname}님이 나가 게임을 조기 종료합니다.`)) {
    return;
  }

  if (nextHost) {
    pushSystemMessage(room, `${nextHost.nickname}님이 방장을 이어받았습니다.`);
  }

  if (room.phase === "turn" && wasCurrentDrawer) {
    room.currentDrawerId = null;
    closeCurrentTurn(
      room,
      `${removedPlayer.nickname}님이 나가 이번 턴을 종료합니다.`,
      `${removedPlayer.nickname}님이 나가 정답 "${room.currentWord}"를 공개하고 다음 턴으로 넘어갑니다.`,
    );
    return;
  }

  if (room.phase === "result") {
    room.resultEntries = makeResultEntries(room.players);
  }

  room.statusText = CM_STATUS_BY_PHASE[room.phase];
  bumpRoom(room);
  pushSystemMessage(room, `${removedPlayer.nickname}님이 방을 나갔습니다.`);
  emitRoomState(room);
}

function cleanupRooms() {
  const threshold = now() - CM_STALE_ROOM_MS;
  for (const [roomId, room] of catchMindRooms.entries()) {
    if (room.players.length === 0 || room.updatedAt < threshold) {
      clearRoomTimers(room);
      catchMindRooms.delete(roomId);
    }
  }
}

function updatePlayerConnection(playerId: string, delta: number) {
  const nextCount = Math.max(0, (socketCountsByPlayerId.get(playerId) || 0) + delta);
  if (nextCount === 0) {
    socketCountsByPlayerId.delete(playerId);
  } else {
    socketCountsByPlayerId.set(playerId, nextCount);
  }
  return nextCount;
}

function handleSocketDetached(roomId: string, playerId: string) {
  if (!playerId) {
    return;
  }

  const remaining = updatePlayerConnection(playerId, -1);
  const room = getRoom(roomId);
  const player = room ? getPlayer(room, playerId) : null;
  if (!room || !player || remaining > 0) {
    return;
  }

  let nextHost: CatchMindPlayer | null = null;
  if (player.connected) {
    player.connected = false;
    player.lastSeen = now();

    if (player.isHost && room.players.length > 1) {
      nextHost = transferHost(room, player.id);
    }

    if (room.phase === "turn" && room.currentDrawerId === player.id) {
      room.statusText = `${player.nickname}님의 연결이 끊겼습니다. 남은 시간이 끝나면 다음 턴으로 진행합니다.`;
    }

    bumpRoom(room);

    if (nextHost) {
      pushSystemMessage(room, `${nextHost.nickname}님이 방장을 이어받았습니다.`);
    }
    if (room.phase === "turn" && room.currentDrawerId === player.id) {
      pushSystemMessage(
        room,
        `${player.nickname}님의 연결이 끊겼습니다. 이번 턴은 제한시간이 끝나면 자동으로 넘어갑니다.`,
      );
    }
    emitRoomState(room);
  }
}

function bindSocketSession(
  socket: Socket,
  roomId: string,
  playerId: string,
  emitCurrentState = true,
) {
  const previousPlayerId = String(socket.data.playerId || "");
  const previousRoomId = String(socket.data.roomId || "");
  const sameSession =
    previousPlayerId === playerId &&
    previousRoomId === roomId &&
    socket.data.sessionBound === true;

  if (sameSession) {
    const room = getRoom(roomId);
    if (room && emitCurrentState) {
      socket.emit("catchmind:state", buildState(room, playerId, -1, true));
    }
    return;
  }

  if (previousPlayerId && previousRoomId) {
    socket.leave(playerChannel(previousPlayerId));
    socket.leave(previousRoomId);
    handleSocketDetached(previousRoomId, previousPlayerId);
  }

  socket.data.playerId = playerId;
  socket.data.roomId = roomId;
  socket.data.sessionBound = true;
  socket.join(roomId);
  socket.join(playerChannel(playerId));
  updatePlayerConnection(playerId, 1);

  const room = getRoom(roomId);
  const player = room ? getPlayer(room, playerId) : null;
  if (!room || !player) {
    return;
  }

  const becameConnected = !player.connected;
  player.connected = true;
  player.lastSeen = now();
  if (becameConnected) {
    bumpRoom(room);
  }
  if (emitCurrentState) {
    socket.emit("catchmind:state", buildState(room, playerId, -1, true));
    if (becameConnected) {
      emitRoomState(room);
    }
  }
}

function createRoom(
  roomName: string,
  nickname: string,
  options?: {
    maxPlayers?: number;
    maxRounds?: number;
    turnDurationSeconds?: number;
  },
) {
  const roomId = generateId();
  const playerId = generateId();
  const player: CatchMindPlayer = {
    id: playerId,
    nickname,
    isHost: true,
    ready: true,
    connected: true,
    score: 0,
    joinedAt: now(),
    lastSeen: now(),
  };

  const room: CatchMindRoom = {
    id: roomId,
    name: roomName || `${nickname}의 방`,
    hostId: playerId,
    phase: "lobby",
    createdAt: now(),
    updatedAt: now(),
    version: 1,
    maxPlayers: clamp(
      Number(options?.maxPlayers) || CM_DEFAULT_MAX_PLAYERS,
      CM_MIN_PLAYERS,
      CM_MAX_PLAYERS,
    ),
    maxRounds: clamp(
      Number(options?.maxRounds) || CM_DEFAULT_ROUNDS,
      1,
      CM_MAX_ROUNDS,
    ),
    turnDurationSeconds: clamp(
      Number(options?.turnDurationSeconds) || CM_DEFAULT_TURN_DURATION_SECONDS,
      CM_MIN_TURN_DURATION_SECONDS,
      CM_MAX_TURN_DURATION_SECONDS,
    ),
    players: [player],
    turnQueue: [],
    turnIndex: -1,
    currentDrawerId: null,
    currentWord: "",
    currentWordMask: "",
    turnStartedAt: null,
    turnEndsAt: null,
    drawEvents: [],
    drawVersion: 0,
    chatMessages: [],
    statusText: CM_STATUS_BY_PHASE.lobby,
    resultEntries: [],
    recentWords: [],
    timers: [],
  };

  catchMindRooms.set(roomId, room);
  return { room, roomId, playerId };
}

export function registerCatchMindSocket(io: Server) {
  if (catchMindNamespace) {
    return catchMindNamespace;
  }

  catchMindNamespace = io.of("/catchmind");

  catchMindNamespace.on("connection", (socket) => {
    socket.on("catchmind:session", (payload) => {
      const roomId = String(payload?.roomId || "");
      const playerId = String(payload?.playerId || "");
      const room = getRoom(roomId);
      const player = room ? getPlayer(room, playerId) : null;

      if (!room || !player) {
        emitSocketError(socket, "세션을 확인할 수 없습니다. 다시 입장해 주세요.");
        return;
      }

      bindSocketSession(socket, roomId, playerId);
    });

    socket.on("catchmind:draw-line", (payload) => {
      const roomId = String(socket.data.roomId || payload?.roomId || "");
      const playerId = String(socket.data.playerId || payload?.playerId || "");
      const room = getRoom(roomId);
      const player = room ? getPlayer(room, playerId) : null;
      if (!room || !player) {
        emitSocketError(socket, "그리기 권한을 확인할 수 없습니다.");
        return;
      }

      if (room.phase !== "turn" || room.currentDrawerId !== playerId) {
        emitSocketError(socket, "현재는 그림을 그릴 수 있는 차례가 아닙니다.");
        return;
      }

      const x0 = Number(payload?.x0);
      const y0 = Number(payload?.y0);
      const x1 = Number(payload?.x1);
      const y1 = Number(payload?.y1);
      const size = clamp(Number(payload?.size) || 4, 1, 32);
      const color = String(payload?.color || "#111827");
      const tool = payload?.tool === "eraser" ? "eraser" : "pen";

      const coordinates = [x0, y0, x1, y1];
      if (coordinates.some((value) => Number.isNaN(value) || value < 0 || value > 1)) {
        return;
      }

      player.lastSeen = now();

      const event: CatchMindDrawEvent = {
        id: generateId(),
        type: "line",
        x0,
        y0,
        x1,
        y1,
        size,
        color,
        tool,
        createdAt: now(),
      };
      appendDrawEvent(room, event);
      socket.to(room.id).emit("catchmind:draw-line", event);
    });

    socket.on("catchmind:clear-canvas", () => {
      const roomId = String(socket.data.roomId || "");
      const playerId = String(socket.data.playerId || "");
      const room = getRoom(roomId);
      if (!room || room.phase !== "turn" || room.currentDrawerId !== playerId) {
        emitSocketError(socket, "현재는 캔버스를 초기화할 수 없습니다.");
        return;
      }

      resetCanvas(room);
      bumpRoom(room);
      emitCanvasClear(room);
    });

    socket.on("catchmind:chat", (payload) => {
      const roomId = String(socket.data.roomId || payload?.roomId || "");
      const playerId = String(socket.data.playerId || payload?.playerId || "");
      const room = getRoom(roomId);
      const player = room ? getPlayer(room, playerId) : null;
      const text = String(payload?.text || "").trim();
      if (!room || !player) {
        emitSocketError(socket, "채팅을 전송할 수 없습니다.");
        return;
      }
      if (!text) {
        return;
      }

      player.lastSeen = now();

      if (room.phase === "turn" && room.currentDrawerId !== playerId && text === room.currentWord) {
        handleCorrectGuess(room, player);
        return;
      }

      pushChatMessage(room, {
        type: "chat",
        playerId: player.id,
        nickname: player.nickname,
        text,
      });
      emitRoomState(room);
    });

    socket.on("disconnect", () => {
      const roomId = String(socket.data.roomId || "");
      const playerId = String(socket.data.playerId || "");
      handleSocketDetached(roomId, playerId);
    });
  });

  return catchMindNamespace;
}

export function registerCatchMindRoutes(app: Hono) {
  app.get("/api/catchmind/rooms", (c) => {
    cleanupRooms();
    return c.json({
      rooms: Array.from(catchMindRooms.values()).map((room) => ({
        id: room.id,
        name: room.name,
        phase: room.phase,
        playerCount: room.players.length,
        maxPlayers: room.maxPlayers,
        maxRounds: room.maxRounds,
        turnDurationSeconds: room.turnDurationSeconds,
      })),
    });
  });

  app.post("/api/catchmind/rooms", async (c) => {
    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    const roomName = String(body.roomName || "").trim();
    if (!nickname) {
      return c.json({ error: "닉네임을 입력해 주세요." }, 400);
    }

    const { roomId, playerId } = createRoom(roomName, nickname, {
      maxPlayers: Number(body.maxPlayers),
      maxRounds: Number(body.maxRounds),
      turnDurationSeconds: Number(body.turnDurationSeconds),
    });

    return c.json({ roomId, playerId });
  });

  app.post("/api/catchmind/rooms/:roomId/join", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) {
      return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    }
    if (room.phase !== "lobby") {
      return c.json({ error: "진행 중인 방에는 입장할 수 없습니다." }, 400);
    }
    if (room.players.length >= room.maxPlayers) {
      return c.json({ error: "방이 가득 찼습니다." }, 400);
    }

    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    if (!nickname) {
      return c.json({ error: "닉네임을 입력해 주세요." }, 400);
    }
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
      score: 0,
      joinedAt: now(),
      lastSeen: now(),
    });
    room.statusText = CM_STATUS_BY_PHASE.lobby;
    bumpRoom(room);
    pushSystemMessage(room, `${nickname}님이 방에 참가했습니다.`);
    emitRoomState(room);

    return c.json({ roomId: room.id, playerId });
  });

  app.post("/api/catchmind/rooms/:roomId/leave", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) {
      return c.json({ success: true });
    }

    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    removePlayerFromRoom(room, playerId);
    return c.json({ success: true });
  });

  app.post("/api/catchmind/rooms/:roomId/ready", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) {
      return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    }
    if (room.phase !== "lobby") {
      return c.json({ error: "로비에서만 준비 상태를 변경할 수 있습니다." }, 400);
    }

    const body = await c.req.json();
    const player = getPlayer(room, String(body.playerId || ""));
    if (!player) {
      return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    }

    player.ready = player.isHost ? true : !player.ready;
    room.statusText = CM_STATUS_BY_PHASE.lobby;
    bumpRoom(room);
    emitRoomState(room);

    return c.json({ success: true, ready: player.ready });
  });

  app.post("/api/catchmind/rooms/:roomId/settings", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) {
      return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    }
    if (room.phase !== "lobby") {
      return c.json({ error: "게임 시작 전 로비에서만 설정을 변경할 수 있습니다." }, 400);
    }

    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    if (playerId !== room.hostId) {
      return c.json({ error: "방장만 설정을 변경할 수 있습니다." }, 403);
    }

    room.maxPlayers = clamp(
      Number(body.maxPlayers) || room.maxPlayers,
      Math.max(CM_MIN_PLAYERS, room.players.length),
      CM_MAX_PLAYERS,
    );
    room.maxRounds = clamp(Number(body.maxRounds) || room.maxRounds, 1, CM_MAX_ROUNDS);
    room.turnDurationSeconds = clamp(
      Number(body.turnDurationSeconds) || room.turnDurationSeconds,
      CM_MIN_TURN_DURATION_SECONDS,
      CM_MAX_TURN_DURATION_SECONDS,
    );
    room.statusText = `라운드 ${room.maxRounds}, 턴 ${room.turnDurationSeconds}초 설정이 적용되었습니다.`;
    bumpRoom(room);
    emitRoomState(room);

    return c.json({ success: true });
  });

  app.post("/api/catchmind/rooms/:roomId/start", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) {
      return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    }
    if (room.phase !== "lobby") {
      return c.json({ error: "이미 진행 중인 게임입니다." }, 400);
    }

    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    if (playerId !== room.hostId) {
      return c.json({ error: "방장만 게임을 시작할 수 있습니다." }, 403);
    }
    if (room.players.length < CM_MIN_PLAYERS) {
      return c.json({ error: "최소 2명이 필요합니다." }, 400);
    }
    if (room.players.some((player) => !player.ready)) {
      return c.json({ error: "모든 플레이어가 준비를 완료해야 합니다." }, 400);
    }

    startGame(room);
    return c.json({ success: true });
  });

  app.get("/api/catchmind/rooms/:roomId/state", (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) {
      return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    }

    const playerId = String(c.req.query("playerId") || "");
    const player = getPlayer(room, playerId);
    if (!player) {
      return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    }

    const becameConnected = !player.connected;
    player.lastSeen = now();
    player.connected = true;
    if (becameConnected) {
      bumpRoom(room);
      emitRoomState(room);
    }

    const sinceVersion = Number(c.req.query("v") || "-1");
    const includeCanvas = c.req.query("canvas") === "1";
    return c.json(buildState(room, playerId, sinceVersion, includeCanvas));
  });

  app.get("/catchmind", (c) => c.html(getCatchMindHTML()));
}
