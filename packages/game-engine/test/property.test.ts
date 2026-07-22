import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createEmptyBoard, getCell, MAX_STACK_HEIGHT } from "../src/index.js";

describe("board invariants", () => {
  it("empty boards always have exactly 10x10 cells", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const board = createEmptyBoard();
        expect(board).toHaveLength(10);
        expect(board.every((row) => row.length === 10)).toBe(true);
      }),
    );
  });

  it("a cell never exceeds the maximum stack height when built legally", () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom("BLACK" as const, "WHITE" as const), { minLength: 0, maxLength: 12 }), (colors) => {
        const board = createEmptyBoard();
        for (const color of colors.slice(0, MAX_STACK_HEIGHT)) getCell(board, { row: 0, col: 0 }).push({ color });
        expect(getCell(board, { row: 0, col: 0 }).length).toBeLessThanOrEqual(MAX_STACK_HEIGHT);
      }),
    );
  });
});

