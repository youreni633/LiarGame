import type { CatchMindPhase } from "./types.js";

export const CM_MIN_PLAYERS = 2;
export const CM_MAX_PLAYERS = 10;
export const CM_DEFAULT_MAX_PLAYERS = 6;

export const CM_DEFAULT_ROUNDS = 1;
export const CM_MAX_ROUNDS = 5;

export const CM_DEFAULT_TURN_DURATION_SECONDS = 120;
export const CM_MIN_TURN_DURATION_SECONDS = 30;
export const CM_MAX_TURN_DURATION_SECONDS = 180;

export const CM_DRAWER_POINTS = 10;
export const CM_GUESSER_POINTS = 20;

export const CM_TURN_RESULT_DELAY_MS = 3000;
export const CM_RESULT_DURATION_MS = 10000;
export const CM_STALE_ROOM_MS = 30 * 60 * 1000;

export const CM_CANVAS_BACKGROUND = "#ffffff";

export const CM_STATUS_BY_PHASE: Record<CatchMindPhase, string> = {
  lobby: "참가자를 기다리고 있습니다.",
  turn: "출제자가 그림을 그리고 정답자들이 채팅으로 맞히는 중입니다.",
  turn_result: "이번 턴 결과를 정리하고 있습니다.",
  result: "최종 순위를 집계하고 있습니다.",
};
