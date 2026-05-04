# LiarGame Azure 서버

## 개요
- 프로젝트: Azure Web App용 브라우저 기반 라이어 게임 서버
- 기술 스택: Hono + TypeScript + Node.js
- 런타임: 게임 API와 SPA UI를 동시에 제공하는 단일 Node 서버
- 현재 배포 버전: `Ver3.01`

## 실행 방법
```bash
npm install
npm run build
npm start
```

개발 모드:
```bash
npm run dev
```

## 빌드 및 출력
- 소스 진입점: `src/index.ts`
- 빌드 출력: `dist/index.js`
- TypeScript 설정: `tsconfig.json`

## 게임 목록
| 게임 | 경로 | 설명 |
|---|---|---|
| 라이어 게임 | `/` | 라이어를 찾아내는 단어 추론 게임 |
| 데스노트 | `/deathnote` | 역할 기반 커맨드 추리 게임 |
| 양세찬 게임 | `/yangsechan` | 프롬프트 배분 질문/답변 게임 |
| 캐치마인드 | `/catchmind` | 실시간 드로잉 정답 맞히기 게임 |
| 금지어 게임 | `/forbiddenword` | 단어 추론 및 금지어 회피 게임 |
| 스파이폴 | `/spyfall` | 스파이를 찾아내는 장소 추리 게임 |

---

## 라이어 게임

### 게임 흐름
1. 방 생성 또는 참가
2. 모든 플레이어 준비 완료 대기
3. 게임 시작 및 각 플레이어에게 단어 공개
4. 1차 발언 라운드
5. 자유 채팅
6. 연장 투표 및 2차 발언 라운드 (선택)
7. 최종 라이어 투표
8. 라이어 정답 추측 또는 결과 공개

### 게임 모드
#### 클래식 모드
- 라이어는 자신이 라이어임을 명시적으로 안내받음
- 라이어에게는 단어가 `???`로 표시됨

#### 풀 모드
- 라이어는 단어 공개 시 자신이 라이어임을 알지 못함
- 라이어는 실제 단어 대신 유사한 단어를 받음
- 라이어는 결과 흐름에서 뒤늦게 사실을 알게 됨

---

## 캐치마인드 게임

### 게임 개요
- 출제자(드로어)가 제시어를 그림으로 그리면, 나머지 플레이어들이 채팅으로 정답을 맞히는 실시간 드로잉 게임
- Socket.IO 기반 실시간 드로잉 동기화
- 라운드 수, 제한 시간, 최대 인원 등 방 설정 커스터마이징 가능

### 게임 흐름
1. 방 생성 또는 참가
2. 호스트가 라운드 수, 제한 시간 등 설정 조정
3. 모든 플레이어 준비 완료 후 호스트가 게임 시작
4. 턴 순서에 따라 출제자가 배정됨, 제시어는 출제자에게만 공개
5. 출제자는 캔버스에 그림을 그리고, 참가자들은 채팅으로 정답 입력
6. 정답을 맞히면 맞힌 플레이어와 출제자 모두 점수 획득
7. 제한 시간 초과 또는 모든 플레이어 정답 시 턴 종료
8. 모든 턴 완료 후 최종 점수 및 순위 공개

### 점수 체계
- 출제자(드로어): 누군가 정답을 맞힐 때마다 10점
- 정답자: 정답 맞히면 20점

### 방 설정
| 설정 | 기본값 | 최솟값 | 최댓값 |
|---|---|---|---|
| 최대 인원 | 6명 | 2명 | 10명 |
| 라운드 수 | 1 | 1 | 5 |
| 턴 제한 시간 | 120초 | 30초 | 180초 |

---

## 데스노트 게임

### 게임 개요
- 역할(탐정/범인/시민/사신)이 비밀리에 배정되는 추리 게임
- 커맨드 기반 스킬 시스템, 사신 타이머 이벤트 포함

---

## 양세찬 게임

### 게임 개요
- 각 플레이어가 프롬프트를 작성하면 무작위로 재배분
- 받은 프롬프트를 바탕으로 턴제 질문/답변 진행
- 게임/채팅/상태 탭으로 분리된 모바일 최적화 UI

---

## 최근 변경 사항 (Ver3.01)

### 캐치마인드 게임 추가
- `src/CatchMind/` 하위에 독립 캐치마인드 게임 모듈 추가
- 전용 라우트: `/catchmind`, `/api/catchmind/*`
- Socket.IO 기반 실시간 드로잉 이벤트 동기화 (`/catchmind` 네임스페이스)
- 단어 풀 JSON(`src/CatchMind/words.json`) 기반 제시어 자동 선택
- 정답 맞히기 채팅, 턴별 점수 집계, 최종 순위 공개 흐름 구현
- 출제자 순서 큐(derangement 방식), 턴 제한 시간 자동 종료, 연속 단어 중복 방지 적용

### 양세찬 게임
- `src/YangSeChan/` 하위에 독립 양세찬 게임 모듈 추가
- 전용 라우트: `/yangsechan`, `/api/yangsechan/*`
- 로비 준비/시작 흐름, 프롬프트 입력 타이머, derangement 프롬프트 재배분, 턴제 질문/답변 흐름, 관전자 전환, 리더보드 초기화 흐름 추가
- 양세찬 UI를 게임/채팅/상태 탭으로 분리 (모바일 최적화)
- 채팅 탭을 밀도 높은 텍스트 스타일로 변경해 더 많은 대화가 보이도록 개선
- 프롬프트 제출 후 UI가 제출 완료 상태로 변경됨 (비활성 상태처럼 보이지 않도록 수정)
- 메인 턴 중 현재 플레이어에게는 자신의 대상 프롬프트가 보이지 않고 다른 플레이어의 프롬프트만 표시
- 답변 패널에 질문자 닉네임과 프롬프트가 함께 표시됨

### 데스노트 게임
- `src/DeathNote/` 하위에 독립 데스노트 게임 모듈 추가
- 전용 라우트: `/deathnote`, `/api/deathnote/*`
- 독립적인 데스노트 방 생명주기, 역할 배정, 커맨드 기반 스킬 시스템, 결과 흐름, 사신 모드 타이머 이벤트 추가
- 기존 라이어 게임 흐름(`/` 및 `/api/rooms/*`)은 그대로 유지

### 게임 모드
- 방 단위 게임 모드 선택 기능 추가
- `classic` 및 `fool` 모드 추가
- 호스트가 `waiting` 상태에서 게임 모드 변경 가능

### 방 제어
- 게임 시작 전 호스트가 플레이어 강퇴 기능 추가
- 강퇴는 `waiting` 단계에서만 가능

### 채팅 UI
- 발언 요약 중복 노출 감소
- 모바일 채팅 탭에서 발언 요약 숨김 (채팅이 주 영역이 됨)
- 모바일 채팅 영역 하단 간격 증가 (입력창/탭 영역 겹침 감소)
- 투표 단계 시작 시 모바일에서 자동으로 게임 탭으로 전환

### 라운드 타임아웃
- 현재 발언자가 제한 시간 내 발언을 제출하지 않으면 자동 스킵
- 연장 투표 및 최종 투표 단계는 60초 후 자동 종료
- 미투표자는 기권 처리, 현재 제출된 투표로 단계 해소
- 최종 투표가 동점이거나 비어있으면 라이어 생존으로 처리

### 단어 공개 안정성
- 일부 스마트폰에서 단어 영역이 비어 보이는 현상 방어 처리 추가
- 공개된 단어 영역에 최소 높이 및 안전한 줄바꿈 규칙 적용
- 풀 모드 역할 숨김 동작 유지하면서 표시 텍스트 안정화

---

## 헬스 체크
헬스 체크 엔드포인트:
```http
GET /health
```

응답 예시:
```json
{
  "ok": true,
  "version": "Ver3.01",
  "timestamp": 1713340000000
}
```

Azure 워밍업, 가용성 확인, 배포 버전 검증에 사용됩니다.

---

## 주요 API

### 라이어 게임
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/` | 메인 SPA 제공 |
| GET | `/health` | 배포 버전 포함 헬스 체크 |
| GET | `/api/rooms` | 방 목록 조회 |
| POST | `/api/rooms` | 방 생성 |
| POST | `/api/rooms/:id/join` | 방 참가 |
| POST | `/api/rooms/:id/leave` | 방 퇴장 |
| POST | `/api/rooms/:id/ready` | 준비 토글 |
| POST | `/api/rooms/:id/start` | 게임 시작 |
| POST | `/api/rooms/:id/confirm-word` | 단어 확인 |
| POST | `/api/rooms/:id/speak` | 발언 제출 |
| POST | `/api/rooms/:id/chat` | 채팅 전송 |
| POST | `/api/rooms/:id/end-free-chat` | 자유 채팅 종료 |
| POST | `/api/rooms/:id/vote-extend` | 연장 투표 |
| POST | `/api/rooms/:id/vote` | 최종 라이어 투표 |
| POST | `/api/rooms/:id/liar-guess` | 라이어 최종 추측 |
| POST | `/api/rooms/:id/new-game` | 대기 상태로 초기화 |
| POST | `/api/rooms/:id/category` | 카테고리 변경 |
| POST | `/api/rooms/:id/game-mode` | 게임 모드 변경 |
| POST | `/api/rooms/:id/kick` | 게임 시작 전 플레이어 강퇴 |
| GET | `/api/rooms/:id/state` | 방 상태 폴링 |

### 데스노트
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/deathnote` | 데스노트 게임 페이지 제공 |
| GET | `/api/deathnote/rooms` | 데스노트 방 목록 조회 |
| POST | `/api/deathnote/rooms` | 데스노트 방 생성 |
| POST | `/api/deathnote/rooms/:id/join` | 데스노트 방 참가 |
| POST | `/api/deathnote/rooms/:id/leave` | 데스노트 방 퇴장 |
| POST | `/api/deathnote/rooms/:id/mode` | 데스노트 모드 변경 |
| POST | `/api/deathnote/rooms/:id/start` | 데스노트 게임 시작 |
| GET | `/api/deathnote/rooms/:id/state` | 데스노트 방 상태 폴링 |
| POST | `/api/deathnote/rooms/:id/chat` | 데스노트 채팅 또는 커맨드 전송 |

### 양세찬 게임
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/yangsechan` | 양세찬 게임 페이지 제공 |
| GET | `/api/yangsechan/rooms` | 양세찬 방 목록 조회 |
| POST | `/api/yangsechan/rooms` | 양세찬 방 생성 |
| POST | `/api/yangsechan/rooms/:id/join` | 양세찬 방 참가 |
| POST | `/api/yangsechan/rooms/:id/leave` | 양세찬 방 퇴장 |
| POST | `/api/yangsechan/rooms/:id/ready` | 양세찬 준비 토글 |
| POST | `/api/yangsechan/rooms/:id/start` | 양세찬 게임 시작 |
| POST | `/api/yangsechan/rooms/:id/prompt` | 양세찬 프롬프트 제출 |
| POST | `/api/yangsechan/rooms/:id/question` | 양세찬 질문 전송 |
| POST | `/api/yangsechan/rooms/:id/answer` | 양세찬 답변 제출 |
| POST | `/api/yangsechan/rooms/:id/guess` | 양세찬 정답 시도 |
| POST | `/api/yangsechan/rooms/:id/chat` | 양세찬 자유 채팅 |
| GET | `/api/yangsechan/rooms/:id/state` | 양세찬 방 상태 폴링 |

### 캐치마인드
| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/catchmind` | 캐치마인드 게임 페이지 제공 |
| GET | `/api/catchmind/rooms` | 캐치마인드 방 목록 조회 |
| POST | `/api/catchmind/rooms` | 캐치마인드 방 생성 |
| POST | `/api/catchmind/rooms/:roomId/join` | 캐치마인드 방 참가 |
| POST | `/api/catchmind/rooms/:roomId/leave` | 캐치마인드 방 퇴장 |
| POST | `/api/catchmind/rooms/:roomId/ready` | 캐치마인드 준비 토글 |
| POST | `/api/catchmind/rooms/:roomId/settings` | 방 설정 변경 (라운드 수, 제한 시간 등) |
| POST | `/api/catchmind/rooms/:roomId/start` | 캐치마인드 게임 시작 |
| GET | `/api/catchmind/rooms/:roomId/state` | 캐치마인드 방 상태 폴링 |

> 드로잉 이벤트 및 채팅은 Socket.IO `/catchmind` 네임스페이스를 통해 실시간으로 처리됩니다.

---

## Azure 관련 사항
- 서버는 `process.env.PORT`에서 수신 대기
- 게임 상태는 메모리에 저장되므로 스케일아웃 또는 재시작 시 활성 방이 초기화됨
- 안정적인 동작을 위해 상태 저장소를 외부화하지 않는 한 단일 인스턴스로 배포 권장
