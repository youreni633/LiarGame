import {
  BOARD_SIZE,
  type Board,
  type Position,
  type StoneColor,
  type WinEvidence,
} from "./types.js";
import { getCell, getCellHeight, getTopColor, isInsideBoard } from "./board.js";

const LINE_DIRECTIONS: Position[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
  { row: 1, col: -1 },
];

function add(position: Position, direction: Position, amount: number): Position {
  return {
    row: position.row + direction.row * amount,
    col: position.col + direction.col * amount,
  };
}

function samePosition(left: Position, right: Position): boolean {
  return left.row === right.row && left.col === right.col;
}

export function evaluateExactFive(board: Board, color: StoneColor): Position[][] {
  const lines: Position[][] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const start = { row, col };
      if (getTopColor(getCell(board, start)) !== color) continue;

      for (const direction of LINE_DIRECTIONS) {
        const previous = add(start, direction, -1);
        if (isInsideBoard(previous) && getTopColor(getCell(board, previous)) === color) {
          continue;
        }

        const run: Position[] = [];
        let cursor = start;
        while (isInsideBoard(cursor) && getTopColor(getCell(board, cursor)) === color) {
          run.push(cursor);
          cursor = add(cursor, direction, 1);
        }
        if (run.length === 5) lines.push(run);
      }
    }
  }

  return lines;
}

export function evaluateFiveLevelThreeTops(board: Board, color: StoneColor): Position[] {
  const cells: Position[] = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const position = { row, col };
      const cell = getCell(board, position);
      if (getCellHeight(cell) === 3 && getTopColor(cell) === color) cells.push(position);
    }
  }
  return cells;
}

export function evaluateConnectedLevelThreeTops(board: Board, color: StoneColor): Position[][] {
  const candidates = evaluateFiveLevelThreeTops(board, color);
  const remaining = new Set(candidates.map((position) => `${position.row}:${position.col}`));
  const components: Position[][] = [];

  while (remaining.size > 0) {
    const firstKey = remaining.values().next().value as string;
    remaining.delete(firstKey);
    const [row, col] = firstKey.split(":").map(Number);
    const queue: Position[] = [{ row, col }];
    const component: Position[] = [];

    while (queue.length > 0) {
      const current = queue.shift() as Position;
      component.push(current);
      for (const next of [
        { row: current.row - 1, col: current.col },
        { row: current.row + 1, col: current.col },
        { row: current.row, col: current.col - 1 },
        { row: current.row, col: current.col + 1 },
      ]) {
        const key = `${next.row}:${next.col}`;
        if (remaining.has(key)) {
          remaining.delete(key);
          queue.push(next);
        }
      }
    }
    if (component.length >= 3) components.push(component);
  }

  return components;
}

export function evaluateWinEvidence(board: Board, color: StoneColor): WinEvidence {
  const exactFiveLines = evaluateExactFive(board, color);
  const fiveTopLevelThreeCells = evaluateFiveLevelThreeTops(board, color);
  const connectedTopLevelThreeComponents = evaluateConnectedLevelThreeTops(board, color);
  const reasons = [] as WinEvidence["reasons"];
  if (exactFiveLines.length > 0) reasons.push("EXACT_FIVE");
  if (fiveTopLevelThreeCells.length >= 5) reasons.push("FIVE_TOP_LEVEL_THREES");
  if (connectedTopLevelThreeComponents.length > 0) {
    reasons.push("CONNECTED_LEVEL_THREE_THREES");
  }
  return {
    color,
    reasons,
    exactFiveLines,
    fiveTopLevelThreeCells,
    connectedTopLevelThreeComponents,
  };
}

export function evaluateAllWins(board: Board): WinEvidence[] {
  return [evaluateWinEvidence(board, "BLACK"), evaluateWinEvidence(board, "WHITE")];
}

export function isWinningEvidence(evidence: WinEvidence): boolean {
  return (
    evidence.exactFiveLines.length > 0 ||
    evidence.fiveTopLevelThreeCells.length >= 5 ||
    evidence.connectedTopLevelThreeComponents.length > 0
  );
}

export function hasAnyTopColor(board: Board, color: StoneColor): boolean {
  return board.some((row) => row.some((cell) => getTopColor(cell) === color));
}

export function positionKey(position: Position): string {
  return `${position.row}:${position.col}`;
}

export function containsPosition(positions: Position[], target: Position): boolean {
  return positions.some((position) => samePosition(position, target));
}
