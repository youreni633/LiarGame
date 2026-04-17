export type Player = {
  id: string;
  nickname: string;
  ready: boolean;
  isHost: boolean;
  isLiar: boolean;
  word: string;
  lastSeen: number;
};

export type ChatMessage = {
  id: string;
  playerId: string;
  nickname: string;
  message: string;
  timestamp: number;
  type: "chat" | "system" | "speak";
};

export type Vote = {
  voterId: string;
  targetId: string;
};

export type GameMode = "classic" | "fool";

export type GamePhase =
  | "waiting"
  | "word_reveal"
  | "speaking"
  | "free_chat"
  | "vote_extend"
  | "speaking2"
  | "final_vote"
  | "liar_guess"
  | "result";

export type Room = {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  phase: GamePhase;
  gameMode: GameMode;
  category: string;
  realWord: string;
  liarWord: string;
  liarId: string;
  speakingOrder: string[];
  currentSpeakerIndex: number;
  currentSpeakerStartTime: number;
  speakingTimeLimit: number;
  messages: ChatMessage[];
  votes: Vote[];
  extendVotes: { playerId: string; extend: boolean }[];
  liarGuess: string;
  roundNumber: number;
  phaseStartTime: number;
  freeChatDuration: number;
  createdAt: number;
  lastActivity: number;
  version: number;
};
