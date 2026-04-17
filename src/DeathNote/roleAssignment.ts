import { ROLE_DEFINITIONS } from "./constants.js";
import type {
  DNAssignedRole,
  DNPlayerInfo,
  DNRoleKey,
} from "./types.js";

function shuffle<T>(items: T[]) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function pickRandom<T>(items: T[], count: number) {
  return shuffle(items).slice(0, count);
}

export function getRoleKeysForPlayerCount(count: number): DNRoleKey[] {
  if (count < 3 || count > 12) {
    throw new Error("데스노트 게임은 3명에서 12명 사이만 가능합니다.");
  }

  if (count === 3) return ["L", "M", "Hal"];
  if (count === 4) return ["L", "N", "Kira", "Kiyomi"];
  if (count === 5) return ["L", "N", "M", "Kira", "Kiyomi"];
  if (count === 6) {
    return [
      "L",
      "N",
      "M",
      "Kira",
      "Kiyomi",
      ...pickRandom<DNRoleKey>(
        ["W", "Hal", "Mogi", "Mathuda", "Jebanni", "Misa", "Mikami"],
        1,
      ),
    ];
  }
  if (count === 7) {
    const group: DNRoleKey[] =
      Math.random() < 0.5 ? ["Hal", "Misa"] : ["Jebanni", "Mikami"];
    return ["L", "N", "M", "Kira", "Kiyomi", ...group];
  }
  if (count === 8) {
    const group: DNRoleKey[] =
      Math.random() < 0.5 ? ["Hal", "Misa"] : ["Jebanni", "Mikami"];
    const rest = (["W", "Hal", "Mogi", "Mathuda", "Jebanni", "Misa", "Mikami"] as DNRoleKey[]).filter(
      (key) => !group.includes(key),
    );
    return ["L", "N", "M", "Kira", "Kiyomi", ...group, ...pickRandom<DNRoleKey>(rest, 1)];
  }
  if (count === 9) {
    const extras =
      Math.random() < 0.5
        ? (["Jebanni", "Mikami"] as DNRoleKey[])
        : pickRandom<DNRoleKey>(["W", "Mogi", "Mathuda", "Jebanni", "Mikami"], 2);
    return ["L", "N", "M", "Kira", "Kiyomi", "Hal", "Misa", ...extras];
  }
  if (count === 10) {
    return [
      "L",
      "N",
      "M",
      "Kira",
      "Kiyomi",
      "Hal",
      "Misa",
      "Jebanni",
      "Mikami",
      ...pickRandom<DNRoleKey>(["W", "Mogi", "Mathuda"], 1),
    ];
  }
  if (count === 11) {
    return [
      "L",
      "N",
      "M",
      "Kira",
      "Kiyomi",
      "Hal",
      "Misa",
      "Jebanni",
      "Mikami",
      ...pickRandom<DNRoleKey>(["W", "Mogi", "Mathuda"], 2),
    ];
  }

  return [
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
}

export function shuffleAndAssignRoles(players: DNPlayerInfo[]): DNAssignedRole[] {
  const roleKeys = shuffle(getRoleKeysForPlayerCount(players.length));
  const shuffledPlayers = shuffle(players);

  return roleKeys.map((roleKey, index) => {
    const player = shuffledPlayers[index];
    const definition = ROLE_DEFINITIONS[roleKey];
    return {
      playerId: player.id,
      name: player.name,
      key: definition.key,
      role: definition.role,
      team: definition.team,
      alive: true,
      whisper: definition.key === "W" ? 100 : players.length,
      note: definition.key === "W" ? 100 : 2,
      deathreason: "생존",
      img: definition.image,
      explain: definition.explain,
      mode: player.mode,
      cooldowns: {},
      skillUses: {
        watchNote: 1,
        butler: 1,
        wammy: 1,
        watchKill: 1,
        piece: 0,
        underwear: 1,
        substitute: definition.key === "Mikami" ? 3 : 0,
        kiyomiBroadcast: definition.key === "Kiyomi" ? 5 : 0,
        eyes: definition.key === "Misa" ? 4 : 0,
      },
      flags: {
        nUnlocked: false,
        kidnappedKiyomi: false,
        kiyomiSeal: true,
        mikamiSeal: true,
        underwearActive: false,
        misaLifePoint: definition.key === "Misa" ? 500 : 0,
        meloPassive: definition.key === "M" ? 3 : 0,
      },
    };
  });
}
