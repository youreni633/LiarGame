export type CatchMindPhase = "lobby" | "turn" | "turn_result" | "result";

export type CatchMindDrawTool = "pen" | "eraser";

export type CatchMindDrawEvent = {
  id: string;
  type: "line" | "clear";
  x0?: number;
  y0?: number;
  x1?: number;
  y1?: number;
  color?: string;
  size?: number;
  tool?: CatchMindDrawTool;
  createdAt: number;
};

export type CatchMindChatMessage = {
  id: string;
  type: "chat" | "system";
  playerId: string;
  nickname: string;
  text: string;
  createdAt: number;
};

export type CatchMindPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  score: number;
  joinedAt: number;
  lastSeen: number;
};

export type CatchMindResultEntry = {
  playerId: string;
  nickname: string;
  score: number;
  rank: number;
};

export type CatchMindTurnEntry = {
  playerId: string;
  round: number;
};

export type CatchMindRoom = {
  id: string;
  name: string;
  hostId: string;
  phase: CatchMindPhase;
  createdAt: number;
  updatedAt: number;
  version: number;
  maxPlayers: number;
  maxRounds: number;
  turnDurationSeconds: number;
  players: CatchMindPlayer[];
  turnQueue: CatchMindTurnEntry[];
  turnIndex: number;
  currentDrawerId: string | null;
  currentWord: string;
  currentWordMask: string;
  turnStartedAt: number | null;
  turnEndsAt: number | null;
  drawEvents: CatchMindDrawEvent[];
  drawVersion: number;
  chatMessages: CatchMindChatMessage[];
  statusText: string;
  resultEntries: CatchMindResultEntry[];
  recentWords: string[];
  timers: Array<ReturnType<typeof setTimeout>>;
};

export type CatchMindStateResponse = {
  changed: boolean;
  version: number;
  drawVersion?: number;
  room?: {
    id: string;
    name: string;
    hostId: string;
    phase: CatchMindPhase;
    statusText: string;
    maxPlayers: number;
    maxRounds: number;
    turnDurationSeconds: number;
    currentRound: number;
    currentTurn: number;
    totalTurns: number;
    currentDrawerId: string | null;
    currentDrawerNickname: string;
    displayWord: string;
    revealedWord?: string;
    turnStartedAt: number | null;
    turnEndsAt: number | null;
  };
  players?: Array<{
    id: string;
    nickname: string;
    isHost: boolean;
    ready: boolean;
    connected: boolean;
    score: number;
    isDrawer: boolean;
  }>;
  myState?: {
    id: string;
    nickname: string;
    isHost: boolean;
    canDraw: boolean;
    isDrawer: boolean;
    score: number;
  } | null;
  messages?: CatchMindChatMessage[];
  drawEvents?: CatchMindDrawEvent[];
  resultEntries?: CatchMindResultEntry[];
};
