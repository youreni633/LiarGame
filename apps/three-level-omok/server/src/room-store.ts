import { randomInt, randomUUID } from "node:crypto";
import {
  applyCommand,
  createInitialMatchState,
  serializePublicGameState,
  type GameCommand,
  type GameEvent,
  type GameState,
  type PublicGameState,
} from "@three-level-omok/game-engine";
import { persistMatch } from "./repository.js";

export type RoomPlayer = { id: string; nickname: string; isHost: boolean };
export type RoomRecord = { id: string; code: string; hostUserId: string; players: RoomPlayer[]; state: GameState | null };

const rooms = new Map<string, RoomRecord>();

export function listRooms(): RoomRecord[] {
  return [...rooms.values()];
}

function roomCode(): string {
  let code = "";
  do code = randomInt(100000, 999999).toString(); while ([...rooms.values()].some((room) => room.code === code));
  return code;
}

export function createRoom(user: { id: string; nickname: string }): RoomRecord {
  const room: RoomRecord = { id: randomUUID(), code: roomCode(), hostUserId: user.id, players: [{ ...user, isHost: true }], state: null };
  rooms.set(room.code, room);
  return room;
}

export function getRoom(code: string): RoomRecord | null {
  return rooms.get(code) ?? null;
}

export function joinRoom(code: string, user: { id: string; nickname: string }): RoomRecord | null {
  const room = rooms.get(code);
  if (!room) return null;
  if (room.players.some((player) => player.id === user.id)) return room;
  if (room.players.length >= 2 || room.state) return null;
  room.players.push({ ...user, isHost: false });
  room.state = createInitialMatchState({
    matchId: room.id,
    roomId: room.id,
    players: room.players as [RoomPlayer, RoomPlayer],
    blackPlayerId: room.players[0].id,
    whitePlayerId: room.players[1].id,
    createdAt: Date.now(),
  });
  return room;
}

export function roomView(room: RoomRecord): { code: string; players: RoomPlayer[]; state: PublicGameState | null } {
  return { code: room.code, players: room.players, state: room.state ? serializePublicGameState(room.state) : null };
}

export async function executeCommand(room: RoomRecord, command: GameCommand): Promise<{ state: PublicGameState; events: GameEvent[] }> {
  if (!room.state) throw new Error("A second player must join before commands are accepted.");
  const result = applyCommand(room.state, command);
  if (!result.ok) throw result.error;
  room.state = result.state;
  await persistMatch(room.state.matchId, room.state, result.events);
  return { state: serializePublicGameState(room.state), events: result.events };
}

export async function reconcileExpiredRoom(room: RoomRecord, now: number): Promise<boolean> {
  const state = room.state;
  if (!state || !state.turnDeadline || now < state.turnDeadline || !["OPENING", "PLAYING"].includes(state.roundStatus)) return false;
  const color = state.roundStatus === "OPENING" ? state.openingSequence[state.openingIndex] : state.currentTurnColor;
  const playerId = color ? state.playerIdsByColor[color] : null;
  if (!playerId) return false;
  await executeCommand(room, { type: "TIMEOUT", commandId: `timer-${room.id}-${state.revision}-${state.turnDeadline}`, expectedRevision: state.revision, now, playerId });
  return true;
}
