import type {
  DNGameMode,
  DNPlayerViewMode,
  DNRoleDefinition,
  DNRoleKey,
} from "./types.js";

function svgDataUri(
  title: string,
  subtitle: string,
  colorA = "#0f172a",
  colorB = "#2563eb",
) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colorA}" />
        <stop offset="100%" stop-color="${colorB}" />
      </linearGradient>
    </defs>
    <rect width="1200" height="675" rx="48" fill="url(#g)" />
    <text x="600" y="290" text-anchor="middle" fill="#ffffff" font-size="88" font-family="Arial, sans-serif" font-weight="700">${title}</text>
    <text x="600" y="380" text-anchor="middle" fill="#e2e8f0" font-size="34" font-family="Arial, sans-serif">${subtitle}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const DN_MAX_PLAYERS = 12;
export const DN_MIN_PLAYERS = 3;

export const DN_MODES: DNGameMode[] = ["일반", "사신", "바보"];
export const DN_VIEW_MODES: DNPlayerViewMode[] = ["이미지", "텍스트"];

export const COOLDOWNS = {
  ARREST_L: 180_000,
  ARREST_N: 180_000,
  BROADCAST: 30_000,
  WIRETAP_COOLDOWN: 60_000,
  WIRETAP_DURATION: 30_000,
  DEATHNOTE_COOLDOWN: 90_000,
  DEATHNOTE_KILL_DELAY: 40_000,
  DESINNOTE_COOLDOWN: 90_000,
  WATCH_KIYOMI: 60_000,
  KIDNAP_KIYOMI: 60_000,
  UNDERWEAR_NOTE_DURATION: 60_000,
  UNDERWEAR_NOTE_PENALTY: 200_000,
  GATHERING_INFO: 60_000,
  ARREST_MISA: 60_000,
  DETECTIVE_COOLDOWN: 60_000,
  DETECTIVE_WAIT: 10_000,
  LOVE_KIRA_COOLDOWN: 10_000,
  LOVE_KIRA_WAIT: 10_000,
  ENVOY_EYES: 60_000,
  REM_NOTE: 90_000,
  FOLLOW_COOLDOWN: 120_000,
  FOLLOW_WAIT: 60_000,
  CHECK_L: 150_000,
  BABO: 60_000,
  ARREST_MIKAMI: 60_000,
  CHASE_COOLDOWN: 100_000,
  CHASE_WAIT: 50_000,
  WORSHIP_KIRA: 100_000,
  SASIN_INTERVAL: 90_000,
} as const;

export const START_IMAGE = svgDataUri("DEATH NOTE", "게임 시작", "#111827", "#7c3aed");
export const RESULT_IMAGES = {
  LWin_renewal: svgDataUri("L TEAM WIN", "엘 생존 승리", "#0f172a", "#2563eb"),
  NWin: svgDataUri("N TEAM WIN", "엘 사망 후 니아 승리", "#1e293b", "#0284c7"),
  MWin: svgDataUri("MELO WIN", "멜로 특수 승리", "#111827", "#ea580c"),
  KiraWin: svgDataUri("KIRA WIN", "키라 팀 승리", "#111827", "#b91c1c"),
  KiraLose: svgDataUri("KIRA LOSE", "키라 팀 패배", "#334155", "#64748b"),
  LLose: svgDataUri("L TEAM LOSE", "L 팀 패배", "#111827", "#7c2d12"),
} as const;

export const ROLE_DEFINITIONS: Record<DNRoleKey, DNRoleDefinition> = {
  L: {
    key: "L",
    role: "엘",
    team: "L",
    explain:
      "/체포 [이름]: 키라를 체포합니다. /방송 [메시지]: 전체 방송. /도청 [이름]: 30초간 귓속말/쪽지 감청.",
    image: svgDataUri("L", "엘", "#111827", "#2563eb"),
  },
  N: {
    key: "N",
    role: "니아",
    team: "L",
    explain:
      "엘 사망 후 /체포, /방송 사용 가능. /감시 [이름]: 키요미 여부를 확인하고 정보수집을 봉인합니다.",
    image: svgDataUri("N", "니아", "#0f172a", "#0ea5e9"),
  },
  M: {
    key: "M",
    role: "멜로",
    team: "L",
    explain:
      "/납치 [이름]: 키요미를 맞추면 납치. /노트조각 [역할] [이름] [사인]: 납치 성공 후 1회.",
    image: svgDataUri("M", "멜로", "#111827", "#f59e0b"),
  },
  W: {
    key: "W",
    role: "와타리",
    team: "L",
    explain:
      "/집사: 엘 정체를 확인. /와미즈하우스 [니아|멜로]: 엘 사망 후 니아/멜로 정체 확인.",
    image: svgDataUri("W", "와타리", "#334155", "#475569"),
  },
  Hal: {
    key: "Hal",
    role: "할리드너",
    team: "L",
    explain:
      "/연금 [이름]: 미사를 맞추면 연금. /수사관 [이름]: 10초 후 L측/키라측 확인.",
    image: svgDataUri("HAL", "할리드너", "#0f172a", "#10b981"),
  },
  Mogi: {
    key: "Mogi",
    role: "모기",
    team: "L",
    explain:
      "/미행 [이름]: 60초 후 70% 확률로 정체 확인. /엘확인: 150초 후 엘 또는 니아를 확인합니다.",
    image: svgDataUri("MOGI", "모기", "#0f172a", "#14b8a6"),
  },
  Mathuda: {
    key: "Mathuda",
    role: "마츠다",
    team: "L",
    explain:
      "/바보 [이름]: 50% 확률로 상대 정체를 확인하고, 자신의 정체는 상대에게 공개됩니다.",
    image: svgDataUri("MATSUDA", "마츠다", "#0f172a", "#f97316"),
  },
  Jebanni: {
    key: "Jebanni",
    role: "제반니",
    team: "L",
    explain:
      "/바꿔치기 [이름]: 미카미를 맞추면 대신노트를 봉인. /추적 [이름]: 50초 후 70% 확인.",
    image: svgDataUri("JEBANNI", "제반니", "#111827", "#22c55e"),
  },
  Kira: {
    key: "Kira",
    role: "키라",
    team: "Kira",
    explain:
      "/데스노트 [역할] [이름] [사인]: 40초 후 처형. /시계노트 [역할] [이름] [사인]: 즉시 1회.",
    image: svgDataUri("KIRA", "키라", "#111827", "#dc2626"),
  },
  Misa: {
    key: "Misa",
    role: "미사",
    team: "Kira",
    explain:
      "/연모, /사신의눈 [이름], /렘의노트 [역할] [이름] [사인]을 사용합니다.",
    image: svgDataUri("MISA", "미사", "#7f1d1d", "#ec4899"),
  },
  Kiyomi: {
    key: "Kiyomi",
    role: "키요미",
    team: "Kira",
    explain:
      "/정보수집 [역할] [이름], /방송 [메시지], /속옷노트 를 사용합니다.",
    image: svgDataUri("KIYOMI", "키요미", "#1f2937", "#be123c"),
  },
  Mikami: {
    key: "Mikami",
    role: "미카미",
    team: "Kira",
    explain:
      "/대신노트 [역할] [이름] [사인], /키라숭배 를 사용합니다.",
    image: svgDataUri("MIKAMI", "미카미", "#111827", "#991b1b"),
  },
};

export const ROLE_ORDER: DNRoleKey[] = [
  "L",
  "N",
  "M",
  "W",
  "Hal",
  "Mogi",
  "Mathuda",
  "Jebanni",
  "Kira",
  "Misa",
  "Kiyomi",
  "Mikami",
];

export const ROLE_LABEL_TO_KEY: Record<string, DNRoleKey> = Object.fromEntries(
  Object.values(ROLE_DEFINITIONS).map((role) => [role.role, role.key]),
) as Record<string, DNRoleKey>;

export const DEFAULT_COMMANDS = [
  "/귓속말(/귓 /r /ㄱ) [이름] [메시지]",
  "/쪽지 [이름] [메시지]",
];
