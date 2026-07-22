import {
  BOARD_SIZE,
  MAX_STACK_HEIGHT,
  type Board,
  type Cell,
  type Position,
  type Stone,
  type StoneColor,
} from "./types.js";

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => [] as Cell),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => cell.map((stone) => ({ ...stone }))));
}

export function isInsideBoard(position: Position): boolean {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < BOARD_SIZE &&
    position.col >= 0 &&
    position.col < BOARD_SIZE
  );
}

export function getCell(board: Board, position: Position): Cell {
  return board[position.row][position.col];
}

export function getCellHeight(cell: Cell): number {
  return cell.length;
}

export function getTopStone(cell: Cell): Stone | null {
  return cell.length > 0 ? cell[cell.length - 1] : null;
}

export function getTopColor(cell: Cell): StoneColor | null {
  return getTopStone(cell)?.color ?? null;
}

export function canStack(cell: Cell): boolean {
  return cell.length < MAX_STACK_HEIGHT;
}

export function areAdjacent(from: Position, to: Position): boolean {
  const rowDistance = Math.abs(from.row - to.row);
  const colDistance = Math.abs(from.col - to.col);
  return rowDistance <= 1 && colDistance <= 1 && (rowDistance > 0 || colDistance > 0);
}

export function getAdjacentPositions(position: Position): Position[] {
  const positions: Position[] = [];
  for (let row = position.row - 1; row <= position.row + 1; row += 1) {
    for (let col = position.col - 1; col <= position.col + 1; col += 1) {
      const next = { row, col };
      if (isInsideBoard(next) && (row !== position.row || col !== position.col)) {
        positions.push(next);
      }
    }
  }
  return positions;
}

export function centralOpeningCells(): Position[] {
  return [
    { row: 4, col: 4 },
    { row: 4, col: 5 },
    { row: 5, col: 4 },
    { row: 5, col: 5 },
  ];
}

export function isCentralOpeningCell(position: Position): boolean {
  return centralOpeningCells().some(
    (cell) => cell.row === position.row && cell.col === position.col,
  );
}

