import {
  areAdjacent,
  canStack,
  cloneBoard,
  createEmptyBoard,
  getAdjacentPositions,
  getCell,
  getCellHeight,
  getTopColor,
  isCentralOpeningCell,
  isInsideBoard,
} from "./board.js";
import { gameError } from "./errors.js";
import { evaluateWinEvidence, isWinningEvidence } from "./wins.js";
import {
  BOARD_SIZE,
  INITIAL_STONES_PER_PLAYER,
  MATCH_ROUNDS_MAX,
  MATCH_WINS_REQUIRED,
  MAX_STACK_HEIGHT,
  TURN_SECONDS,
  type BoardAction,
  type EngineResult,
  type GameCommand,
  type GameEvent,
  type GameState,
  type Position,
  type PublicGameState,
  type RoundOutcome,
  type StoneColor,
  type WinEvidence,
  type WinReason,
} from "./types.js";

const OPENING_SEQUENCE: StoneColor[] = ["BLACK", "WHITE", "WHITE", "BLACK", "BLACK", "WHITE"];

function opponent(color: StoneColor): StoneColor {
  return color === "BLACK" ? "WHITE" : "BLACK";
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    board: cloneBoard(state.board),
    players: state.players.map((player) => ({ ...player })),
    playerIdsByColor: { ...state.playerIdsByColor },
    remainingStonesByColor: { ...state.remainingStonesByColor },
    roundScoreByPlayer: { ...state.roundScoreByPlayer },
    readyByPlayer: { ...state.readyByPlayer },
    openingSequence: [...state.openingSequence],
    openingPositionsByColor: {
      BLACK: state.openingPositionsByColor.BLACK.map((position) => ({ ...position })),
      WHITE: state.openingPositionsByColor.WHITE.map((position) => ({ ...position })),
    },
    processedCommandIds: [...state.processedCommandIds],
    lastAction: state.lastAction ? { ...state.lastAction } as GameState["lastAction"] : null,
    roundOutcome: state.roundOutcome
      ? {
          ...state.roundOutcome,
          reasons: [...state.roundOutcome.reasons],
          evidence: state.roundOutcome.evidence.map((evidence) => ({
            ...evidence,
            reasons: [...evidence.reasons],
            exactFiveLines: evidence.exactFiveLines.map((line) => line.map((position) => ({ ...position }))),
            fiveTopLevelThreeCells: evidence.fiveTopLevelThreeCells.map((position) => ({ ...position })),
            connectedTopLevelThreeComponents: evidence.connectedTopLevelThreeComponents.map((component) => component.map((position) => ({ ...position }))),
          })),
        }
      : null,
  };
}

function colorForPlayer(state: GameState, playerId: string): StoneColor | null {
  if (state.playerIdsByColor.BLACK === playerId) return "BLACK";
  if (state.playerIdsByColor.WHITE === playerId) return "WHITE";
  return null;
}

function isPlayer(state: GameState, playerId: string): boolean {
  return state.players.some((player) => player.id === playerId);
}

function isReady(state: GameState): boolean {
  return state.players.every((player) => state.readyByPlayer[player.id] === true);
}

function event(state: GameState, type: string, at: number, playerId: string | null, payload: Record<string, unknown>): GameEvent {
  return { type, revision: state.revision, at, playerId, payload };
}

function startOpening(state: GameState, now: number): void {
  state.matchStatus = "ACTIVE";
  state.roundStatus = "OPENING";
  state.openingIndex = 0;
  state.openingSequence = [...OPENING_SEQUENCE];
  state.board = createEmptyBoard();
  state.remainingStonesByColor = { BLACK: INITIAL_STONES_PER_PLAYER, WHITE: INITIAL_STONES_PER_PLAYER };
  state.openingPositionsByColor = { BLACK: [], WHITE: [] };
  state.currentTurnColor = "BLACK";
  state.turnStartedAt = now;
  state.turnDeadline = now + TURN_SECONDS * 1000;
  state.consecutiveForcedPasses = 0;
  state.roundWinner = null;
  state.resultReason = null;
  state.roundOutcome = null;
  state.lastBoardActionPlayerId = null;
  state.lastBoardActionColor = null;
  state.lastAction = null;
}

function resetRound(state: GameState, now: number): void {
  state.roundStatus = "OPENING";
  state.openingIndex = 0;
  state.board = createEmptyBoard();
  state.remainingStonesByColor = { BLACK: INITIAL_STONES_PER_PLAYER, WHITE: INITIAL_STONES_PER_PLAYER };
  state.openingPositionsByColor = { BLACK: [], WHITE: [] };
  state.currentTurnColor = "BLACK";
  state.turnStartedAt = now;
  state.turnDeadline = now + TURN_SECONDS * 1000;
  state.consecutiveForcedPasses = 0;
  state.roundWinner = null;
  state.resultReason = null;
  state.roundOutcome = null;
  state.lastBoardActionPlayerId = null;
  state.lastBoardActionColor = null;
  state.lastAction = null;
  state.readyByPlayer = Object.fromEntries(state.players.map((player) => [player.id, false]));
}

function finishRound(state: GameState, outcome: RoundOutcome, now: number): void {
  state.roundOutcome = outcome;
  state.roundWinner = outcome.winnerPlayerId;
  state.resultReason = outcome.resultReason;
  state.roundStatus = "ROUND_RESULT";
  state.turnStartedAt = null;
  state.turnDeadline = null;
  if (outcome.winnerPlayerId) {
    state.roundScoreByPlayer[outcome.winnerPlayerId] += 1;
    if (state.roundScoreByPlayer[outcome.winnerPlayerId] >= MATCH_WINS_REQUIRED || state.roundNumber >= MATCH_ROUNDS_MAX) {
      state.matchStatus = "FINISHED";
      state.roundStatus = "MATCH_RESULT";
      state.matchWinner = outcome.winnerPlayerId;
      state.resultReason = outcome.resultReason;
    } else {
      state.nextRoundColorSelectorId = outcome.winnerPlayerId === state.players[0].id ? state.players[1].id : state.players[0].id;
      state.nextRoundBlackPlayerId = null;
      state.readyByPlayer = Object.fromEntries(state.players.map((player) => [player.id, false]));
    }
  } else {
    state.nextRoundColorSelectorId = null;
    state.nextRoundBlackPlayerId = state.playerIdsByColor.BLACK;
    state.readyByPlayer = Object.fromEntries(state.players.map((player) => [player.id, false]));
  }
  state.updatedAt = now;
}

function collectEvidence(state: GameState): WinEvidence[] {
  return [evaluateWinEvidence(state.board, "BLACK"), evaluateWinEvidence(state.board, "WHITE")].filter(isWinningEvidence);
}

function winnerForBoard(state: GameState, actorPlayerId: string): { winnerPlayerId: string | null; reasons: WinReason[]; evidence: WinEvidence[] } {
  const evidence = collectEvidence(state);
  if (evidence.length === 0) return { winnerPlayerId: null, reasons: [], evidence };
  if (evidence.length === 1) {
    const winnerColor = evidence[0].color;
    return { winnerPlayerId: state.playerIdsByColor[winnerColor], reasons: evidence[0].reasons, evidence };
  }
  const actorColor = colorForPlayer(state, actorPlayerId);
  const actorEvidence = actorColor ? evidence.find((item) => item.color === actorColor) : undefined;
  if (actorEvidence) {
    const reasons = Array.from(new Set(actorEvidence.reasons.concat("SIMULTANEOUS_ACTOR_PRIORITY")));
    return { winnerPlayerId: actorPlayerId, reasons, evidence };
  }
  return { winnerPlayerId: state.playerIdsByColor[evidence[0].color], reasons: evidence[0].reasons, evidence };
}

function outcome(state: GameState, actorPlayerId: string, resultReason: string): RoundOutcome {
  const winner = winnerForBoard(state, actorPlayerId);
  return {
    winnerPlayerId: winner.winnerPlayerId,
    winnerColor: winner.winnerPlayerId ? colorForPlayer(state, winner.winnerPlayerId) : null,
    draw: !winner.winnerPlayerId,
    reasons: winner.reasons,
    evidence: winner.evidence,
    resultReason,
  };
}

function commit(state: GameState, command: GameCommand, eventType: string, payload: Record<string, unknown>): GameEvent {
  state.revision += 1;
  state.updatedAt = command.now;
  state.processedCommandIds.push(command.commandId);
  return event(state, eventType, command.now, "playerId" in command ? command.playerId : null, payload);
}

function fail(state: GameState, code: Parameters<typeof gameError>[0], message: string): EngineResult {
  return { ok: false, state, events: [], error: gameError(code, message, code === "STALE_STATE" ? state : undefined) };
}

function validateCommand(state: GameState, command: GameCommand): EngineResult | null {
  if (!command.commandId || !Number.isInteger(command.expectedRevision) || !Number.isFinite(command.now)) {
    return fail(state, "INVALID_COMMAND", "commandId, expectedRevision, now are required.");
  }
  if (state.processedCommandIds.includes(command.commandId)) {
    return fail(state, "DUPLICATE_COMMAND", "The commandId has already been processed.");
  }
  if (state.revision !== command.expectedRevision) {
    return fail(state, "STALE_STATE", "The expected revision does not match the current state.");
  }
  if ("playerId" in command && !isPlayer(state, command.playerId)) {
    return fail(state, "PLAYER_NOT_FOUND", "The player is not part of this match.");
  }
  return null;
}

function nextTurn(state: GameState, now: number): void {
  state.currentTurnColor = opponent(state.currentTurnColor);
  state.turnStartedAt = now;
  state.turnDeadline = now + TURN_SECONDS * 1000;
  state.consecutiveForcedPasses = 0;
}

function legalPlace(state: GameState, position: Position, color: StoneColor): boolean {
  return isInsideBoard(position) && getCell(state.board, position).length === 0 && state.remainingStonesByColor[color] > 0;
}

function legalMove(state: GameState, from: Position, to: Position, color: StoneColor): boolean {
  if (!isInsideBoard(from) || !isInsideBoard(to) || !areAdjacent(from, to)) return false;
  const source = getCell(state.board, from);
  const destination = getCell(state.board, to);
  return (
    source.length > 0 &&
    getTopColor(source) === color &&
    canStack(destination) &&
    destination.length <= source.length
  );
}

export function createInitialMatchState(input: {
  matchId: string;
  roomId: string;
  players: [{ id: string; nickname: string; isHost: boolean }, { id: string; nickname: string; isHost: boolean }];
  blackPlayerId: string;
  whitePlayerId: string;
  createdAt: number;
}): GameState {
  if (input.blackPlayerId === input.whitePlayerId) throw new Error("Players must be different.");
  if (!input.players.some((player) => player.id === input.blackPlayerId) || !input.players.some((player) => player.id === input.whitePlayerId)) {
    throw new Error("Both color players must be in the match.");
  }
  return {
    matchId: input.matchId,
    roomId: input.roomId,
    revision: 0,
    matchStatus: "WAITING",
    roundNumber: 1,
    roundStatus: "WAITING_READY",
    openingIndex: 0,
    openingSequence: [...OPENING_SEQUENCE],
    board: createEmptyBoard(),
    players: input.players.map((player) => ({ ...player, connected: true, ready: false })),
    playerIdsByColor: { BLACK: input.blackPlayerId, WHITE: input.whitePlayerId },
    currentTurnColor: "BLACK",
    remainingStonesByColor: { BLACK: INITIAL_STONES_PER_PLAYER, WHITE: INITIAL_STONES_PER_PLAYER },
    roundScoreByPlayer: Object.fromEntries(input.players.map((player) => [player.id, 0])),
    readyByPlayer: Object.fromEntries(input.players.map((player) => [player.id, false])),
    lastBoardActionPlayerId: null,
    lastBoardActionColor: null,
    lastAction: null,
    turnStartedAt: null,
    turnDeadline: null,
    consecutiveForcedPasses: 0,
    roundWinner: null,
    matchWinner: null,
    resultReason: null,
    roundOutcome: null,
    nextRoundColorSelectorId: null,
    nextRoundBlackPlayerId: null,
    openingPositionsByColor: { BLACK: [], WHITE: [] },
    processedCommandIds: [],
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
  };
}

function applyReady(state: GameState, command: Extract<GameCommand, { type: "READY" }>): EngineResult {
  if (state.roundStatus !== "WAITING_READY") return fail(state, "INVALID_PHASE", "Ready is only available before a round starts.");
  const next = cloneState(state);
  next.readyByPlayer[command.playerId] = command.ready;
  const eventItem = commit(next, command, "PLAYER_READY", { ready: command.ready });
  return { ok: true, state: next, events: [eventItem] };
}

function applyStartRound(state: GameState, command: Extract<GameCommand, { type: "START_ROUND" }>): EngineResult {
  if (state.roundStatus !== "WAITING_READY") return fail(state, "INVALID_PHASE", "A round is already in progress.");
  if (state.players.length !== 2 || !isReady(state)) return fail(state, "INVALID_COMMAND", "Exactly two ready players are required.");
  if (!state.players.some((player) => player.id === command.playerId && player.isHost)) return fail(state, "PLAYER_ONLY", "Only the host can start the round.");
  if (command.blackPlayerId === command.whitePlayerId) return fail(state, "INVALID_COMMAND", "Black and white players must be different.");
  if (!state.players.some((player) => player.id === command.blackPlayerId) || !state.players.some((player) => player.id === command.whitePlayerId)) {
    return fail(state, "PLAYER_NOT_FOUND", "Both color players must belong to the match.");
  }
  const next = cloneState(state);
  next.playerIdsByColor = { BLACK: command.blackPlayerId, WHITE: command.whitePlayerId };
  startOpening(next, command.now);
  const eventItem = commit(next, command, "ROUND_STARTED", { roundNumber: next.roundNumber });
  return { ok: true, state: next, events: [eventItem] };
}

function validateOpening(state: GameState, playerId: string, position: Position): string | null {
  const color = state.openingSequence[state.openingIndex];
  if (!color) return "Opening is already complete.";
  if (state.playerIdsByColor[color] !== playerId) return "This player is not assigned to the opening color.";
  if (!isInsideBoard(position)) return "The position is outside the board.";
  if (isCentralOpeningCell(position)) return "The central four cells are forbidden during opening.";
  if (getCell(state.board, position).length !== 0) return "Opening placement requires an empty cell.";
  if (state.openingPositionsByColor[color].some((existing) => areAdjacent(existing, position))) return "A player's opening stones cannot be adjacent.";
  return null;
}

function finishOpeningIfNeeded(state: GameState, now: number): void {
  if (state.openingIndex < state.openingSequence.length) return;
  state.roundStatus = "PLAYING";
  state.currentTurnColor = "BLACK";
  state.turnStartedAt = now;
  state.turnDeadline = now + TURN_SECONDS * 1000;
}

function applyOpeningPlace(state: GameState, command: Extract<GameCommand, { type: "OPENING_PLACE" }>): EngineResult {
  if (state.roundStatus !== "OPENING") return fail(state, "INVALID_PHASE", "Opening placement is not active.");
  const error = validateOpening(state, command.playerId, command.position);
  if (error) return fail(state, error.includes("central") ? "OPENING_CENTER_FORBIDDEN" : error.includes("adjacent") ? "OPENING_OWN_ADJACENCY_FORBIDDEN" : "INVALID_COMMAND", error);
  const next = cloneState(state);
  const color = next.openingSequence[next.openingIndex];
  const cell = getCell(next.board, command.position);
  cell.push({ color });
  next.remainingStonesByColor[color] -= 1;
  next.openingPositionsByColor[color].push({ ...command.position });
  next.openingIndex += 1;
  next.lastBoardActionPlayerId = command.playerId;
  next.lastBoardActionColor = color;
  next.lastAction = { type: "OPENING_PLACE", playerId: command.playerId, color, position: { ...command.position } };
  finishOpeningIfNeeded(next, command.now);
  const eventItem = commit(next, command, "OPENING_PLACED", { position: command.position, color });
  return { ok: true, state: next, events: [eventItem] };
}

function applyBoardAction(state: GameState, command: Extract<GameCommand, { type: "PLACE" | "MOVE" }>): EngineResult {
  if (state.roundStatus !== "PLAYING") return fail(state, "INVALID_PHASE", "Normal board actions are not active.");
  const color = colorForPlayer(state, command.playerId);
  if (!color || color !== state.currentTurnColor) return fail(state, "NOT_YOUR_TURN", "It is not this player's turn.");
  const next = cloneState(state);
  let action: BoardAction;

  if (command.type === "PLACE") {
    if (!isInsideBoard(command.position)) return fail(state, "OUT_OF_BOUNDS", "The position is outside the board.");
    if (getCell(next.board, command.position).length !== 0) return fail(state, "CELL_NOT_EMPTY", "A new stone requires an empty cell.");
    if (next.remainingStonesByColor[color] <= 0) return fail(state, "NO_STONES_LEFT", "No stones remain for this player.");
    getCell(next.board, command.position).push({ color });
    next.remainingStonesByColor[color] -= 1;
    action = { type: "PLACE", playerId: command.playerId, color, position: { ...command.position } };
  } else {
    if (!isInsideBoard(command.from) || !isInsideBoard(command.to)) return fail(state, "OUT_OF_BOUNDS", "The position is outside the board.");
    const source = getCell(next.board, command.from);
    const destination = getCell(next.board, command.to);
    if (source.length === 0) return fail(state, "SOURCE_EMPTY", "The source cell is empty.");
    if (getTopColor(source) !== color) return fail(state, "SOURCE_TOP_NOT_OWNED", "Only the player's top stone can move.");
    if (!areAdjacent(command.from, command.to)) return fail(state, "DESTINATION_NOT_ADJACENT", "The destination must be adjacent.");
    if (!canStack(destination)) return fail(state, "DESTINATION_TOO_HIGH", "The destination stack cannot exceed height three.");
    if (destination.length > source.length) return fail(state, "DESTINATION_TOO_HIGH", "The destination was higher than the source.");
    const moved = source.pop() as { color: StoneColor };
    destination.push(moved);
    action = { type: "MOVE", playerId: command.playerId, color, from: { ...command.from }, to: { ...command.to } };
  }

  next.lastBoardActionPlayerId = command.playerId;
  next.lastBoardActionColor = color;
  next.lastAction = action;
  const winner = winnerForBoard(next, command.playerId);
  const events: GameEvent[] = [];
  if (winner.winnerPlayerId) {
    finishRound(next, {
      winnerPlayerId: winner.winnerPlayerId,
      winnerColor: colorForPlayer(next, winner.winnerPlayerId),
      draw: false,
      reasons: winner.reasons,
      evidence: winner.evidence,
      resultReason: winner.reasons.join(","),
    }, command.now);
    events.push(commit(next, command, "ROUND_WON", { reasons: winner.reasons }));
    return { ok: true, state: next, events };
  }

  nextTurn(next, command.now);
  next.consecutiveForcedPasses = 0;
  events.push(commit(next, command, command.type === "PLACE" ? "STONE_PLACED" : "STONE_MOVED", { action }));
  return { ok: true, state: next, events };
}

function applyTimeout(state: GameState, command: Extract<GameCommand, { type: "TIMEOUT" }>): EngineResult {
  if (state.roundStatus !== "OPENING" && state.roundStatus !== "PLAYING") return fail(state, "INVALID_PHASE", "There is no active timer.");
  if (state.turnDeadline === null || command.now < state.turnDeadline) return fail(state, "TIME_NOT_EXPIRED", "The server deadline has not passed.");
  const expectedPlayer = state.playerIdsByColor[state.roundStatus === "OPENING" ? state.openingSequence[state.openingIndex] : state.currentTurnColor];
  if (expectedPlayer !== command.playerId) return fail(state, "NOT_YOUR_TURN", "Only the timed-out player can advance the timer.");
  const next = cloneState(state);
  const winner = winnerForBoard(next, command.playerId);
  if (winner.winnerPlayerId) {
    finishRound(next, {
      winnerPlayerId: winner.winnerPlayerId,
      winnerColor: colorForPlayer(next, winner.winnerPlayerId),
      draw: false,
      reasons: winner.reasons,
      evidence: winner.evidence,
      resultReason: winner.reasons.join(","),
    }, command.now);
    return { ok: true, state: next, events: [commit(next, command, "ROUND_WON_AFTER_TIMEOUT", {})] };
  }
  if (next.roundStatus === "OPENING") {
    next.openingIndex += 1;
    finishOpeningIfNeeded(next, command.now);
  } else {
    nextTurn(next, command.now);
  }
  return { ok: true, state: next, events: [commit(next, command, "TIMEOUT", {})] };
}

export function listLegalPlaceActions(state: GameState, color: StoneColor): Position[] {
  const actions: Position[] = [];
  if (state.remainingStonesByColor[color] <= 0) return actions;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (legalPlace(state, { row, col }, color)) actions.push({ row, col });
    }
  }
  return actions;
}

export function listLegalMoveActions(state: GameState, color: StoneColor): Array<{ from: Position; to: Position }> {
  const actions: Array<{ from: Position; to: Position }> = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const from = { row, col };
      for (const to of getAdjacentPositions(from)) {
        if (legalMove(state, from, to, color)) actions.push({ from, to });
      }
    }
  }
  return actions;
}

export function hasAnyLegalAction(state: GameState, color: StoneColor): boolean {
  return listLegalPlaceActions(state, color).length > 0 || listLegalMoveActions(state, color).length > 0;
}

function applyForcedPass(state: GameState, command: Extract<GameCommand, { type: "FORCED_PASS" }>): EngineResult {
  if (state.roundStatus !== "PLAYING") return fail(state, "INVALID_PHASE", "Forced pass is only available during normal play.");
  const color = colorForPlayer(state, command.playerId);
  if (!color || color !== state.currentTurnColor) return fail(state, "NOT_YOUR_TURN", "It is not this player's turn.");
  if (hasAnyLegalAction(state, color)) return fail(state, "INVALID_COMMAND", "The player still has a legal action.");
  const next = cloneState(state);
  const winner = winnerForBoard(next, command.playerId);
  if (winner.winnerPlayerId) return applyRoundOutcome(next, command, winner.winnerPlayerId, winner.reasons, winner.evidence, "BOARD_WIN_BEFORE_FORCED_PASS");
  next.consecutiveForcedPasses += 1;
  if (next.consecutiveForcedPasses >= 2) {
    finishRound(next, { winnerPlayerId: null, winnerColor: null, draw: true, reasons: [], evidence: [], resultReason: "FORCED_PASS_DRAW" }, command.now);
  } else {
    nextTurn(next, command.now);
  }
  return { ok: true, state: next, events: [commit(next, command, "FORCED_PASS", { consecutive: next.consecutiveForcedPasses })] };
}

function applyRoundOutcome(state: GameState, command: GameCommand, winnerPlayerId: string, reasons: WinReason[], evidence: WinEvidence[], resultReason: string): EngineResult {
  const next = cloneState(state);
  finishRound(next, {
    winnerPlayerId,
    winnerColor: colorForPlayer(next, winnerPlayerId),
    draw: false,
    reasons,
    evidence,
    resultReason,
  }, command.now);
  return { ok: true, state: next, events: [commit(next, command, "ROUND_WON", { resultReason, reasons })] };
}

function applyResign(state: GameState, command: Extract<GameCommand, { type: "ROUND_RESIGN" | "MATCH_FORFEIT" }>): EngineResult {
  if (state.roundStatus !== "OPENING" && state.roundStatus !== "PLAYING") return fail(state, "INVALID_PHASE", "Resignation is not available now.");
  const color = colorForPlayer(state, command.playerId);
  if (!color) return fail(state, "PLAYER_NOT_FOUND", "The player has no color.");
  const winner = winnerForBoard(state, command.playerId);
  const otherPlayerId = state.playerIdsByColor[opponent(color)];
  if (winner.winnerPlayerId) return applyRoundOutcome(state, command, winner.winnerPlayerId, winner.reasons, winner.evidence, "BOARD_WIN_BEFORE_RESIGNATION");
  if (command.type === "MATCH_FORFEIT") {
    const next = cloneState(state);
    next.matchStatus = "FINISHED";
    next.roundStatus = "MATCH_RESULT";
    next.matchWinner = otherPlayerId;
    next.roundWinner = otherPlayerId;
    next.resultReason = "MATCH_FORFEIT";
    next.turnStartedAt = null;
    next.turnDeadline = null;
    return { ok: true, state: next, events: [commit(next, command, "MATCH_FORFEIT", { winnerPlayerId: otherPlayerId })] };
  }
  return applyRoundOutcome(state, command, otherPlayerId, [], [], "ROUND_RESIGNATION");
}

function applySelectColor(state: GameState, command: Extract<GameCommand, { type: "SELECT_NEXT_COLOR" }>): EngineResult {
  if (state.roundStatus !== "ROUND_RESULT" || state.matchStatus !== "ACTIVE") return fail(state, "INVALID_PHASE", "Color selection is not active.");
  if (state.nextRoundColorSelectorId !== command.playerId) return fail(state, "NOT_ROUND_LOSER", "Only the previous round loser selects a color.");
  if (state.nextRoundBlackPlayerId !== null) return fail(state, "COLOR_ALREADY_SELECTED", "The next round color has already been selected.");
  const next = cloneState(state);
  next.nextRoundBlackPlayerId = command.color === "BLACK" ? command.playerId : (next.players.find((player) => player.id !== command.playerId) as { id: string }).id;
  return { ok: true, state: next, events: [commit(next, command, "NEXT_ROUND_COLOR_SELECTED", { color: command.color })] };
}

function applyStartNextRound(state: GameState, command: Extract<GameCommand, { type: "START_NEXT_ROUND" }>): EngineResult {
  if (state.roundStatus !== "ROUND_RESULT" || state.matchStatus !== "ACTIVE") return fail(state, "INVALID_PHASE", "The next round is not ready to start.");
  if (state.nextRoundBlackPlayerId === null || !isReady(state)) return fail(state, "INVALID_COMMAND", "Color selection and both Ready states are required.");
  if (!state.players.some((player) => player.id === command.playerId && player.isHost)) return fail(state, "PLAYER_ONLY", "Only the host can start the next round.");
  const next = cloneState(state);
  next.roundNumber += 1;
  const blackPlayerId = next.nextRoundBlackPlayerId as string;
  const whitePlayerId = next.players.find((player) => player.id !== blackPlayerId)?.id as string;
  next.playerIdsByColor = { BLACK: blackPlayerId, WHITE: whitePlayerId };
  resetRound(next, command.now);
  const eventItem = commit(next, command, "NEXT_ROUND_STARTED", { roundNumber: next.roundNumber });
  return { ok: true, state: next, events: [eventItem] };
}

export function applyCommand(state: GameState, command: GameCommand): EngineResult {
  const validation = validateCommand(state, command);
  if (validation) return validation;
  switch (command.type) {
    case "READY": return applyReady(state, command);
    case "START_ROUND": return applyStartRound(state, command);
    case "OPENING_PLACE": return applyOpeningPlace(state, command);
    case "PLACE":
    case "MOVE": return applyBoardAction(state, command);
    case "TIMEOUT": return applyTimeout(state, command);
    case "FORCED_PASS": return applyForcedPass(state, command);
    case "ROUND_RESIGN":
    case "MATCH_FORFEIT": return applyResign(state, command);
    case "SELECT_NEXT_COLOR": return applySelectColor(state, command);
    case "START_NEXT_ROUND": return applyStartNextRound(state, command);
  }
}

export function validateOpeningPlacement(state: GameState, playerId: string, position: Position): string | null {
  if (state.roundStatus !== "OPENING") return "Opening placement is not active.";
  return validateOpening(state, playerId, position);
}

export function validatePlaceAction(state: GameState, playerId: string, position: Position): string | null {
  const color = colorForPlayer(state, playerId);
  if (state.roundStatus !== "PLAYING") return "Normal board actions are not active.";
  if (!color || color !== state.currentTurnColor) return "It is not this player's turn.";
  if (!isInsideBoard(position)) return "The position is outside the board.";
  if (getCell(state.board, position).length !== 0) return "A new stone requires an empty cell.";
  if (state.remainingStonesByColor[color] <= 0) return "No stones remain for this player.";
  return null;
}

export function validateMoveAction(state: GameState, playerId: string, from: Position, to: Position): string | null {
  const color = colorForPlayer(state, playerId);
  if (state.roundStatus !== "PLAYING") return "Normal board actions are not active.";
  if (!color || color !== state.currentTurnColor) return "It is not this player's turn.";
  if (!isInsideBoard(from) || !isInsideBoard(to)) return "The position is outside the board.";
  const source = getCell(state.board, from);
  const destination = getCell(state.board, to);
  if (source.length === 0) return "The source cell is empty.";
  if (getTopColor(source) !== color) return "Only the player's top stone can move.";
  if (!areAdjacent(from, to)) return "The destination must be adjacent.";
  if (!canStack(destination)) return "The destination stack cannot exceed height three.";
  if (destination.length > source.length) return "The destination was higher than the source.";
  return null;
}

export function applyOpeningPlacement(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "OPENING_PLACE" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "OPENING_PLACE" });
}

export function applyPlaceAction(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "PLACE" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "PLACE" });
}

export function applyMoveAction(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "MOVE" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "MOVE" });
}

export function resolveTimeout(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "TIMEOUT" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "TIMEOUT" });
}

export function resolveForcedPass(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "FORCED_PASS" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "FORCED_PASS" });
}

export function resolveRoundResignation(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "ROUND_RESIGN" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "ROUND_RESIGN" });
}

export function resolveMatchForfeit(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "MATCH_FORFEIT" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "MATCH_FORFEIT" });
}

export function advanceToNextRound(
  state: GameState,
  command: Omit<Extract<GameCommand, { type: "START_NEXT_ROUND" }>, "type">,
): EngineResult {
  return applyCommand(state, { ...command, type: "START_NEXT_ROUND" });
}

export function resolvePostBoardAction(state: GameState, actorPlayerId: string): RoundOutcome {
  const winner = winnerForBoard(state, actorPlayerId);
  return {
    winnerPlayerId: winner.winnerPlayerId,
    winnerColor: winner.winnerPlayerId ? colorForPlayer(state, winner.winnerPlayerId) : null,
    draw: !winner.winnerPlayerId,
    reasons: winner.reasons,
    evidence: winner.evidence,
    resultReason: winner.reasons.join(","),
  };
}

export function serializePublicGameState(state: GameState): PublicGameState {
  const { processedCommandIds: _processedCommandIds, board, ...publicState } = state;
  return {
    ...publicState,
    board: board.map((row) => row.map((cell) => ({ height: getCellHeight(cell), topColor: getTopColor(cell) }))),
  };
}
