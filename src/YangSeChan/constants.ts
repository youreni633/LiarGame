export const YS_MIN_PLAYERS = 2;
export const YS_MAX_PLAYERS = 10;
export const YS_PROMPT_INPUT_DURATION_MS = 3 * 60 * 1000;

export const YS_DEFAULT_WORDS = [
  "사과",
  "축구공",
  "지하철",
  "냉장고",
  "고양이",
  "우산",
  "치킨",
  "연필",
  "하모니카",
  "한강",
  "키보드",
  "드론",
  "커피",
  "불꽃놀이",
  "도서관",
  "비행기",
  "오징어",
  "마라탕",
  "베개",
  "에스컬레이터",
  "풍선",
  "장미",
  "피아노",
  "호랑이",
  "공룡",
  "삼겹살",
  "노트북",
  "해바라기",
  "모래성",
  "스케이트",
];

export const YS_STATUS_BY_PHASE: Record<string, string> = {
  lobby: "모든 인원이 준비를 누르면 방장이 게임을 시작할 수 있습니다.",
  prompt_input: "3분 안에 각자 제시어를 입력하세요. 미입력자는 기본 단어풀에서 자동 배정됩니다.",
  turn: "현재 턴인 사람은 질문 또는 정답 시도를 진행하세요.",
};
