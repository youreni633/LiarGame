export type DNTeam = "L" | "Kira" | "Melo";

export type DNRoleKey =
  | "L"
  | "N"
  | "M"
  | "W"
  | "Hal"
  | "Mogi"
  | "Mathuda"
  | "Jebanni"
  | "Kira"
  | "Misa"
  | "Kiyomi"
  | "Mikami";

export type DNGameMode = "일반" | "사신" | "바보";
export type DNPlayerViewMode = "이미지" | "텍스트";
export type DNPhase = "lobby" | "playing" | "result";

export type DNPlayerInfo = {
  id: string;
  name: string;
  mode: DNPlayerViewMode;
  joinedAt: number;
  connected: boolean;
};

export type DNMessage = {
  id: string;
  timestamp: number;
  type: "public" | "system" | "private" | "result";
  text: string;
  toPlayerIds?: string[];
  fromPlayerId?: string;
};

export type DNRoleDefinition = {
  key: DNRoleKey;
  role: string;
  team: Exclude<DNTeam, "Melo">;
  explain: string;
  image: string;
};

export type DNAssignedRole = {
  playerId: string;
  name: string;
  key: DNRoleKey;
  role: string;
  team: Exclude<DNTeam, "Melo">;
  alive: boolean;
  whisper: number;
  note: number;
  deathreason: string;
  img: string;
  explain: string;
  mode: DNPlayerViewMode;
  cooldowns: Record<string, number>;
  skillUses: Record<string, number>;
  flags: Record<string, boolean | number | string>;
};

export type DNResultEntry = {
  role: string;
  name: string;
  result: string;
};

export type DNVictoryType =
  | "L_ARREST"
  | "L_KIRA_DEAD"
  | "KIRA_WIN"
  | "MELO_WIN";

export type DNResult = {
  victoryType: DNVictoryType;
  winningTeam: DNTeam;
  title: string;
  caption: string;
  entries: DNResultEntry[];
  imageByPlayerId: Record<string, string>;
};

export type DNRoom = {
  id: string;
  name: string;
  phase: DNPhase;
  mode: DNGameMode;
  hostId: string;
  createdAt: number;
  updatedAt: number;
  version: number;
  players: DNPlayerInfo[];
  assignments: DNAssignedRole[];
  messages: DNMessage[];
  result: DNResult | null;
  statusText: string;
  startedAt: number | null;
  timers: Array<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>;
};

export type DNStateResponse = {
  changed: boolean;
  version: number;
  room?: {
    id: string;
    name: string;
    phase: DNPhase;
    mode: DNGameMode;
    hostId: string;
    statusText: string;
    startedAt: number | null;
  };
  players?: Array<{
    id: string;
    name: string;
    mode: DNPlayerViewMode;
    alive: boolean;
    deathreason: string;
    connected: boolean;
    revealedRole?: string;
  }>;
  myRole?: {
    key: DNRoleKey;
    role: string;
    team: Exclude<DNTeam, "Melo">;
    explain: string;
    img: string;
    alive: boolean;
    deathreason: string;
    whisper: number;
    note: number;
    mode: DNPlayerViewMode;
    hidden: boolean;
    cooldowns: Record<string, number>;
    skillUses: Record<string, number>;
    flags: Record<string, boolean | number | string>;
  } | null;
  messages?: DNMessage[];
  result?: DNResult | null;
  availableCommands?: string[];
};
