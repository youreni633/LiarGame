export type FWPhase = "lobby" | "assignment" | "playing" | "result";

export type FWPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  isAlive: boolean;
  assignedTargetId: string | null;
  submittedWord: string;
  forbiddenWord: string;
  eliminatedOrder: number | null;
};

export type FWChatMessage = {
  id: string;
  type: "chat" | "system";
  playerId: string;
  nickname: string;
  text: string;
  createdAt: number;
};

export type FWResult = {
  winnerId: string;
  winnerNickname: string;
  caption: string;
};

export type FWRoom = {
  id: string;
  name: string;
  hostId: string;
  phase: FWPhase;
  createdAt: number;
  updatedAt: number;
  version: number;
  players: FWPlayer[];
  chatMessages: FWChatMessage[];
  assignmentEndsAt: number | null;
  statusText: string;
  result: FWResult | null;
  timers: Array<ReturnType<typeof setTimeout>>;
};
