import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  createEmptyBoard,
  createInitialMatchState,
  evaluateConnectedLevelThreeTops,
  evaluateExactFive,
  evaluateFiveLevelThreeTops,
  getCell,
  applyCommand,
  serializePublicGameState,
  type Board,
  type GameState,
  type StoneColor,
} from "../src/index.js";

function state(): GameState {
  return createInitialMatchState({
    matchId: "match-1",
    roomId: "room-1",
    players: [
      { id: "p1", nickname: "A", isHost: true },
      { id: "p2", nickname: "B", isHost: false },
    ],
    blackPlayerId: "p1",
    whitePlayerId: "p2",
    createdAt: 1,
  });
}

function top(board: Board, positions: Array<[number, number]>, color: StoneColor, height = 1): void {
  for (const [row, col] of positions) {
    const cell = getCell(board, { row, col });
    for (let i = 0; i < height; i += 1) cell.push({ color });
  }
}

describe("three-level omok win evaluation", () => {
  it("uses only maximal exact five runs", () => {
    const board = createEmptyBoard();
    top(board, [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], "BLACK");
    expect(evaluateExactFive(board, "BLACK")).toHaveLength(1);

    const six = createEmptyBoard();
    top(six, [[1, 0], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]], "BLACK");
    expect(evaluateExactFive(six, "BLACK")).toHaveLength(0);
  });

  it("counts scattered level-three top stones", () => {
    const board = createEmptyBoard();
    top(board, [[0, 0], [2, 2], [4, 4], [6, 6], [8, 8]], "WHITE", 3);
    expect(evaluateFiveLevelThreeTops(board, "WHITE")).toHaveLength(5);
  });

  it("accepts orthogonal, not diagonal-only, connected level-three groups", () => {
    const board = createEmptyBoard();
    top(board, [[3, 3], [3, 4], [4, 3]], "BLACK", 3);
    expect(evaluateConnectedLevelThreeTops(board, "BLACK")).toHaveLength(1);

    const diagonal = createEmptyBoard();
    top(diagonal, [[6, 6], [7, 7], [8, 8]], "BLACK", 3);
    expect(evaluateConnectedLevelThreeTops(diagonal, "BLACK")).toHaveLength(0);
  });
});

describe("authoritative command processing", () => {
  it("requires both players ready and lets only the host start", () => {
    let current = state();
    let result = applyCommand(current, { type: "READY", commandId: "r1", expectedRevision: 0, now: 10, playerId: "p1", ready: true });
    expect(result.ok).toBe(true);
    current = result.state;
    result = applyCommand(current, { type: "READY", commandId: "r2", expectedRevision: 1, now: 11, playerId: "p2", ready: true });
    expect(result.ok).toBe(true);
    current = result.state;
    result = applyCommand(current, { type: "START_ROUND", commandId: "r3", expectedRevision: 2, now: 12, playerId: "p1", blackPlayerId: "p1", whitePlayerId: "p2" });
    expect(result.ok).toBe(true);
    expect(result.state.roundStatus).toBe("OPENING");
    expect(result.state.turnDeadline).toBe(12 + 30_000);
  });

  it("rejects duplicate and stale commands without mutating state", () => {
    const current = state();
    const command = { type: "READY" as const, commandId: "same", expectedRevision: 0, now: 10, playerId: "p1", ready: true };
    const first = applyCommand(current, command);
    expect(first.ok).toBe(true);
    const duplicate = applyCommand(first.state, command);
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.error.code).toBe("DUPLICATE_COMMAND");
    const stale = applyCommand(first.state, { ...command, commandId: "stale", expectedRevision: 0 });
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.error.code).toBe("STALE_STATE");
      expect(stale.error.latestState?.revision).toBe(1);
    }
  });

  it("never exposes the lower stack colors in the public state", () => {
    const current = state();
    getCell(current.board, { row: 0, col: 0 }).push({ color: "WHITE" }, { color: "BLACK" });
    const publicState = serializePublicGameState(current);
    expect(publicState.board[0][0]).toEqual({ height: 2, topColor: "BLACK" });
    expect("processedCommandIds" in publicState).toBe(false);
    expect(BOARD_SIZE).toBe(10);
  });
});

