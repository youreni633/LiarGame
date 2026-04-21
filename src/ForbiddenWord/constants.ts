import type { FWPhase } from "./types.js";

export const FW_MIN_PLAYERS = 2;
export const FW_MAX_PLAYERS = 10;
export const FW_ASSIGNMENT_DURATION_MS = 3 * 60 * 1000;
export const FW_RESULT_DURATION_MS = 6 * 1000;

export const FW_DEFAULT_WORDS = [
  "사과",
  "축구공",
  "지하철",
  "연필",
  "바다",
  "고양이",
  "비행기",
  "학교",
  "모자",
  "안경",
  "컴퓨터",
  "김치",
  "라면",
  "커피",
  "도서관",
  "눈사람",
  "강아지",
  "자동차",
  "캠핑",
  "소풍",
  "번개",
  "무지개",
  "노트북",
  "피자",
  "거울",
  "우산",
  "시계",
  "침대",
  "영화관",
  "박물관",
];

export const FW_STATUS_BY_PHASE: Record<FWPhase, string> = {
  lobby: "모든 인원이 준비를 마치면 방장이 게임을 시작할 수 있습니다.",
  assignment:
    "각자 지정된 타겟에게 넣을 금지어를 입력하세요. 3분이 지나면 서버가 기본 단어를 자동 배정합니다.",
  playing:
    "채팅으로 자유롭게 대화하세요. 단, 본인 금지어를 말하면 즉시 OUT 됩니다.",
  result: "최후의 1인이 승리했습니다. 잠시 후 로비로 돌아갑니다.",
};
