export const BOARD_SIZE = 10;
export const MAX_STACK_HEIGHT = 3;
export const INITIAL_STONES_PER_PLAYER = 25;
export const TURN_SECONDS = 30;
export const MATCH_ROUNDS_MAX = 3;
export const MATCH_WINS_REQUIRED = 2;

export type StoneColor = "BLACK" | "WHITE";
export type Stone = { color: StoneColor };
export type Cell = Stone[];
export type Board = Cell[][];
export type Position = { row: number; col: number };

export type MatchStatus = "WAITING" | "ACTIVE" | "FINISHED";
export type RoundStatus =
  | "WAITING_READY"
  | "OPENING"
  | "PLAYING"
  | "ROUND_RESULT"
  | "MATCH_RESULT";

export type WinReason =
  | "EXACT_FIVE"
  | "FIVE_TOP_LEVEL_THREES"
  | "CONNECTED_LEVEL_THREE_THREES"
  | "MULTIPLE"
  | "SIMULTANEOUS_ACTOR_PRIORITY";

export type PlayerState = {
  id: string;
  nickname: string;
  isHost: boolean;
  connected: boolean;
  ready: boolean;
};

export type BoardAction =
  | {
      type: "OPENING_PLACE" | "PLACE";
      playerId: string;
      color: StoneColor;
      position: Position;
    }
  | {
      type: "MOVE";
      playerId: string;
      color: StoneColor;
      from: Position;
      to: Position;
    }
  | {
      type: "TIMEOUT" | "FORCED_PASS" | "ROUND_RESIGN" | "MATCH_FORFEIT";
      playerId: string;
      color: StoneColor;
    };

export type LastAction = BoardAction | null;

export type WinEvidence = {
  color: StoneColor;
  reasons: WinReason[];
  exactFiveLines: Position[][];
  fiveTopLevelThreeCells: Position[];
  connectedTopLevelThreeComponents: Position[][];
};

export type RoundOutcome = {
  winnerPlayerId: string | null;
  winnerColor: StoneColor | null;
  draw: boolean;
  reasons: WinReason[];
  evidence: WinEvidence[];
  resultReason: string;
};

export type GameState = {
  matchId: string;
  roomId: string;
  revision: number;
  matchStatus: MatchStatus;
  roundNumber: number;
  roundStatus: RoundStatus;
  openingIndex: number;
  openingSequence: StoneColor[];
  board: Board;
  players: PlayerState[];
  playerIdsByColor: Record<StoneColor, string>;
  currentTurnColor: StoneColor;
  remainingStonesByColor: Record<StoneColor, number>;
  roundScoreByPlayer: Record<string, number>;
  readyByPlayer: Record<string, boolean>;
  lastBoardActionPlayerId: string | null;
  lastBoardActionColor: StoneColor | null;
  lastAction: LastAction;
  turnStartedAt: number | null;
  turnDeadline: number | null;
  consecutiveForcedPasses: number;
  roundWinner: string | null;
  matchWinner: string | null;
  resultReason: string | null;
  roundOutcome: RoundOutcome | null;
  nextRoundColorSelectorId: string | null;
  nextRoundBlackPlayerId: string | null;
  openingPositionsByColor: Record<StoneColor, Position[]>;
  processedCommandIds: string[];
  createdAt: number;
  updatedAt: number;
};

export type CommandBase = {
  commandId: string;
  expectedRevision: number;
  now: number;
};

export type GameCommand =
  | (CommandBase & { type: "READY"; playerId: string; ready: boolean })
  | (CommandBase & {
      type: "START_ROUND";
      playerId: string;
      blackPlayerId: string;
      whitePlayerId: string;
    })
  | (CommandBase & {
      type: "OPENING_PLACE";
      playerId: string;
      position: Position;
    })
  | (CommandBase & {
      type: "PLACE";
      playerId: string;
      position: Position;
    })
  | (CommandBase & {
      type: "MOVE";
      playerId: string;
      from: Position;
      to: Position;
    })
  | (CommandBase & { type: "TIMEOUT"; playerId: string })
  | (CommandBase & { type: "FORCED_PASS"; playerId: string })
  | (CommandBase & { type: "ROUND_RESIGN"; playerId: string })
  | (CommandBase & { type: "MATCH_FORFEIT"; playerId: string })
  | (CommandBase & { type: "SELECT_NEXT_COLOR"; playerId: string; color: StoneColor })
  | (CommandBase & { type: "START_NEXT_ROUND"; playerId: string });

export type GameEvent = {
  type: string;
  revision: number;
  at: number;
  playerId: string | null;
  payload: Record<string, unknown>;
};

export type PublicCell = {
  height: number;
  topColor: StoneColor | null;
};

export type PublicGameState = Omit<GameState, "board" | "processedCommandIds"> & {
  board: PublicCell[][];
};

export type EngineErrorCode =
  | "INVALID_COMMAND"
  | "INVALID_PHASE"
  | "NOT_YOUR_TURN"
  | "PLAYER_NOT_FOUND"
  | "PLAYER_ONLY"
  | "SPECTATOR_READ_ONLY"
  | "ROOM_FULL"
  | "STALE_STATE"
  | "DUPLICATE_COMMAND"
  | "OUT_OF_BOUNDS"
  | "CELL_NOT_EMPTY"
  | "NO_STONES_LEFT"
  | "SOURCE_EMPTY"
  | "SOURCE_TOP_NOT_OWNED"
  | "DESTINATION_NOT_ADJACENT"
  | "DESTINATION_TOO_HIGH"
  | "OPENING_CENTER_FORBIDDEN"
  | "OPENING_OWN_ADJACENCY_FORBIDDEN"
  | "OPENING_WRONG_PLAYER"
  | "OPENING_WRONG_COLOR"
  | "TIME_NOT_EXPIRED"
  | "NO_LEGAL_ACTION"
  | "NOT_ROUND_LOSER"
  | "COLOR_ALREADY_SELECTED";

export type EngineError = {
  code: EngineErrorCode;
  message: string;
  latestState?: GameState;
};

export type EngineSuccess = {
  ok: true;
  state: GameState;
  events: GameEvent[];
};

export type EngineFailure = {
  ok: false;
  state: GameState;
  events: GameEvent[];
  error: EngineError;
};

export type EngineResult = EngineSuccess | EngineFailure;
