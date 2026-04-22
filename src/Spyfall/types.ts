export type SFPhase = "lobby" | "playing" | "final_vote" | "guessing" | "result";

export type SFRole = "spy" | "citizen" | null;

export type SFPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  ready: boolean;
  connected: boolean;
  role: SFRole;
  voteTargetId: string | null;
};

export type SFChatMessage = {
  id: string;
  type: "chat" | "system";
  playerId: string;
  nickname: string;
  text: string;
  createdAt: number;
};

export type SFResult = {
  winnerTeam: "spy" | "citizen";
  caption: string;
  location: string;
  spyPlayerId: string;
  spyNickname: string;
  accusedPlayerId?: string;
  accusedNickname?: string;
  guessedLocation?: string;
  source: "vote" | "spy_guess" | "timeout_vote" | "timeout_no_consensus";
};

export type SFRoom = {
  id: string;
  name: string;
  hostId: string;
  phase: SFPhase;
  createdAt: number;
  updatedAt: number;
  version: number;
  players: SFPlayer[];
  chatMessages: SFChatMessage[];
  statusText: string;
  location: string | null;
  candidateLocations: string[];
  spyPlayerId: string | null;
  roundEndsAt: number | null;
  voteEndsAt: number | null;
  result: SFResult | null;
  timers: Array<ReturnType<typeof setTimeout>>;
};
