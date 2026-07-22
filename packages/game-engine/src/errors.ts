import type { EngineError, EngineErrorCode, GameState } from "./types.js";

export function gameError(
  code: EngineErrorCode,
  message: string,
  latestState?: GameState,
): EngineError {
  return latestState ? { code, message, latestState } : { code, message };
}

