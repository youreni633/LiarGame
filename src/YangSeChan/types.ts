export type YSPhase = "lobby" | "prompt_input" | "turn";

export type YSPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  submittedPrompt: string;
  receivedPrompt: string;
  isPlaying: boolean;
  isSpectator: boolean;
  rank: number | null;
};

export type YSGameMessage = {
  id: string;
  type: "system" | "question" | "answer" | "guess";
  text: string;
  createdAt: number;
};

export type YSChatMessage = {
  id: string;
  playerId: string;
  nickname: string;
  text: string;
  createdAt: number;
};

export type YSPendingTurn = {
  actorId: string;
  targetId: string | null;
  question: string;
  answer: string;
  awaitingAnswer: boolean;
};

export type YSRoom = {
  id: string;
  name: string;
  hostId: string;
  phase: YSPhase;
  createdAt: number;
  updatedAt: number;
  version: number;
  players: YSPlayer[];
  leaderboard: string[];
  gameMessages: YSGameMessage[];
  chatMessages: YSChatMessage[];
  promptInputEndsAt: number | null;
  turnOrder: string[];
  currentTurnIndex: number;
  pendingTurn: YSPendingTurn | null;
  statusText: string;
  lastCompletedLeaderboard: string[];
  timers: Array<ReturnType<typeof setTimeout>>;
};
