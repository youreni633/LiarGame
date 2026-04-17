import type { Room } from "./types.js";

type TransitionDeps = {
  generateId: () => string;
  shuffleArray: <T>(array: T[]) => T[];
};

function startFinalVote(room: Room, deps: TransitionDeps) {
  room.phase = "final_vote";
  room.phaseStartTime = Date.now();
  room.votes = [];
  room.messages.push({
    id: deps.generateId(),
    playerId: "system",
    nickname: "시스템",
    message:
      "🗳️ 최종 투표를 시작합니다! 라이어라고 생각하는 사람을 지목해주세요.",
    timestamp: Date.now(),
    type: "system",
  });
}

function startSecondSpeakingRound(room: Room, deps: TransitionDeps) {
  room.phase = "speaking2";
  room.roundNumber = 2;
  room.speakingOrder = deps.shuffleArray(room.players.map((p) => p.id));
  room.currentSpeakerIndex = 0;
  room.currentSpeakerStartTime = Date.now();
  room.phaseStartTime = Date.now();

  const firstSpeaker = room.players.find((p) => p.id === room.speakingOrder[0]);
  room.messages.push({
    id: deps.generateId(),
    playerId: "system",
    nickname: "시스템",
    message: `🔄 추가 토론이 결정되었습니다! 첫 번째 발언자는 ${firstSpeaker?.nickname}`,
    timestamp: Date.now(),
    type: "system",
  });
}

export function advanceSpeakingTurn(
  room: Room,
  deps: TransitionDeps,
  skipped = false,
) {
  const currentSpeakerId = room.speakingOrder[room.currentSpeakerIndex];
  const currentSpeaker = room.players.find((p) => p.id === currentSpeakerId);

  if (skipped && currentSpeaker) {
    room.messages.push({
      id: deps.generateId(),
      playerId: "system",
      nickname: "시스템",
      message: `⏰ ${currentSpeaker.nickname}님의 발언 시간이 종료되어 다음 차례로 넘어갑니다.`,
      timestamp: Date.now(),
      type: "system",
    });
  }

  room.currentSpeakerIndex++;
  room.version++;
  room.lastActivity = Date.now();

  if (room.currentSpeakerIndex >= room.speakingOrder.length) {
    if (room.phase === "speaking") {
      room.phase = "free_chat";
      room.phaseStartTime = Date.now();
      room.messages.push({
        id: deps.generateId(),
        playerId: "system",
        nickname: "시스템",
        message: `💬 자유 토론 시간입니다! (${room.freeChatDuration / 60}분)`,
        timestamp: Date.now(),
        type: "system",
      });
    } else {
      startFinalVote(room, deps);
    }
    room.version++;
    return;
  }

  const nextSpeaker = room.players.find(
    (p) => p.id === room.speakingOrder[room.currentSpeakerIndex],
  );
  room.currentSpeakerStartTime = Date.now();
  room.messages.push({
    id: deps.generateId(),
    playerId: "system",
    nickname: "시스템",
    message: `🎤 다음 발언자는 ${nextSpeaker?.nickname}`,
    timestamp: Date.now(),
    type: "system",
  });
}

export function resolveExtendVote(
  room: Room,
  deps: TransitionDeps,
  timedOut = false,
) {
  const yesCount = room.extendVotes.filter((v) => v.extend).length;
  const noCount = room.extendVotes.filter((v) => !v.extend).length;

  if (timedOut) {
    room.messages.push({
      id: deps.generateId(),
      playerId: "system",
      nickname: "시스템",
      message:
        "⏰ 추가 토론 투표 시간이 종료되었습니다. 현재까지의 투표로 결과를 계산합니다.",
      timestamp: Date.now(),
      type: "system",
    });
  }

  if (yesCount > noCount) {
    startSecondSpeakingRound(room, deps);
  } else {
    startFinalVote(room, deps);
  }
  room.version++;
  room.lastActivity = Date.now();
}

export function resolveFinalVote(
  room: Room,
  deps: TransitionDeps,
  timedOut = false,
) {
  const voteCounts: Record<string, number> = {};
  room.votes.forEach((v) => {
    voteCounts[v.targetId] = (voteCounts[v.targetId] || 0) + 1;
  });

  if (timedOut) {
    room.messages.push({
      id: deps.generateId(),
      playerId: "system",
      nickname: "시스템",
      message:
        "⏰ 최종 투표 시간이 종료되었습니다. 현재까지의 투표로 결과를 계산합니다.",
      timestamp: Date.now(),
      type: "system",
    });
  }

  let maxVotes = 0;
  let mostVotedId = "";
  let isTie = false;
  Object.entries(voteCounts).forEach(([id, count]) => {
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedId = id;
      isTie = false;
    } else if (count === maxVotes && count > 0) {
      isTie = true;
    }
  });

  const mostVotedPlayer = room.players.find((p) => p.id === mostVotedId);

  if (!mostVotedId || isTie) {
    const liarPlayer = room.players.find((p) => p.id === room.liarId);
    room.phase = "result";
    room.phaseStartTime = Date.now();
    room.messages.push({
      id: deps.generateId(),
      playerId: "system",
      nickname: "시스템",
      message: `🤷 투표가 없거나 동점이 발생했습니다. 라이어 ${liarPlayer?.nickname}님이 살아남아 승리했습니다!`,
      timestamp: Date.now(),
      type: "system",
    });
    room.version++;
    room.lastActivity = Date.now();
    return;
  }

  if (mostVotedId === room.liarId) {
    room.phase = "liar_guess";
    room.phaseStartTime = Date.now();
    room.messages.push({
      id: deps.generateId(),
      playerId: "system",
      nickname: "시스템",
      message: `🎯 ${mostVotedPlayer?.nickname}님이 지목되었습니다! 라이어입니다! 하지만 제시어를 맞추면 라이어의 승리!`,
      timestamp: Date.now(),
      type: "system",
    });
  } else {
    const liarPlayer = room.players.find((p) => p.id === room.liarId);
    room.phase = "result";
    room.phaseStartTime = Date.now();
    room.messages.push({
      id: deps.generateId(),
      playerId: "system",
      nickname: "시스템",
      message: `❌ ${mostVotedPlayer?.nickname}님이 지목되었지만 라이어가 아닙니다! 라이어는 ${liarPlayer?.nickname}님이었습니다. 🎉 라이어 승리!`,
      timestamp: Date.now(),
      type: "system",
    });
  }

  room.version++;
  room.lastActivity = Date.now();
}
