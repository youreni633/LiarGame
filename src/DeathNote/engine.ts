import { Hono } from "hono";
import {
  COOLDOWNS,
  DEFAULT_COMMANDS,
  DN_MAX_PLAYERS,
  DN_MIN_PLAYERS,
  DN_MODES,
  RESULT_IMAGES,
  ROLE_DEFINITIONS,
  ROLE_LABEL_TO_KEY,
} from "./constants.js";
import { shuffleAndAssignRoles } from "./roleAssignment.js";
import type {
  DNAssignedRole,
  DNGameMode,
  DNMessage,
  DNPlayerInfo,
  DNResult,
  DNResultEntry,
  DNRoleKey,
  DNRoom,
  DNStateResponse,
  DNVictoryType,
} from "./types.js";

const deathNoteRooms = new Map<string, DNRoom>();

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

function now() {
  return Date.now();
}

function getRoom(roomId: string) {
  return deathNoteRooms.get(roomId);
}

function pushMessage(
  room: DNRoom,
  message: Omit<DNMessage, "id" | "timestamp">,
) {
  room.messages.push({
    id: generateId(),
    timestamp: now(),
    ...message,
  });
  room.messages = room.messages.slice(-300);
  room.version += 1;
  room.updatedAt = now();
}

function schedule(
  room: DNRoom,
  timer: ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>,
) {
  room.timers.push(timer);
  return timer;
}

function clearAllTimers(room: DNRoom) {
  room.timers.forEach((timer) => {
    clearTimeout(timer);
    clearInterval(timer);
  });
  room.timers = [];
}

function visibleMessages(room: DNRoom, playerId: string) {
  return room.messages.filter((message) => {
    if (!message.toPlayerIds || message.toPlayerIds.length === 0) {
      return true;
    }
    return message.toPlayerIds.includes(playerId);
  });
}

function findPlayer(room: DNRoom, playerId: string) {
  return room.players.find((player) => player.id === playerId);
}

function findAssignment(room: DNRoom, playerId: string) {
  return room.assignments.find((assignment) => assignment.playerId === playerId);
}

function findAssignmentByName(room: DNRoom, playerName: string) {
  return room.assignments.find((assignment) => assignment.name === playerName);
}

function findAliveAssignmentByRole(room: DNRoom, roleKey: DNRoleKey) {
  return room.assignments.find(
    (assignment) => assignment.key === roleKey && assignment.alive,
  );
}

function getRoleKeyByLabel(label: string) {
  return ROLE_LABEL_TO_KEY[label] || null;
}

function sanitizeCause(cause?: string) {
  if (!cause || cause.trim() === "" || cause.trim() === "생존") {
    return "심장마비";
  }
  return cause.trim();
}

function getCooldownRemaining(assignment: DNAssignedRole, skillKey: string) {
  return Math.max(0, (assignment.cooldowns[skillKey] || 0) - now());
}

function setCooldown(assignment: DNAssignedRole, skillKey: string, duration: number) {
  assignment.cooldowns[skillKey] = now() + duration;
}

function sendPrivate(room: DNRoom, playerIds: string[], text: string, fromPlayerId?: string) {
  pushMessage(room, {
    type: "private",
    toPlayerIds: playerIds,
    fromPlayerId,
    text,
  });
}

function sendSystem(room: DNRoom, text: string) {
  pushMessage(room, { type: "system", text });
}

function formatResult(entry: DNAssignedRole) {
  if (entry.deathreason === "생존" || entry.deathreason === "체포") {
    return `${entry.role}: ${entry.name} - 결과: ${entry.deathreason}`;
  }
  return `${entry.role}: ${entry.name} - 결과: ${entry.deathreason}(으)로 사망`;
}

function getResultImageForPlayer(
  resultType: DNVictoryType,
  player: DNAssignedRole,
  lAlive: boolean,
) {
  if (resultType === "KIRA_WIN") {
    return player.team === "Kira" ? RESULT_IMAGES.KiraWin : RESULT_IMAGES.LLose;
  }
  if (resultType === "MELO_WIN") {
    return player.team === "Kira" ? RESULT_IMAGES.KiraLose : RESULT_IMAGES.MWin;
  }
  if (resultType === "L_ARREST" || resultType === "L_KIRA_DEAD") {
    if (player.team === "Kira") {
      return RESULT_IMAGES.KiraLose;
    }
    return lAlive ? RESULT_IMAGES.LWin_renewal : RESULT_IMAGES.NWin;
  }
  return RESULT_IMAGES.LWin_renewal;
}

function finalizeResult(room: DNRoom, victoryType: DNVictoryType, title: string, caption: string) {
  clearAllTimers(room);
  room.phase = "result";
  room.statusText = caption;

  const entries: DNResultEntry[] = room.assignments.map((assignment) => ({
    role: assignment.role,
    name: assignment.name,
    result: assignment.deathreason,
  }));

  const resultSummary = [
    "**최종 결과를 안내드립니다**",
    ...room.assignments.map((assignment) => formatResult(assignment)),
  ].join("\n");

  const lAlive = !!findAliveAssignmentByRole(room, "L");
  const winningTeam =
    victoryType === "KIRA_WIN"
      ? "Kira"
      : victoryType === "MELO_WIN"
        ? "Melo"
        : "L";

  const imageByPlayerId = Object.fromEntries(
    room.assignments.map((assignment) => [
      assignment.playerId,
      getResultImageForPlayer(victoryType, assignment, lAlive),
    ]),
  );

  room.result = {
    victoryType,
    winningTeam,
    title,
    caption,
    entries,
    imageByPlayerId,
  };

  sendSystem(room, resultSummary);
  room.assignments.forEach((assignment) => {
    sendPrivate(
      room,
      [assignment.playerId],
      `${caption}\\n당신의 결과 화면이 준비되었습니다.`,
    );
  });
}

function unlockNia(room: DNRoom) {
  const nia = room.assignments.find((assignment) => assignment.key === "N" && assignment.alive);
  if (nia) {
    nia.flags.nUnlocked = true;
    sendSystem(room, "[System] 엘이 사망했습니다...L의 유지를 이어 키라를 체포하세요");
  }
}

function maybeResolveVictory(room: DNRoom, trigger: "kill" | "arrest", context?: { killerRole?: DNRoleKey }) {
  const kira = room.assignments.find((assignment) => assignment.key === "Kira");
  const lAlive = !!findAliveAssignmentByRole(room, "L");
  const nAlive = !!findAliveAssignmentByRole(room, "N");

  if (trigger === "arrest" && kira && kira.deathreason === "체포") {
    finalizeResult(
      room,
      "L_ARREST",
      "L TEAM WIN",
      `**[속보] 키라 ${kira.name} (이)가 체포되었습니다 -게임 종료-**`,
    );
    return true;
  }

  if (kira && !kira.alive) {
    finalizeResult(
      room,
      context?.killerRole === "M" ? "MELO_WIN" : "L_KIRA_DEAD",
      context?.killerRole === "M" ? "MELO WIN" : "L TEAM WIN",
      "**키라가 사망했습니다. L측의 승리입니다 -게임 종료-**",
    );
    return true;
  }

  if (!lAlive && !nAlive && kira?.alive) {
    finalizeResult(
      room,
      "KIRA_WIN",
      "KIRA WIN",
      "**L과N 전원 사망했습니다. 키라의 승리입니다 -게임 종료-**",
    );
    return true;
  }

  return false;
}

function handlePostDeath(room: DNRoom, victim: DNAssignedRole, killerRole?: DNRoleKey) {
  if (victim.key === "L") {
    const nia = findAliveAssignmentByRole(room, "N");
    if (nia) {
      unlockNia(room);
    } else if (maybeResolveVictory(room, "kill", { killerRole })) {
      return;
    }
  }

  if (victim.key === "N" && !findAliveAssignmentByRole(room, "L")) {
    if (maybeResolveVictory(room, "kill", { killerRole })) {
      return;
    }
  }

  maybeResolveVictory(room, "kill", { killerRole });
}

function killPlayer(
  room: DNRoom,
  victim: DNAssignedRole,
  cause: string,
  killerRole?: DNRoleKey,
  actor?: DNAssignedRole,
  sourceLabel = "데스노트",
) {
  if (!victim.alive || room.phase !== "playing") {
    return;
  }

  victim.alive = false;
  victim.deathreason = cause;

  if (actor) {
    sendPrivate(
      room,
      [actor.playerId],
      `[System] ${sourceLabel}로 인해 ${victim.role}(이)가 사망했습니다.\\n※사인: ${cause}`,
    );
  }

  sendPrivate(
    room,
    [victim.playerId],
    `[System] 당신은 ${sourceLabel}에 의해 사망했습니다\\n※사인: ${cause}`,
  );
  sendSystem(room, `**[속보] ${victim.name}님이 사망했습니다.**`);

  handlePostDeath(room, victim, killerRole);
}

function parseDirectedMessage(input: string) {
  const [, target, ...rest] = input.trim().split(/\s+/);
  return { target, content: rest.join(" ").trim() };
}

function parseRoleNameCause(input: string) {
  const [, roleLabel, playerName, ...causeParts] = input.trim().split(/\s+/);
  return {
    roleLabel,
    playerName,
    cause: sanitizeCause(causeParts.join(" ")),
  };
}

function canAct(room: DNRoom, actor: DNAssignedRole) {
  if (room.phase !== "playing") {
    sendPrivate(room, [actor.playerId], "[System] 지금은 게임 진행 중이 아닙니다.");
    return false;
  }
  if (!actor.alive) {
    sendPrivate(room, [actor.playerId], "[System] 사망자는 스킬을 사용할 수 없습니다.");
    return false;
  }
  return true;
}

function resolveWiretap(room: DNRoom, actor: DNAssignedRole, targetPlayerId: string, text: string) {
  room.assignments
    .filter(
      (assignment) =>
        assignment.flags.wiretapTarget === targetPlayerId &&
        (assignment.key === "L" || assignment.key === "N"),
    )
    .forEach((assignment) => {
      sendPrivate(
        room,
        [assignment.playerId],
        `[System - 도청] ${ROLE_DEFINITIONS[actor.key].role}/${actor.name}: ${text}`,
      );
    });
}

const DN_WHISPER_COMMANDS = [
  "/\uadd3\uc18d\ub9d0 ",
  "/\uadd3 ",
  "/r ",
  "/\u3131 ",
];
const DN_NOTE_COMMAND = "/\ucabd\uc9c0 ";

function processCommonCommand(room: DNRoom, actor: DNAssignedRole, text: string) {
  if (DN_WHISPER_COMMANDS.some((command) => text.startsWith(command))) {
    const { target, content } = parseDirectedMessage(text);
    const targetAssignment = target ? findAssignmentByName(room, target) : null;
    if (!targetAssignment || !content) {
      sendPrivate(room, [actor.playerId], "[System] 사용법: /귓속말 [이름] [메시지]");
      return true;
    }
    if (actor.whisper <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 귓속말 횟수가 없습니다.");
      return true;
    }
    actor.whisper -= 1;

    let whisperPrefix = "[귓속말] ???";
    if (actor.key === "M" && targetAssignment.key === "N") {
      whisperPrefix = "[귓속말] ???(오독오독)";
    }
    if (actor.key === "M" && targetAssignment.key === "Hal") {
      whisperPrefix = `[귓속말-멜로] ${actor.name}`;
    }

    sendPrivate(
      room,
      [targetAssignment.playerId, actor.playerId],
      `${whisperPrefix}: ${content}`,
      actor.playerId,
    );
    resolveWiretap(room, actor, targetAssignment.playerId, content);
    return true;
  }

  if (text.startsWith(DN_NOTE_COMMAND)) {
    const { target, content } = parseDirectedMessage(text);
    const targetAssignment = target ? findAssignmentByName(room, target) : null;
    if (!targetAssignment || !content) {
      sendPrivate(room, [actor.playerId], "[System] 사용법: /쪽지 [이름] [메시지]");
      return true;
    }
    if (actor.note <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 쪽지 횟수가 없습니다.");
      return true;
    }
    actor.note -= 1;
    sendPrivate(
      room,
      [targetAssignment.playerId, actor.playerId],
      `[쪽지] ${actor.name}: ${content}`,
      actor.playerId,
    );
    resolveWiretap(room, actor, targetAssignment.playerId, content);
    return true;
  }
  if (text.startsWith("/귓속말 ")) {
    const { target, content } = parseDirectedMessage(text);
    const targetAssignment = target ? findAssignmentByName(room, target) : null;
    if (!targetAssignment || !content) {
      sendPrivate(room, [actor.playerId], "[System] 사용법: /귓속말 [이름] [메시지]");
      return true;
    }
    if (actor.whisper <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 귓속말 횟수가 없습니다.");
      return true;
    }
    actor.whisper -= 1;

    let whisperPrefix = "[귓속말] ???";
    if (actor.key === "M" && targetAssignment.key === "N") {
      whisperPrefix = "[귓속말] ???(오독오독)";
    }
    if (actor.key === "M" && targetAssignment.key === "Hal") {
      whisperPrefix = `[귓속말-멜로] ${actor.name}`;
    }

    sendPrivate(
      room,
      [targetAssignment.playerId, actor.playerId],
      `${whisperPrefix}: ${content}`,
      actor.playerId,
    );
    resolveWiretap(room, actor, targetAssignment.playerId, content);
    return true;
  }

  if (text.startsWith("/쪽지 ")) {
    const { target, content } = parseDirectedMessage(text);
    const targetAssignment = target ? findAssignmentByName(room, target) : null;
    if (!targetAssignment || !content) {
      sendPrivate(room, [actor.playerId], "[System] 사용법: /쪽지 [이름] [메시지]");
      return true;
    }
    if (actor.note <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 쪽지 횟수가 없습니다.");
      return true;
    }
    actor.note -= 1;
    sendPrivate(
      room,
      [targetAssignment.playerId, actor.playerId],
      `[쪽지] ${actor.name}: ${content}`,
      actor.playerId,
    );
    resolveWiretap(room, actor, targetAssignment.playerId, content);
    return true;
  }

  return false;
}

function isOnCooldown(room: DNRoom, assignment: DNAssignedRole, skillKey: string) {
  const remaining = getCooldownRemaining(assignment, skillKey);
  if (remaining > 0) {
    sendPrivate(
      room,
      [assignment.playerId],
      `[System] 아직 쿨다운 중입니다. ${(remaining / 1000).toFixed(0)}초 후에 다시 시도하세요.`,
    );
    return true;
  }
  return false;
}

function processRoleCommand(room: DNRoom, actor: DNAssignedRole, text: string) {
  if (!canAct(room, actor)) return;

  if (text.startsWith("/체포 ")) {
    if (actor.key !== "L" && actor.key !== "N") {
      sendPrivate(room, [actor.playerId], "[System] 체포 스킬을 사용할 수 없는 역할입니다.");
      return;
    }
    if (actor.key === "N" && !actor.flags.nUnlocked) {
      sendPrivate(room, [actor.playerId], "[System] 엘 사망 후에만 니아의 체포가 활성화됩니다.");
      return;
    }
    if (isOnCooldown(room, actor, "arrest")) return;
    setCooldown(actor, "arrest", actor.key === "L" ? COOLDOWNS.ARREST_L : COOLDOWNS.ARREST_N);

    const targetName = text.replace("/체포 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (target?.key === "Kira" && target.alive) {
      target.alive = false;
      target.deathreason = "체포";
      maybeResolveVictory(room, "arrest");
      return;
    }

    sendSystem(room, `**[속보] ${actor.role}의 정체는 ${actor.name} 입니다.**`);
    return;
  }

  if (text.startsWith("/방송 ")) {
    const content = text.replace("/방송 ", "").trim();
    if (!content) {
      sendPrivate(room, [actor.playerId], "[System] 사용법: /방송 [메시지]");
      return;
    }

    if (actor.key === "L" || actor.key === "N") {
      if (actor.key === "N" && !actor.flags.nUnlocked) {
        sendPrivate(room, [actor.playerId], "[System] 엘 사망 후에만 니아의 방송이 활성화됩니다.");
        return;
      }
      if (isOnCooldown(room, actor, "broadcast")) return;
      setCooldown(actor, "broadcast", COOLDOWNS.BROADCAST);
      sendSystem(room, `[L방송] : ${content}`);
      return;
    }

    if (actor.key === "Kiyomi") {
      if ((actor.skillUses.kiyomiBroadcast || 0) <= 0) {
        sendPrivate(room, [actor.playerId], "[System] 키요미의 방송 횟수가 없습니다.");
        return;
      }
      actor.skillUses.kiyomiBroadcast -= 1;
      sendSystem(room, `[L방송] : ${content}`);
      sendPrivate(
        room,
        [actor.playerId],
        `[System] 남은 방송 횟수: ${actor.skillUses.kiyomiBroadcast}회`,
      );
      return;
    }
  }

  if (text.startsWith("/도청 ")) {
    if (actor.key !== "L") return;
    if (isOnCooldown(room, actor, "wiretap")) return;
    const targetName = text.replace("/도청 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (!target || !target.alive) {
      sendPrivate(room, [actor.playerId], `[System] ${targetName}은(는) 도청할 수 있는 대상이 아닙니다.`);
      return;
    }
    setCooldown(actor, "wiretap", COOLDOWNS.WIRETAP_COOLDOWN);
    actor.flags.wiretapTarget = target.playerId;
    sendPrivate(room, [actor.playerId], `[System] ${target.name} 도청을 시작합니다. 30초간 지속됩니다.`);
    schedule(
      room,
      setTimeout(() => {
        actor.flags.wiretapTarget = "";
        sendPrivate(room, [actor.playerId], "[System] 도청이 종료되었습니다.");
      }, COOLDOWNS.WIRETAP_DURATION),
    );
    return;
  }

  if (text.startsWith("/감시 ")) {
    if (actor.key !== "N") return;
    if (isOnCooldown(room, actor, "watch")) return;
    const targetName = text.replace("/감시 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    setCooldown(actor, "watch", COOLDOWNS.WATCH_KIYOMI);
    if (target?.key === "Kiyomi" && target.alive) {
      target.flags.kiyomiSeal = false;
      sendPrivate(
        room,
        [actor.playerId],
        `${target.name}의 정체는 키요미가 맞습니다. 그녀의 정보수집을 방해합니다.`,
      );
    } else {
      sendPrivate(room, [actor.playerId], "해당 플레이어는 키요미가 아닙니다");
    }
    return;
  }

  if (text.startsWith("/납치 ")) {
    if (actor.key !== "M") return;
    if (isOnCooldown(room, actor, "kidnap")) return;
    const targetName = text.replace("/납치 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    setCooldown(actor, "kidnap", COOLDOWNS.KIDNAP_KIYOMI);

    if (target?.key === "Kiyomi" && target.alive) {
      if (target.flags.underwearActive) {
        killPlayer(room, actor, "속옷노트", "Kiyomi", target, "속옷노트");
        target.flags.underwearActive = false;
        const kiraSide = room.assignments.filter(
          (assignment) => assignment.team === "Kira" && assignment.alive,
        );
        if (kiraSide.length > 0) {
          const randomTarget = kiraSide[Math.floor(Math.random() * kiraSide.length)];
          schedule(
            room,
            setTimeout(() => {
              sendSystem(
                room,
                `**[속보] 속옷노트 여파로 키라측 인물 ${randomTarget.role}의 정체는 ${randomTarget.name} 입니다.**`,
              );
            }, COOLDOWNS.UNDERWEAR_NOTE_PENALTY),
          );
        }
      } else {
        target.alive = false;
        target.deathreason = "납치";
      }
      actor.skillUses.piece = 1;
      actor.flags.kidnappedKiyomi = true;
      sendPrivate(
        room,
        [actor.playerId],
        `${target.name}의 정체는 키요미가 맞습니다. 그녀를 납치합니다.`,
      );
      sendSystem(room, `**[속보] ${target.name}님이 납치되었습니다.**`);
    } else {
      sendPrivate(room, [actor.playerId], "해당 플레이어는 키요미가 아닙니다");
      sendSystem(room, `**[속보] 멜로의 정체는 ${actor.name} 입니다.**`);
    }
    return;
  }

  if (text.startsWith("/노트조각 ")) {
    if (actor.key !== "M") return;
    if (!actor.flags.kidnappedKiyomi || (actor.skillUses.piece || 0) <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 노트조각을 사용할 수 있는 상태가 아닙니다.");
      return;
    }
    actor.skillUses.piece = 0;
    const { roleLabel, playerName, cause } = parseRoleNameCause(text);
    const roleKey = roleLabel ? getRoleKeyByLabel(roleLabel) : null;
    const target = playerName ? findAssignmentByName(room, playerName) : null;
    schedule(
      room,
      setTimeout(() => {
        if (target && roleKey && target.key === roleKey && target.alive) {
          killPlayer(room, target, cause, "M", actor, "노트조각");
        } else {
          sendPrivate(room, [actor.playerId], "아무 일도 일어나지 않았습니다.");
        }
      }, COOLDOWNS.DEATHNOTE_KILL_DELAY),
    );
    return;
  }

  if (text === "/집사") {
    if (actor.key !== "W") return;
    if ((actor.skillUses.butler || 0) <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 이미 사용한 스킬입니다.");
      return;
    }
    actor.skillUses.butler = 0;
    const l = room.assignments.find((assignment) => assignment.key === "L");
    if (l) {
      sendPrivate(room, [actor.playerId], `엘의 정체는 ${l.name} 입니다.`);
    }
    return;
  }

  if (text.startsWith("/와미즈하우스 ")) {
    if (actor.key !== "W") return;
    if (findAliveAssignmentByRole(room, "L")) {
      sendPrivate(room, [actor.playerId], "[System] 엘 사망 후에만 사용할 수 있습니다.");
      return;
    }
    if ((actor.skillUses.wammy || 0) <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 이미 사용한 스킬입니다.");
      return;
    }
    actor.skillUses.wammy = 0;
    const roleLabel = text.replace("/와미즈하우스 ", "").trim();
    const roleKey = getRoleKeyByLabel(roleLabel);
    const target = roleKey ? room.assignments.find((assignment) => assignment.key === roleKey) : null;
    if (target && (target.key === "N" || target.key === "M")) {
      sendPrivate(room, [actor.playerId], `${target.role}의 정체는 ${target.name} 입니다.`);
    } else {
      sendPrivate(room, [actor.playerId], "[System] 니아 또는 멜로만 확인할 수 있습니다.");
    }
    return;
  }

  if (text.startsWith("/연금 ")) {
    if (actor.key !== "Hal") return;
    if (isOnCooldown(room, actor, "detain")) return;
    setCooldown(actor, "detain", COOLDOWNS.ARREST_MISA);
    const targetName = text.replace("/연금 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (target?.key === "Misa" && target.alive) {
      killPlayer(room, target, "연금", "Hal", actor, "연금");
      sendPrivate(room, [actor.playerId], `${target.name}의 정체는 미사가 맞습니다. 그녀를 연금합니다.`);
    } else {
      sendPrivate(room, [actor.playerId], "해당 플레이어는 미사가 아닙니다");
      sendSystem(room, `**[속보] 할리드너의 정체는 ${actor.name} 입니다.**`);
    }
    return;
  }

  if (text.startsWith("/수사관 ")) {
    if (actor.key !== "Hal") return;
    if (isOnCooldown(room, actor, "detective")) return;
    setCooldown(actor, "detective", COOLDOWNS.DETECTIVE_COOLDOWN);
    const targetName = text.replace("/수사관 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (!target) return;
    schedule(
      room,
      setTimeout(() => {
        sendPrivate(
          room,
          [actor.playerId],
          `${target.name}(은)는 ${target.team === "L" ? "수사관(L측)" : "키라측"}입니다.`,
        );
        if (target.team === "Kira") {
          sendPrivate(
            room,
            [target.playerId],
            `당신을 수사한 ${actor.name}의 정체는 할리드너입니다.`,
          );
        }
      }, COOLDOWNS.DETECTIVE_WAIT),
    );
    return;
  }

  if (text.startsWith("/미행 ")) {
    if (actor.key !== "Mogi") return;
    if (isOnCooldown(room, actor, "follow")) return;
    setCooldown(actor, "follow", COOLDOWNS.FOLLOW_COOLDOWN);
    const targetName = text.replace("/미행 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (!target) return;
    schedule(
      room,
      setTimeout(() => {
        const success = Math.random() < 0.7;
        if (success) {
          sendPrivate(room, [actor.playerId], `플레이어의 정체는 ${target.role} 입니다.`);
          if (target.team === "Kira" && Math.random() < 0.5) {
            sendPrivate(
              room,
              [target.playerId],
              `당신을 미행한 ${actor.name}의 정체는 모기입니다.`,
            );
          }
        } else {
          sendPrivate(room, [actor.playerId], "플레이어 미행에 실패했습니다");
        }
      }, COOLDOWNS.FOLLOW_WAIT),
    );
    return;
  }

  if (text === "/엘확인") {
    if (actor.key !== "Mogi") return;
    if (isOnCooldown(room, actor, "checkL")) return;
    setCooldown(actor, "checkL", COOLDOWNS.CHECK_L);
    schedule(
      room,
      setTimeout(() => {
        const target =
          findAliveAssignmentByRole(room, "L") ||
          room.assignments.find((assignment) => assignment.key === "N");
        if (target) {
          sendPrivate(room, [actor.playerId], `엘의 정체는 ${target.name}입니다.`);
        }
      }, COOLDOWNS.CHECK_L),
    );
    return;
  }

  if (text.startsWith("/바보 ")) {
    if (actor.key !== "Mathuda") return;
    if (isOnCooldown(room, actor, "babo")) return;
    setCooldown(actor, "babo", COOLDOWNS.BABO);
    const targetName = text.replace("/바보 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (!target) return;
    sendPrivate(room, [target.playerId], `바보 마츠다의 정체는 ${actor.name} 입니다.`);
    if (Math.random() < 0.5) {
      sendPrivate(room, [actor.playerId], `당신이 지목한 플레이어의 정체는 ${target.role} 입니다.`);
    } else {
      sendPrivate(room, [actor.playerId], "바보짓으로 상대에게 정체만 노출되었습니다.");
    }
    return;
  }

  if (text.startsWith("/바꿔치기 ")) {
    if (actor.key !== "Jebanni") return;
    if (isOnCooldown(room, actor, "swap")) return;
    setCooldown(actor, "swap", COOLDOWNS.ARREST_MIKAMI);
    const targetName = text.replace("/바꿔치기 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (target?.key === "Mikami") {
      target.flags.mikamiSeal = false;
      sendPrivate(
        room,
        [actor.playerId],
        `${target.name}의 정체는 미카미가 맞습니다. 그의 대신노트 스킬을 무력화합니다.`,
      );
    } else {
      sendPrivate(room, [actor.playerId], "해당 플레이어는 미카미가 아닙니다");
      sendSystem(room, `**[속보] 제반니의 정체는 ${actor.name} 입니다.**`);
    }
    return;
  }

  if (text.startsWith("/추적 ")) {
    if (actor.key !== "Jebanni") return;
    if (isOnCooldown(room, actor, "trace")) return;
    setCooldown(actor, "trace", COOLDOWNS.CHASE_COOLDOWN);
    const targetName = text.replace("/추적 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (!target) return;
    schedule(
      room,
      setTimeout(() => {
        if (Math.random() < 0.7) {
          sendPrivate(room, [actor.playerId], `추적한 플레이어의 정체는 ${target.role} 입니다.`);
          if (Math.random() < 0.5) {
            sendPrivate(
              room,
              [target.playerId],
              `당신을 추적한 ${actor.name}의 정체는 제반니입니다.`,
            );
          }
        } else {
          sendPrivate(room, [actor.playerId], "플레이어 추적에 실패했습니다");
        }
      }, COOLDOWNS.CHASE_WAIT),
    );
    return;
  }

  if (text.startsWith("/데스노트 ")) {
    if (actor.key !== "Kira") return;
    if (isOnCooldown(room, actor, "deathnote")) return;
    setCooldown(actor, "deathnote", COOLDOWNS.DEATHNOTE_COOLDOWN);
    const { roleLabel, playerName, cause } = parseRoleNameCause(text);
    const roleKey = roleLabel ? getRoleKeyByLabel(roleLabel) : null;
    const target = playerName ? findAssignmentByName(room, playerName) : null;

    schedule(
      room,
      setTimeout(() => {
        if (
          target &&
          roleKey &&
          target.key === roleKey &&
          target.alive &&
          !(target.key === "N" && findAliveAssignmentByRole(room, "L"))
        ) {
          killPlayer(room, target, cause, "Kira", actor, "데스노트");
        } else {
          sendPrivate(room, [actor.playerId], "아무 일도 일어나지 않았습니다.");
        }
      }, COOLDOWNS.DEATHNOTE_KILL_DELAY),
    );
    return;
  }

  if (text.startsWith("/시계노트 ")) {
    if (actor.key !== "Kira") return;
    if ((actor.skillUses.watchNote || 0) <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 시계노트는 1회만 사용할 수 있습니다.");
      return;
    }
    actor.skillUses.watchNote = 0;
    const { roleLabel, playerName, cause } = parseRoleNameCause(text);
    const roleKey = roleLabel ? getRoleKeyByLabel(roleLabel) : null;
    const target = playerName ? findAssignmentByName(room, playerName) : null;
    if (
      target &&
      roleKey &&
      target.key === roleKey &&
      target.alive &&
      !(target.key === "N" && findAliveAssignmentByRole(room, "L"))
    ) {
      killPlayer(room, target, cause, "Kira", actor, "시계노트");
    } else {
      sendPrivate(room, [actor.playerId], "아무 일도 일어나지 않았습니다.");
    }
    return;
  }

  if (text === "/연모") {
    if (actor.key !== "Misa") return;
    if (isOnCooldown(room, actor, "love")) return;
    if ((actor.flags.misaLifePoint as number) < 50) {
      sendPrivate(room, [actor.playerId], "[System] 포인트가 부족합니다.");
      return;
    }
    actor.flags.misaLifePoint = (actor.flags.misaLifePoint as number) - 50;
    setCooldown(actor, "love", COOLDOWNS.LOVE_KIRA_COOLDOWN);
    schedule(
      room,
      setTimeout(() => {
        const kira = room.assignments.find((assignment) => assignment.key === "Kira");
        if (kira && Math.random() < 0.5) {
          sendPrivate(
            room,
            [actor.playerId],
            `키라의 정체는 ${kira.name} 입니다. 남은포인트: ${actor.flags.misaLifePoint}`,
          );
        } else {
          sendPrivate(
            room,
            [actor.playerId],
            `키라를 확인하는데 실패했습니다 남은포인트: ${actor.flags.misaLifePoint}`,
          );
        }
      }, COOLDOWNS.LOVE_KIRA_WAIT),
    );
    return;
  }

  if (text.startsWith("/사신의눈 ")) {
    if (actor.key !== "Misa") return;
    if (isOnCooldown(room, actor, "eyes")) return;
    const chances = actor.skillUses.eyes || 0;
    if (chances <= 0 || (actor.flags.misaLifePoint as number) < 100) {
      sendPrivate(room, [actor.playerId], "[System] 사신의눈 사용 조건을 만족하지 못했습니다.");
      return;
    }
    actor.skillUses.eyes = chances - 1;
    actor.flags.misaLifePoint = (actor.flags.misaLifePoint as number) - 100;
    setCooldown(actor, "eyes", COOLDOWNS.ENVOY_EYES);
    const targetName = text.replace("/사신의눈 ", "").trim();
    const target = findAssignmentByName(room, targetName);
    if (!target) return;
    const successRate = chances === 4 ? 0.9 : chances === 3 ? 0.8 : chances === 2 ? 0.6 : 0.2;
    if (Math.random() < successRate) {
      sendPrivate(
        room,
        [actor.playerId],
        `${target.name}의 정체는 ${target.role}입니다. 남은포인트: ${actor.flags.misaLifePoint} / 남은횟수: ${actor.skillUses.eyes}회`,
      );
    } else {
      sendPrivate(
        room,
        [actor.playerId],
        `사신의눈 발동에 실패했습니다. 남은포인트: ${actor.flags.misaLifePoint} / 남은횟수: ${actor.skillUses.eyes}회`,
      );
    }
    return;
  }

  if (text.startsWith("/렘의노트 ")) {
    if (actor.key !== "Misa") return;
    if (isOnCooldown(room, actor, "rem")) return;
    if ((actor.flags.misaLifePoint as number) < 300) {
      sendPrivate(room, [actor.playerId], "[System] 포인트가 부족합니다.");
      return;
    }
    actor.flags.misaLifePoint = (actor.flags.misaLifePoint as number) - 300;
    setCooldown(actor, "rem", COOLDOWNS.REM_NOTE);
    const { roleLabel, playerName, cause } = parseRoleNameCause(text);
    const roleKey = roleLabel ? getRoleKeyByLabel(roleLabel) : null;
    const target = playerName ? findAssignmentByName(room, playerName) : null;
    if (
      target &&
      roleKey &&
      target.key === roleKey &&
      target.alive &&
      !(target.key === "N" && findAliveAssignmentByRole(room, "L"))
    ) {
      killPlayer(room, target, cause, "Misa", actor, "렘의노트");
    } else {
      sendPrivate(room, [actor.playerId], "아무 일도 일어나지 않았습니다.");
    }
    return;
  }

  if (text.startsWith("/정보수집 ")) {
    if (actor.key !== "Kiyomi") return;
    if (isOnCooldown(room, actor, "gather")) return;
    if (actor.flags.kiyomiSeal === false) {
      const { roleLabel } = parseRoleNameCause(text);
      if (["엘", "니아", "멜로"].includes(roleLabel)) {
        sendPrivate(room, [actor.playerId], "[System] 감시로 인해 해당 정보수집은 봉인되었습니다.");
        return;
      }
    }
    setCooldown(actor, "gather", COOLDOWNS.GATHERING_INFO);
    const { roleLabel, playerName } = parseRoleNameCause(text);
    const roleKey = roleLabel ? getRoleKeyByLabel(roleLabel) : null;
    const target = playerName ? findAssignmentByName(room, playerName) : null;
    if (target && roleKey && target.key === roleKey) {
      actor.skillUses.kiyomiBroadcast = (actor.skillUses.kiyomiBroadcast || 0) + 1;
      sendPrivate(room, [actor.playerId], `${target.name}의 정체는 ${target.role}(이)가 맞습니다.`);
    } else {
      sendPrivate(room, [actor.playerId], `해당 플레이어는 ${roleLabel} (이)가 아닙니다`);
    }
    return;
  }

  if (text === "/속옷노트") {
    if (actor.key !== "Kiyomi") return;
    if ((actor.skillUses.underwear || 0) <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 이미 사용한 스킬입니다.");
      return;
    }
    actor.skillUses.underwear = 0;
    actor.flags.underwearActive = true;
    sendPrivate(room, [actor.playerId], "속옷에 노트조각을 숨겼습니다.");
    schedule(
      room,
      setTimeout(() => {
        if (actor.flags.underwearActive) {
          actor.flags.underwearActive = false;
          sendPrivate(room, [actor.playerId], "속옷에 숨겨둔 노트조각이 분실되었습니다");
        }
      }, COOLDOWNS.UNDERWEAR_NOTE_DURATION),
    );
    return;
  }

  if (text.startsWith("/대신노트 ")) {
    if (actor.key !== "Mikami") return;
    if (isOnCooldown(room, actor, "substitute")) return;
    if ((actor.skillUses.substitute || 0) <= 0) {
      sendPrivate(room, [actor.playerId], "[System] 대신노트 횟수가 없습니다.");
      return;
    }
    actor.skillUses.substitute -= 1;
    setCooldown(actor, "substitute", COOLDOWNS.DESINNOTE_COOLDOWN);
    const { roleLabel, playerName, cause } = parseRoleNameCause(text);
    const roleKey = roleLabel ? getRoleKeyByLabel(roleLabel) : null;
    const target = playerName ? findAssignmentByName(room, playerName) : null;
    schedule(
      room,
      setTimeout(() => {
        if (
          actor.flags.mikamiSeal !== false &&
          target &&
          roleKey &&
          target.key === roleKey &&
          target.alive &&
          !(target.key === "N" && findAliveAssignmentByRole(room, "L"))
        ) {
          killPlayer(room, target, cause, "Mikami", actor, "대신노트");
        } else {
          sendPrivate(room, [actor.playerId], "아무 일도 일어나지 않았습니다.");
        }
        sendPrivate(room, [actor.playerId], `남은 노트횟수:${actor.skillUses.substitute}회`);
      }, COOLDOWNS.DEATHNOTE_KILL_DELAY),
    );
    return;
  }

  if (text === "/키라숭배") {
    if (actor.key !== "Mikami") return;
    if (isOnCooldown(room, actor, "worship")) return;
    setCooldown(actor, "worship", COOLDOWNS.WORSHIP_KIRA);
    schedule(
      room,
      setTimeout(() => {
        const targetKey = Math.random() < 0.5 ? "Kira" : "Kiyomi";
        const target = room.assignments.find((assignment) => assignment.key === targetKey);
        if (target) {
          sendPrivate(
            room,
            [actor.playerId],
            `${target.role}의 정체는 ${target.name}입니다.`,
          );
        }
      }, COOLDOWNS.WORSHIP_KIRA),
    );
    return;
  }

  sendPrivate(room, [actor.playerId], "[System] 알 수 없는 명령어입니다.");
}

function processInput(room: DNRoom, actor: DNAssignedRole, input: string) {
  const trimmed = input.trim();
  if (!trimmed) return;

  if (trimmed.startsWith("/")) {
    if (processCommonCommand(room, actor, trimmed)) {
      return;
    }
    processRoleCommand(room, actor, trimmed);
    return;
  }

  pushMessage(room, {
    type: "public",
    fromPlayerId: actor.playerId,
    text: `${actor.name}: ${trimmed}`,
  });
}

function startShinigamiMode(room: DNRoom) {
  if (room.mode !== "사신") return;
  sendSystem(room, "**[속보] 사신 류크가 따분해 합니다.**\\n90초마다 류크가 장난질을 시작합니다");

  schedule(
    room,
    setInterval(() => {
      if (room.phase !== "playing") return;

      const alive = room.assignments.filter((assignment) => assignment.alive);
      const randomValue = Math.random();

      if (randomValue >= 0.8) {
        const killCandidates = alive.filter((assignment) => {
          if (assignment.key === "Kira") return false;
          if (assignment.key === "L" && !findAliveAssignmentByRole(room, "N")) return false;
          if (assignment.key === "N" && !findAliveAssignmentByRole(room, "L")) return false;
          return true;
        });
        const target = killCandidates[Math.floor(Math.random() * killCandidates.length)];
        if (!target) return;
        sendSystem(room, `**[속보] 사신 류크에 의해 ${target.role}이(가) 사망했습니다.**`);
        killPlayer(room, target, "사신 류크", undefined, undefined, "사신 류크");
        return;
      }

      if (randomValue >= 0.4) {
        const target = alive[Math.floor(Math.random() * alive.length)];
        if (!target) return;
        sendSystem(
          room,
          `**[속보] 따분한 류크가 말하길 ${target.role}의 정체는 ${target.name} 입니다.**`,
        );
        return;
      }

      const target = alive[Math.floor(Math.random() * alive.length)];
      const fake = alive.find((assignment) => assignment.playerId !== target?.playerId);
      if (!target || !fake) return;
      sendSystem(
        room,
        `**[속보] 따분한 류크가 말하길 ${target.role}의 정체는 ${fake.name} 입니다.**`,
      );
    }, COOLDOWNS.SASIN_INTERVAL),
  );
}

function availableCommandsFor(assignment: DNAssignedRole | undefined, mode: DNGameMode) {
  if (!assignment) return [];
  if (mode === "바보") {
    return DEFAULT_COMMANDS;
  }

  const commands = [...DEFAULT_COMMANDS];
  switch (assignment.key) {
    case "L":
      return [...commands, "/체포 [이름]", "/방송 [메시지]", "/도청 [이름]"];
    case "N":
      return [...commands, "/체포 [이름]", "/방송 [메시지]", "/감시 [이름]"];
    case "M":
      return [...commands, "/납치 [이름]", "/노트조각 [역할] [이름] [사인]"];
    case "W":
      return [...commands, "/집사", "/와미즈하우스 [니아|멜로]"];
    case "Hal":
      return [...commands, "/연금 [이름]", "/수사관 [이름]"];
    case "Mogi":
      return [...commands, "/미행 [이름]", "/엘확인"];
    case "Mathuda":
      return [...commands, "/바보 [이름]"];
    case "Jebanni":
      return [...commands, "/바꿔치기 [이름]", "/추적 [이름]"];
    case "Kira":
      return [...commands, "/데스노트 [역할] [이름] [사인]", "/시계노트 [역할] [이름] [사인]"];
    case "Misa":
      return [...commands, "/연모", "/사신의눈 [이름]", "/렘의노트 [역할] [이름] [사인]"];
    case "Kiyomi":
      return [...commands, "/정보수집 [역할] [이름]", "/방송 [메시지]", "/속옷노트"];
    case "Mikami":
      return [...commands, "/대신노트 [역할] [이름] [사인]", "/키라숭배"];
    default:
      return commands;
  }
}

function buildState(room: DNRoom, playerId: string, sinceVersion: number): DNStateResponse {
  if (room.version <= sinceVersion) {
    return { changed: false, version: room.version };
  }

  const me = findAssignment(room, playerId);
  const hideRole = room.mode === "바보" && room.phase === "playing";

  return {
    changed: true,
    version: room.version,
    room: {
      id: room.id,
      name: room.name,
      phase: room.phase,
      mode: room.mode,
      hostId: room.hostId,
      statusText: room.statusText,
      startedAt: room.startedAt,
    },
    players: room.players.map((player) => {
      const assignment = findAssignment(room, player.id);
      return {
        id: player.id,
        name: player.name,
        mode: player.mode,
        alive: assignment?.alive ?? true,
        deathreason: assignment?.deathreason ?? "생존",
        connected: player.connected,
        revealedRole: room.phase === "result" ? assignment?.role : undefined,
      };
    }),
    myRole: me
      ? {
          key: me.key,
          role: me.role,
          team: me.team,
          explain: me.explain,
          img: me.img,
          alive: me.alive,
          deathreason: me.deathreason,
          whisper: me.whisper,
          note: me.note,
          mode: me.mode,
          hidden: hideRole,
          cooldowns: me.cooldowns,
          skillUses: me.skillUses,
          flags: me.flags,
        }
      : null,
    messages: visibleMessages(room, playerId),
    result: room.result,
    availableCommands: room.phase === "playing" ? availableCommandsFor(me, room.mode) : [],
  };
}

function roomSummary(room: DNRoom) {
  return {
    id: room.id,
    name: room.name,
    phase: room.phase,
    mode: room.mode,
    players: room.players.length,
    maxPlayers: DN_MAX_PLAYERS,
  };
}

function createRoom(name: string, hostName: string, mode: DNGameMode, playerMode: "이미지" | "텍스트") {
  const roomId = `dn-${generateId()}`;
  const hostId = generateId();
  const host: DNPlayerInfo = {
    id: hostId,
    name: hostName,
    mode: playerMode,
    joinedAt: now(),
    connected: true,
  };

  const room: DNRoom = {
    id: roomId,
    name: name || `데스노트-${roomId.slice(-4)}`,
    phase: "lobby",
    mode,
    hostId,
    createdAt: now(),
    updatedAt: now(),
    version: 1,
    players: [host],
    assignments: [],
    messages: [],
    result: null,
    statusText: "방장이 게임을 시작하면 역할이 배정됩니다.",
    startedAt: null,
    timers: [],
  };

  pushMessage(room, {
    type: "system",
    text: `데스노트 방이 생성되었습니다. 현재 모드: ${mode}`,
  });

  deathNoteRooms.set(room.id, room);
  return { room, hostId };
}

function startGame(room: DNRoom) {
  room.phase = "playing";
  room.startedAt = now();
  room.result = null;
  room.assignments = shuffleAndAssignRoles(room.players);
  room.statusText = `${room.mode} 모드 진행 중`;
  room.messages = [];
  room.version += 1;

  const roleLabels =
    room.mode === "바보"
      ? "바보모드에서는 공개되지 않습니다"
      : room.assignments.map((assignment) => assignment.role).join(", ");

  sendSystem(
    room,
    `**데스노트 게임을 시작합니다!!**\\n[게임 유형]\\n${room.mode} 모드\\n\\n[참여 플레이어의 이름]\\n${room.players
      .map((player) => player.name)
      .join(", ")}\\n\\n[게임 역할 N인]\\n${roleLabels}`,
  );

  room.assignments.forEach((assignment) => {
    if (room.mode === "바보") {
      sendPrivate(
        room,
        [assignment.playerId],
        "바보모드에서는 당신의 역할을 알려주지 않습니다",
      );
      return;
    }

    sendPrivate(
      room,
      [assignment.playerId],
      `당신의 역할은 ${assignment.role} 입니다.\\n\\n[보유 스킬]\\n${assignment.explain}`,
    );
  });

  startShinigamiMode(room);
}

export function registerDeathNoteRoutes(app: Hono) {
  app.get("/api/deathnote/rooms", (c) => {
    return c.json({
      rooms: Array.from(deathNoteRooms.values()).map(roomSummary),
      modes: DN_MODES,
    });
  });

  app.post("/api/deathnote/rooms", async (c) => {
    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    const roomName = String(body.roomName || "").trim();
    const mode = DN_MODES.includes(body.mode) ? body.mode : "일반";
    const playerMode = body.playerMode === "텍스트" ? "텍스트" : "이미지";

    if (!nickname) {
      return c.json({ error: "닉네임을 입력해주세요." }, 400);
    }

    const { room, hostId } = createRoom(roomName, nickname, mode, playerMode);
    return c.json({ roomId: room.id, playerId: hostId });
  });

  app.post("/api/deathnote/rooms/:roomId/join", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);

    const body = await c.req.json();
    const nickname = String(body.nickname || "").trim();
    const playerMode = body.playerMode === "텍스트" ? "텍스트" : "이미지";

    if (!nickname) return c.json({ error: "닉네임을 입력해주세요." }, 400);
    if (room.phase !== "lobby") return c.json({ error: "게임 진행 중에는 입장할 수 없습니다." }, 400);
    if (room.players.length >= DN_MAX_PLAYERS) return c.json({ error: "방이 가득 찼습니다." }, 400);

    const existing = room.players.find((player) => player.name === nickname);
    if (existing) return c.json({ error: "이미 사용 중인 닉네임입니다." }, 400);

    const playerId = generateId();
    room.players.push({
      id: playerId,
      name: nickname,
      mode: playerMode,
      joinedAt: now(),
      connected: true,
    });
    pushMessage(room, { type: "system", text: `${nickname}님이 방에 참가했습니다.` });
    return c.json({ roomId: room.id, playerId });
  });

  app.post("/api/deathnote/rooms/:roomId/leave", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const player = findPlayer(room, playerId);
    if (!player) return c.json({ success: true });

    room.players = room.players.filter((item) => item.id !== playerId);
    room.assignments = room.assignments.filter((item) => item.playerId !== playerId);
    if (room.hostId === playerId && room.players[0]) {
      room.hostId = room.players[0].id;
    }
    pushMessage(room, { type: "system", text: `${player.name}님이 방을 나갔습니다.` });
    if (room.players.length === 0) {
      clearAllTimers(room);
      deathNoteRooms.delete(room.id);
    }
    return c.json({ success: true });
  });

  app.post("/api/deathnote/rooms/:roomId/mode", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const mode = DN_MODES.includes(body.mode) ? body.mode : "일반";
    if (playerId !== room.hostId) return c.json({ error: "방장만 변경할 수 있습니다." }, 403);
    if (room.phase !== "lobby") return c.json({ error: "로비에서만 변경할 수 있습니다." }, 400);
    room.mode = mode;
    room.statusText = `${mode} 모드로 변경되었습니다.`;
    room.version += 1;
    return c.json({ success: true });
  });

  app.post("/api/deathnote/rooms/:roomId/start", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    if (playerId !== room.hostId) return c.json({ error: "방장만 시작할 수 있습니다." }, 403);
    if (room.players.length < DN_MIN_PLAYERS) {
      return c.json({ error: "데스노트 게임은 최소 3명이 필요합니다." }, 400);
    }

    startGame(room);
    return c.json({ success: true });
  });

  app.get("/api/deathnote/rooms/:roomId/state", (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const playerId = c.req.query("playerId") || "";
    const sinceVersion = Number(c.req.query("v") || "0");
    return c.json(buildState(room, playerId, sinceVersion));
  });

  app.post("/api/deathnote/rooms/:roomId/chat", async (c) => {
    const room = getRoom(c.req.param("roomId"));
    if (!room) return c.json({ error: "방을 찾을 수 없습니다." }, 404);
    const body = await c.req.json();
    const playerId = String(body.playerId || "");
    const nickname = String(body.nickname || "");
    const message = String(body.message || "");
    if (room.phase === "lobby") {
      const player =
        findPlayer(room, playerId) ||
        room.players.find((item) => item.name === nickname) ||
        (room.players.length === 1 ? room.players[0] : undefined);
      if (!player) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
      const trimmed = message.trim();
      if (!trimmed) return c.json({ success: true });
      pushMessage(room, {
        type: "public",
        fromPlayerId: player.id,
        text: `${player.name}: ${trimmed}`,
      });
      return c.json({ success: true });
    }

    const actor = findAssignment(room, playerId);
    if (!actor) return c.json({ error: "플레이어를 찾을 수 없습니다." }, 404);
    processInput(room, actor, message);
    return c.json({ success: true });
  });
}
