# LiarGame 프로젝트 구조 및 신규게임 확장 분석

> 분석 기준일: 2026-07-21
> 대상 브랜치: `azure-migration`
> 목적: 신규게임 **삼단오목**을 추가하기 전에 현재 프로젝트의 사용자 식별, 게임 선택, 로비, 방 상태, 게임 진행, 결과 처리 구조를 코드 기준으로 파악한다.

## 1. 핵심 결론

이 프로젝트는 하나의 공통 게임 엔진 위에 모든 게임을 얹은 구조가 아니다. 다음과 같은 **게임별 독립 모듈 구조**다.

- 서버 진입점은 [`src/index.ts`](../src/index.ts)다.
- 루트 경로 `/`는 기본 LiarGame의 로비이면서 다른 게임 페이지로 이동하는 게임 선택 허브 역할을 한다.
- DeathNote, YangSeChan, ForbiddenWord, Spyfall, CatchMind는 각자 `types.ts`, `constants.ts`, `engine.ts` 또는 게임 엔진 파일, `html.ts`, `index.ts`를 가진다.
- 각 게임은 자체 `Map<roomId, Room>`에 방을 저장한다. 공통 DB나 공통 `Room` 상속 구조는 없다.
- 대부분의 게임은 REST API로 명령을 받고, `version`을 이용한 폴링으로 상태를 내려준다.
- CatchMind만 Socket.IO 네임스페이스 `/catchmind`를 사용해 그림과 채팅을 실시간 전달한다.
- 사용자 인증은 없다. 닉네임과 서버가 발급한 `playerId`를 브라우저 `localStorage`와 요청 본문/쿼리로 전달하는 세션 방식이다.
- 모든 게임 상태는 메모리에만 있으므로 프로세스 재시작 또는 다중 인스턴스 분산 시 방 상태가 유지되지 않는다.

삼단오목은 다음 구조로 추가하는 것이 기존 설계와 가장 잘 맞는다.

```text
src/ThreeMok/
  constants.ts       # 인원, 보드 크기, 시간 제한, 상태 문구
  types.ts           # Player, Room, Phase, Move, Result
  engine.ts          # Map, 상태 전이, API 등록
  html.ts            # 독립 로비/게임 화면과 브라우저 클라이언트
  index.ts           # engine/html export
```

그 뒤 [`src/index.ts`](../src/index.ts)에 다음 세 곳을 연결한다.

1. 모듈 import 및 `registerThreeMokRoutes(app)` 호출
2. `GET /threemok` 페이지 라우트
3. 루트 게임 선택 영역의 삼단오목 링크

## 2. 애플리케이션 실행 구조

### 2.1 실행 및 빌드

| 항목 | 구현 |
|---|---|
| 런타임 | Node.js `>=22` |
| 언어 | TypeScript, ES2022 |
| HTTP 프레임워크 | Hono |
| Node 어댑터 | `@hono/node-server` |
| 실시간 통신 | Socket.IO `4.8.3` |
| 개발 실행 | `npm run dev` → `tsx watch src/index.ts` |
| 빌드 | `npm run build` → `tsc` 후 CatchMind 정적 자산 복사 |
| 운영 실행 | `npm start` → `node dist/index.js` |
| 진입점 | [`src/index.ts:1-41`](../src/index.ts#L1-L41) |
| 서버 생성 | [`src/index.ts:4949-4964`](../src/index.ts#L4949-L4964) |

`tsconfig.json`은 `src/**/*.ts`를 컴파일해 `dist`로 출력한다. 삼단오목 모듈을 `src` 아래에 추가하면 별도 빌드 설정 변경 없이 컴파일 대상에 포함된다.

### 2.2 서버 부트스트랩

[`src/index.ts:1413-1427`](../src/index.ts#L1413-L1427)에서 Hono 앱을 만들고 `/api/*`에 CORS를 적용한다. 이후 게임별 API 등록 함수를 호출하고 `/static/*` 정적 파일과 `/health`를 등록한다.

```text
Hono app
 ├─ /api/* CORS
 ├─ 게임별 register...Routes(app)
 ├─ /static/* → public/
 ├─ /health
 ├─ /          → getMainHTML()          # LiarGame 로비/게임
 ├─ /deathnote  → getDeathNoteHTML()
 ├─ /yangsechan → getYangSeChanHTML()
 ├─ /forbidden-word → getForbiddenWordHTML()
 ├─ /spyfall    → getSpyfallHTML()
 └─ /catchmind  → getCatchMindHTML()
```

현재 CatchMind Socket.IO 등록은 HTTP 서버 생성 뒤 [`src/index.ts:4953-4960`](../src/index.ts#L4953-L4960)에서 별도로 수행한다. 삼단오목이 폴링 방식이면 이 연결은 필요 없다. 돌 놓기처럼 저지연 동기화가 필요할 때만 별도 Socket.IO 네임스페이스를 선택한다.

### 2.3 상태 저장소와 수명

기본 LiarGame은 [`src/index.ts:1159-1164`](../src/index.ts#L1159-L1164)의 전역 `rooms`와 `playerSessions`를 사용한다. 나머지 게임은 각 엔진 파일 내부의 전용 `Map`을 사용한다. 예를 들어 YangSeChan은 [`src/YangSeChan/engine.ts:16-16`](../src/YangSeChan/engine.ts#L16), ForbiddenWord는 [`src/ForbiddenWord/engine.ts:12-12`](../src/ForbiddenWord/engine.ts#L12)에서 방 저장소를 선언한다.

기본 LiarGame은 플레이어 `lastSeen`을 확인해 60초 동안 보이지 않은 플레이어를 제거하고, 빈 방 또는 10분 비활성 방을 삭제한다([`src/index.ts:1170-1186`](../src/index.ts#L1170-L1186)). 모듈형 게임은 게임별 정리 정책을 가진다. 예를 들어 CatchMind는 30분 이상 오래된 방을 정리한다([`src/CatchMind/catchmind_game.ts:711-719`](../src/CatchMind/catchmind_game.ts#L711-L719)).

따라서 삼단오목도 방 생성 시 다음을 반드시 설계해야 한다.

- 방 삭제 기준과 타이머 정리
- 접속 끊김 시 플레이어 처리
- 방장이 나갔을 때 새 방장 승계 여부
- 게임 중 인원 부족 시 게임 중단 또는 관전 전환 여부
- 결과 화면에서 로비로 돌아가는 방식

## 3. 사용자와 세션 구조

### 3.1 사용자 진입

공통 계정 가입/로그인/토큰 발급은 없다. 각 게임의 HTML 클라이언트가 닉네임과 게임별 방 세션을 `localStorage`에 보관한다.

| 게임 | localStorage 키 |
|---|---|
| LiarGame | `liar_nickname`, `liar_playerId`, `liar_roomId` |
| DeathNote | `dn:nickname`, `dn:playerMode`, `dn:playerId`, `dn:roomId` |
| YangSeChan | `ys:nickname`, `ys:roomId`, `ys:playerId` |
| ForbiddenWord | `fw:nickname`, `fw:playerId`, `fw:roomId` |
| Spyfall | `sf:nickname`, `sf:roomId`, `sf:playerId` |
| CatchMind | `cm:nickname`, `cm:roomId`, `cm:playerId` |

근거: 각 HTML의 클라이언트 상태 초기화와 저장 로직([`DeathNote/html.ts:363-366`](../src/DeathNote/html.ts#L363-L366), [`YangSeChan/html.ts:332-334`](../src/YangSeChan/html.ts#L332-L334), [`ForbiddenWord/html.ts:304-306`](../src/ForbiddenWord/html.ts#L304-L306), [`Spyfall/html.ts:158-158`](../src/Spyfall/html.ts#L158-L158), [`CatchMind/html.ts:843-845`](../src/CatchMind/html.ts#L843-L845), [`src/index.ts:3727-3730`](../src/index.ts#L3727-L3730)).

### 3.2 서버 식별

방을 만들거나 참가할 때 서버가 `roomId`와 `playerId`를 생성해 반환한다. 이후 요청은 대체로 다음 중 하나로 플레이어를 식별한다.

- POST body의 `playerId`
- GET query의 `playerId`
- CatchMind Socket.IO 연결의 `roomId`와 `playerId`

기본 LiarGame은 방 생성/참가 시 `playerSessions`에도 세션을 기록하지만, 실제 대부분의 권한 검사는 방 안의 플레이어와 `room.hostId`를 직접 비교한다([`src/index.ts:1504-1507`](../src/index.ts#L1504-L1507), [`src/index.ts:1661-1673`](../src/index.ts#L1661-L1673)). 즉, 현재 구조는 인증 시스템이 아니라 **방 membership 기반 식별**이다.

신규 삼단오목에서도 최소한 다음 검사를 API마다 수행해야 한다.

1. 방이 존재하는가
2. 해당 `playerId`가 방의 플레이어인가
3. 현재 phase에서 허용되는 명령인가
4. 방장 전용 명령이면 `playerId === room.hostId`인가
5. 자기 차례/자기 돌/유효한 칸인지

## 4. 게임 선택과 페이지 라우팅

### 4.1 현재 게임 선택 방식

루트 `/`는 별도의 게임 목록 API를 호출하는 통합 선택 화면이 아니다. `getMainHTML()` 안에 다른 게임의 정적 링크가 있고, 사용자는 링크를 클릭해 각 게임의 독립 페이지로 이동한다([`src/index.ts:3566-3579`](../src/index.ts#L3566-L3579)).

현재 선택 링크는 다음과 같다.

| 표시 위치 | 페이지 | API prefix | 구현 모듈 |
|---|---|---|---|
| 루트 기본 화면 | `/` | `/api/rooms` | `src/index.ts` + `src/LiarGame/*` |
| 데스노트 | `/deathnote` | `/api/deathnote/rooms` | `src/DeathNote/*` |
| 양세찬 게임 | `/yangsechan` | `/api/yangsechan/rooms` | `src/YangSeChan/*` |
| 금지어 | `/forbidden-word` | `/api/forbidden-word/rooms` | `src/ForbiddenWord/*` |
| 스파이폴 | `/spyfall` | `/api/spyfall/rooms` | `src/Spyfall/*` |
| 캐치마인드 | `/catchmind` | `/api/catchmind/rooms` | `src/CatchMind/*` |

페이지 라우트는 [`src/index.ts:2313-2331`](../src/index.ts#L2313-L2331), 모듈 API 등록은 [`src/index.ts:1413-1419`](../src/index.ts#L1413-L1419)에 있다.

### 4.2 삼단오목 추가 시 게임 선택 연결

삼단오목을 루트 선택 화면에서 노출하려면 다음을 함께 처리해야 한다.

```text
src/ThreeMok/index.ts
  ├─ export registerThreeMokRoutes
  └─ export getThreeMokHTML

src/index.ts
  ├─ import { getThreeMokHTML, registerThreeMokRoutes } ...
  ├─ registerThreeMokRoutes(app)
  ├─ app.get("/threemok", ...)
  └─ getMainHTML() 내부에 <a href="/threemok">...</a>
```

루트 링크만 추가하고 API/페이지 라우트를 빠뜨리면 선택 화면에서는 보이지만 게임 페이지가 동작하지 않는다. 반대로 API만 추가하면 직접 URL을 아는 사용자만 접근할 수 있다.

## 5. 공통 사용자 흐름

게임별 UI는 다르지만 전체 흐름은 다음 패턴을 공유한다.

```text
페이지 진입
  ↓
닉네임 입력/복원
  ↓
게임별 방 목록 조회
  ├─ 방 만들기 → POST /api/{game}/rooms → roomId + playerId
  └─ 방 참가   → POST /api/{game}/rooms/:roomId/join → roomId + playerId
  ↓
게임 화면 전환 + 상태 동기화 시작
  ↓
로비
  ├─ 플레이어 목록
  ├─ 준비 토글
  ├─ 방장 설정
  └─ 방장 게임 시작
  ↓
게임 phase 전이
  ↓
결과
  ↓
로비 복귀 또는 방장 재시작
```

기본 LiarGame의 화면 전환과 세션 저장은 [`src/index.ts:3804-3845`](../src/index.ts#L3804-L3845), 방 목록·방 만들기·방 참가 흐름은 [`src/index.ts:3850-3945`](../src/index.ts#L3850-L3945)에 구현되어 있다. 게임별 페이지도 같은 흐름을 각자 복제한다.

## 6. 기본 LiarGame 상세 흐름

기본 게임은 다른 게임과 달리 별도 폴더 엔진이 아니라 [`src/index.ts`](../src/index.ts)에 서버 API와 HTML 클라이언트가 함께 들어 있다. 서버 상태 타입은 [`src/LiarGame/types.ts:1-64`](../src/LiarGame/types.ts#L1-L64), phase 전이 일부는 [`src/LiarGame/phaseTransitions.ts:42-208`](../src/LiarGame/phaseTransitions.ts#L42-L208)로 분리되어 있다.

### 6.1 방 만들기/참가/로비

- `GET /api/rooms`: 방 목록을 반환한다. 방 이름, 방장 닉네임, 인원, 정원, phase, category를 내려준다([`src/index.ts:1431-1444`](../src/index.ts#L1431-L1444)).
- `POST /api/rooms`: 닉네임과 방 이름을 받아 방장 플레이어를 즉시 생성한다. 방장은 항상 준비 상태이며 기본 정원은 4명, 범위는 3~10명이다([`src/index.ts:1447-1507`](../src/index.ts#L1447-L1507)).
- `POST /api/rooms/:roomId/join`: `waiting` phase, 정원, 닉네임 중복을 검사하고 참가자를 추가한다([`src/index.ts:1511-1549`](../src/index.ts#L1511-L1549)).
- `POST /api/rooms/:roomId/ready`: 방장을 제외한 참가자의 준비 상태를 토글한다([`src/index.ts:1637-1657`](../src/index.ts#L1637-L1657)).
- `POST /api/rooms/:roomId/kick`: 대기 중에 방장만 다른 플레이어를 강퇴할 수 있다([`src/index.ts:1597-1635`](../src/index.ts#L1597-L1635)).

### 6.2 게임 시작과 비밀 정보 배정

방장은 최소 3명이고 모든 비방장이 준비해야 시작할 수 있다. 시작 시 서버가 카테고리에서 실제 단어와 유사 단어를 고르고, 무작위로 라이어를 배정한다([`src/index.ts:1660-1708`](../src/index.ts#L1660-L1708)).

게임 모드별 라이어 정보는 다음과 같다.

| 모드 | 일반 플레이어 | 라이어 |
|---|---|---|
| `classic` | 실제 단어 | `???` |
| `fool` | 실제 단어 | 유사 단어 |

### 6.3 phase 전이

```text
waiting
  → word_reveal       # 단어 배정 및 공개
  → speaking          # 전원 확인 후 1차 발언
  → free_chat         # 1차 발언 종료
  → vote_extend       # 자유토론 종료 또는 타임아웃
  ├─ 찬성 우세 → speaking2 → final_vote
  └─ 그 외     → final_vote
  ├─ 라이어 지목 실패 → result
  ├─ 라이어 지목 성공 → liar_guess
  │                         ├─ 단어 적중 → result
  │                         └─ 단어 실패 → result
  └─ 동률/무투표 → result, 라이어 승리
```

주요 서버 동작:

- 단어 확인: 전원이 `confirm-word`를 호출하면 `speaking`으로 전환([`src/index.ts:1722-1760`](../src/index.ts#L1722-L1760)).
- 발언: 현재 발언자만 `speak`할 수 있다. 발언 순서가 끝나면 자유토론 또는 최종 투표로 간다([`src/index.ts:1763-1843`](../src/index.ts#L1763-L1843)).
- 자유토론 종료: `free_chat`에서 `vote_extend`로 전환([`src/index.ts:1877-1904`](../src/index.ts#L1877-L1904)).
- 연장 투표: 찬성이 반대보다 많을 때만 2차 발언으로 전환한다([`src/LiarGame/phaseTransitions.ts:98-125`](../src/LiarGame/phaseTransitions.ts#L98-L125)).
- 최종 투표: 최다 득표자가 라이어면 `liar_guess`, 아니면 즉시 `result`다([`src/LiarGame/phaseTransitions.ts:127-208`](../src/LiarGame/phaseTransitions.ts#L127-L208)).
- 타임아웃: 상태 조회 요청 안에서 자유토론, 발언, 연장 투표, 최종 투표의 타이머를 검사해 자동 전이한다([`src/index.ts:2176-2217`](../src/index.ts#L2176-L2217)).
- 새 게임: 방장만 `result`에서 `waiting`으로 되돌릴 수 있다([`src/index.ts:2082-2122`](../src/index.ts#L2082-L2122)).

### 6.4 상태 폴링과 비밀 정보 노출

기본 LiarGame 클라이언트는 1초마다 `/api/rooms/:roomId/state?playerId=...&v=...`를 호출한다([`src/index.ts:3985-4027`](../src/index.ts#L3985-L4027)). 서버는 `version`이 바뀌지 않았으면 `{ changed: false }`만 반환한다.

서버는 모든 방 내부 상태를 그대로 내려주지 않고 플레이어별 공개 상태를 만든다([`src/index.ts:2161-2291`](../src/index.ts#L2161-L2291)).

- `myWord`: 요청한 플레이어의 단어만 반환
- `isLiar`: `classic`에서는 일부 phase 이후, `liar_guess`/`result`에서는 공개
- `liarId`, 실제 단어, 라이어 단어, 추측 결과: `liar_guess` 또는 `result`에서만 공개
- 메시지: 최근 100개만 반환
- 투표 결과: 결과 관련 phase에서만 계산해 반환

삼단오목에서도 보드 전체는 공개해도 되지만, 다음 값은 서버 검증을 기준으로 관리해야 한다.

- 현재 차례
- 현재 플레이어의 돌 색/기호
- 이미 놓인 돌 목록
- 승리 판정 결과
- 재시작 권한

## 7. 게임별 모듈 비교

### 7.1 DeathNote

구성은 [`src/DeathNote/index.ts`](../src/DeathNote/index.ts), [`engine.ts`](../src/DeathNote/engine.ts), [`types.ts`](../src/DeathNote/types.ts), [`constants.ts`](../src/DeathNote/constants.ts), [`roleAssignment.ts`](../src/DeathNote/roleAssignment.ts), [`html.ts`](../src/DeathNote/html.ts)다.

- 상태 저장: `deathNoteRooms: Map<string, DNRoom>`
- phase: `lobby → playing → result`
- 최소 인원: 3명
- 시작 권한: 방장
- 로비 설정: 일반/사신/바보 모드, 이미지/텍스트 표시 방식
- 게임 진행: 역할별 명령을 채팅 입력으로 해석
- 상태 동기화: 2초 폴링, `version` 비교
- 비밀 정보: `buildState()`가 플레이어별 `myRole`, 사용 가능한 명령, 가시 메시지를 구성
- API: 방 목록/생성/참가/퇴장/모드 변경/시작/상태/채팅

역할 배정과 게임 시작은 [`src/DeathNote/engine.ts:1245-1322`](../src/DeathNote/engine.ts#L1245-L1322), API 등록은 [`src/DeathNote/engine.ts:1324-1459`](../src/DeathNote/engine.ts#L1324-L1459)다.

### 7.2 YangSeChan

구성은 [`src/YangSeChan/engine.ts`](../src/YangSeChan/engine.ts)와 [`src/YangSeChan/html.ts`](../src/YangSeChan/html.ts) 중심이다.

- 상태 저장: `yangSeChanRooms: Map<string, YSRoom>`
- phase: `lobby → prompt_input → turn`
- 최소/최대 인원: 2~10명
- 시작 조건: 방장, 전원 준비
- `prompt_input`: 3분 동안 각자 제시어 제출
- 제시어 배정: 자기 제시어를 받지 않도록 derangement를 생성
- `turn`: 질문 → 대상 답변, 또는 제시어 정답 추측
- 정답자는 `isPlaying=false`, `isSpectator=true`가 되어 순위에 기록
- 상태 동기화: 2초 폴링

제시어 배정과 턴 종료는 [`src/YangSeChan/engine.ts:100-217`](../src/YangSeChan/engine.ts#L100-L217), 주요 API는 [`src/YangSeChan/engine.ts:450-634`](../src/YangSeChan/engine.ts#L450-L634)다.

### 7.3 ForbiddenWord

구성은 [`src/ForbiddenWord/engine.ts`](../src/ForbiddenWord/engine.ts)와 [`src/ForbiddenWord/html.ts`](../src/ForbiddenWord/html.ts)다.

- 상태 저장: `forbiddenWordRooms: Map<string, FWRoom>`
- phase: `lobby → assignment → playing → result`
- 최소/최대 인원: 2~10명
- `assignment`: 각 플레이어가 다른 플레이어에게 금지어를 배정
- 대상 배정: 자기 자신을 대상으로 선택하지 않는 순열
- `playing`: 대상이 금지어를 말하면 탈락
- 상태 동기화: 1초 폴링
- 결과 후 짧은 시간 뒤 자동으로 로비 복귀

방 상태 생성과 phase/타이머 로직은 [`src/ForbiddenWord/engine.ts:98-235`](../src/ForbiddenWord/engine.ts#L98-L235), 액션 API는 [`src/ForbiddenWord/engine.ts:420-579`](../src/ForbiddenWord/engine.ts#L420-L579)다.

### 7.4 Spyfall

구성은 [`src/Spyfall/engine.ts`](../src/Spyfall/engine.ts), [`types.ts`](../src/Spyfall/types.ts), [`constants.ts`](../src/Spyfall/constants.ts), [`html.ts`](../src/Spyfall/html.ts)다.

- 상태 저장: `spyfallRooms: Map<string, SFRoom>`
- phase: `lobby → playing → final_vote → guessing → result`
- 최소/최대 인원: 3~10명
- 시작 시 장소와 스파이를 서버가 무작위 배정
- `playing`: 질문/답변과 투표
- 과반 지목 시 스파이 추측 단계로 전환
- 스파이가 장소를 맞히면 스파이 승, 틀리면 시민 승
- 시간 종료 시 최종 투표와 결과 계산
- 상태 동기화: 1.5초 폴링

시작 및 라운드 타이머는 [`src/Spyfall/engine.ts:139-211`](../src/Spyfall/engine.ts#L139-L211), 주요 액션 API는 [`src/Spyfall/engine.ts:434-600`](../src/Spyfall/engine.ts#L434-L600)다.

### 7.5 CatchMind

CatchMind는 현재 프로젝트에서 가장 실시간성이 높은 별도 구현이다. 핵심 게임 로직은 [`src/CatchMind/catchmind_game.ts`](../src/CatchMind/catchmind_game.ts), 타입은 [`src/CatchMind/types.ts`](../src/CatchMind/types.ts), 클라이언트는 [`src/CatchMind/html.ts`](../src/CatchMind/html.ts)다.

- 상태 저장: `catchMindRooms: Map<string, CatchMindRoom>`
- phase: `lobby → turn → turn_result → result`
- 최소/최대 인원: 2~10명
- 방장 설정: 최대 인원, 라운드 수, 턴 시간
- 게임 시작 시 전체 턴 큐를 만든다
- 출제자만 그림을 전송할 수 있다
- Socket.IO로 선 그리기, 캔버스 초기화, 채팅을 전달한다
- REST 상태 조회는 초기 화면, 재접속, 비정상 연결 복구에 사용한다
- 정답자는 출제자와 함께 점수를 얻고 `turn_result`를 거쳐 다음 턴으로 간다
- 결과 후 일정 시간이 지나면 자동으로 로비에 복귀한다

Socket.IO 등록과 이벤트 권한 검사는 [`src/CatchMind/catchmind_game.ts:891-1025`](../src/CatchMind/catchmind_game.ts#L891-L1025), REST 라우트는 [`src/CatchMind/catchmind_game.ts:1027-1219`](../src/CatchMind/catchmind_game.ts#L1027-L1219), 턴/결과 전이는 [`src/CatchMind/catchmind_game.ts:435-639`](../src/CatchMind/catchmind_game.ts#L435-L639)다.

## 8. API와 상태 동기화 규칙

### 8.1 공통 API 패턴

대부분의 게임은 다음 URL 패턴을 사용한다.

| 기능 | HTTP | 일반 경로 패턴 |
|---|---|---|
| 방 목록 | GET | `/api/{game}/rooms` |
| 방 생성 | POST | `/api/{game}/rooms` |
| 방 참가 | POST | `/api/{game}/rooms/:roomId/join` |
| 방 퇴장 | POST | `/api/{game}/rooms/:roomId/leave` |
| 준비 | POST | `/api/{game}/rooms/:roomId/ready` |
| 시작 | POST | `/api/{game}/rooms/:roomId/start` |
| 상태 | GET | `/api/{game}/rooms/:roomId/state?playerId=...&v=...` |
| 채팅 | POST 또는 Socket.IO | `/api/{game}/rooms/:roomId/chat` |

게임 규칙에 따라 설정, 투표, 추측, 턴 액션 API를 추가한다. 삼단오목은 최소한 다음 API가 필요하다.

```text
GET  /api/threemok/rooms
POST /api/threemok/rooms
POST /api/threemok/rooms/:roomId/join
POST /api/threemok/rooms/:roomId/leave
POST /api/threemok/rooms/:roomId/ready
POST /api/threemok/rooms/:roomId/start
POST /api/threemok/rooms/:roomId/move
GET  /api/threemok/rooms/:roomId/state
POST /api/threemok/rooms/:roomId/new-game   # 재대국을 지원할 경우
```

### 8.2 `version` 기반 폴링

모듈형 게임 대부분은 상태 변경 때 `room.version`을 증가시키고, 클라이언트가 마지막 버전을 `v`로 보낸다. 변경이 없으면 전체 상태를 다시 그리지 않는다.

```text
클라이언트 v=7 요청
  ↓
서버 room.version=7
  ↓
{ changed: false, version: 7 }

서버에서 착수/준비/퇴장 발생 → room.version=8
  ↓
클라이언트 다음 요청
  ↓
{ changed: true, version: 8, room, players, ... }
```

삼단오목의 착수 API는 유효한 착수일 때만 `version`을 증가시키고, 중복 착수/잘못된 좌표/차례 위반은 상태를 바꾸지 않고 오류를 반환해야 한다. 현재 LiarGame의 상태 반환 패턴은 [`src/index.ts:2220-2291`](../src/index.ts#L2220-L2291), 모듈형 예시는 [`src/YangSeChan/engine.ts:220-306`](../src/YangSeChan/engine.ts#L220-L306)이다.

### 8.3 서버 권위와 클라이언트 렌더링

기존 클라이언트는 서버 상태를 받아 HTML을 다시 렌더링한다. 버튼 표시 여부는 UX를 위한 것이고, 실제 권한은 서버가 다시 검사한다.

예를 들어 LiarGame 클라이언트는 phase에 따라 렌더러를 선택한다([`src/index.ts:4222-4251`](../src/index.ts#L4222-L4251)). 삼단오목도 다음처럼 phase별 UI를 분리하는 것이 안전하다.

```text
renderGameState(data)
  ├─ lobby       → 플레이어/준비/시작/설정
  ├─ playing     → 보드/현재 차례/착수 버튼
  ├─ result      → 승자/착수 기록/재대국
  └─ chat        → 공통 보조 패널
```

## 9. 신규 삼단오목 구현 설계 체크리스트

### 9.1 규칙 및 상태 모델

- 보드 크기: 3×3인지, 삼단오목의 별도 승리 조건인지 확정
- 플레이어 수: 2명 고정인지, 관전자/대기자를 허용할지
- 돌 배정: 선공/후공 배정 규칙
- 착수 가능 phase
- 같은 칸 중복 착수 처리
- 승리 줄 판정
- 무승부 판정
- 게임 종료 후 재대국 처리
- 게임 중 연결 해제/재접속 처리

권장 최소 타입 구성:

```ts
type ThreeMokPhase = "lobby" | "playing" | "result";
type Stone = "X" | "O" | null;

type ThreeMokPlayer = {
  id: string;
  nickname: string;
  isHost: boolean;
  ready: boolean;
  stone: Exclude<Stone, null> | null;
  connected: boolean;
};

type ThreeMokRoom = {
  id: string;
  name: string;
  hostId: string;
  phase: ThreeMokPhase;
  players: ThreeMokPlayer[];
  board: Stone[];
  currentPlayerId: string | null;
  winnerPlayerId: string | null;
  winningCells: number[];
  draw: boolean;
  version: number;
  createdAt: number;
  updatedAt: number;
};
```

실제 타입은 게임 규칙 확정 후 조정하되, 서버 내부 상태와 외부 응답 타입을 분리하는 것을 권장한다. 특히 방장, 현재 차례, 승리 정보는 클라이언트가 임의로 계산하지 않도록 한다.

### 9.2 로비

- 닉네임을 입력 또는 복원
- 방 목록에서 `lobby`이고 정원이 남은 방만 참가 가능
- 방 생성 시 방 이름과 필요한 설정을 전달
- 방장만 시작 가능
- 2인 게임이라면 양쪽 준비 조건을 명확히 한다
- 방장 퇴장 시 승계 여부를 기존 모듈과 동일하게 구현
- 결과에서 새 게임 버튼을 방장에게만 노출

### 9.3 착수 API 검증 순서

`POST /api/threemok/rooms/:roomId/move`는 다음 순서가 안전하다.

1. 방 조회
2. `phase === "playing"`인지 확인
3. 요청 플레이어가 방에 속하는지 확인
4. 요청 플레이어가 `currentPlayerId`인지 확인
5. 셀 인덱스 또는 행/열이 범위 안인지 확인
6. 해당 칸이 비어 있는지 확인
7. 서버 보드에 돌 반영
8. 승리 줄 검사
9. 무승부 검사
10. 승리/무승부가 아니면 다음 플레이어로 변경
11. `version` 및 `updatedAt` 증가
12. 변경된 상태 반환

클라이언트에서는 보드 클릭 직후 낙관적 반영을 해도 되지만, 서버 응답 또는 다음 상태 폴링을 최종 기준으로 삼아야 한다.

### 9.4 동기화 방식 선택

삼단오목은 착수 이벤트 빈도가 낮으므로 기본적으로 REST + 1초~1.5초 폴링이면 기존 구조와 충분히 맞는다. CatchMind처럼 Socket.IO를 선택할 수 있지만, 그러면 다음 항목이 추가된다.

- `registerThreeMokSocket(io)`
- `/threemok` 네임스페이스 또는 전용 이벤트 설계
- 연결/재연결/중복 세션 처리
- 서버 브로드캐스트와 개인별 상태 응답
- Socket.IO가 끊겼을 때 REST fallback

따라서 첫 구현은 폴링을 권장하고, 추후 관전자·리플레이·실시간 애니메이션 요구가 생길 때 Socket.IO로 확장하는 편이 위험이 낮다.

## 10. 파일별 책임과 신규 추가 지점

| 파일 | 현재 책임 | 삼단오목에서 할 일 |
|---|---|---|
| `src/index.ts` | 서버 부트스트랩, 기본 LiarGame, 전체 페이지 라우트 | import, route 등록, `/threemok`, 루트 선택 링크 |
| `src/ThreeMok/types.ts` | 없음 | phase/player/room/move/result 타입 |
| `src/ThreeMok/constants.ts` | 없음 | 인원, phase 문구, 보드 규칙, 타임아웃 |
| `src/ThreeMok/engine.ts` | 없음 | 방 Map, 상태 전이, API, 승리 판정 |
| `src/ThreeMok/html.ts` | 없음 | 로비, 방 목록, 보드, 채팅, localStorage, 폴링 |
| `src/ThreeMok/index.ts` | 없음 | engine/html export |
| `public/static/style.css` | 공용 정적 CSS | 필요할 때만 공통 스타일 추가 |
| `package.json` | 빌드/실행 명령과 의존성 | 폴링 방식이면 변경 불필요 |
| `scripts/` | CatchMind 자산/단어/테스트 | 삼단오목 테스트를 별도 추가할 수 있음 |

## 11. 테스트 및 검증 계획

### 11.1 정적/빌드 검증

```bash
npm run build
```

확인할 사항:

- 모듈 import 경로의 `.js` 확장자 규칙
- `strict: false` 환경에서도 타입/문법 오류가 없는지
- `dist/index.js`가 생성되는지
- 삼단오목 HTML이 번들에 포함되는지

### 11.2 API 스모크 흐름

```text
GET  /health
GET  /api/threemok/rooms
POST /api/threemok/rooms
POST /api/threemok/rooms/:id/join
POST /api/threemok/rooms/:id/ready
POST /api/threemok/rooms/:id/start
GET  /api/threemok/rooms/:id/state?playerId=...&v=0
POST /api/threemok/rooms/:id/move
GET  /api/threemok/rooms/:id/state?playerId=...&v=...
```

### 11.3 규칙 테스트

- 빈 보드에서 선공이 정상 시작하는지
- 유효하지 않은 칸에 착수할 수 없는지
- 다른 플레이어가 현재 차례를 가로챌 수 없는지
- 가로/세로/대각선 승리가 모두 판정되는지
- 마지막 칸 무승부가 판정되는지
- 승리 이후 추가 착수가 차단되는지
- 동일 요청 재전송이 중복 착수를 만들지 않는지
- 결과 이후 방장이 재대국할 수 있는지
- 방장 퇴장과 참가자 퇴장 시 방 상태가 깨지지 않는지
- 브라우저 새로고침 후 `localStorage` 세션으로 상태 복귀가 되는지

## 12. 현재 구조의 주의점

1. **공통 방 모델이 없다.** 신규게임을 기존 `Room`에 추가하기보다 독립 타입과 독립 저장소를 두는 편이 현재 구조와 일치한다.
2. **인증이 없다.** `playerId`는 추측 가능한 짧은 랜덤 문자열이므로 운영 보안 요구가 커지면 별도의 세션/토큰 설계가 필요하다.
3. **메모리 저장이다.** Azure에서 인스턴스가 여러 개로 늘어나면 같은 방을 서로 다른 인스턴스가 보지 못할 수 있다.
4. **게임별 폴링 주기가 다르다.** 삼단오목은 자체 UI에 맞는 주기를 정하되 `version` 비교를 유지해야 한다.
5. **클라이언트는 HTML 문자열 안에 들어 있다.** 게임 UI를 추가할 때 서버 템플릿과 브라우저 JavaScript를 같은 `html.ts`에서 관리하게 된다.
6. **타이머 정책이 게임마다 다르다.** `setTimeout`만 쓰는 게임, 상태 요청 시 타임아웃을 평가하는 게임, Socket.IO 이벤트와 함께 쓰는 게임이 섞여 있다.
7. **루트 선택 메뉴는 수동 등록이다.** 게임을 추가할 때 모듈/API만 만들면 메뉴에는 자동으로 나타나지 않는다.
8. **문서와 실제 코드가 어긋날 수 있다.** 신규게임 추가 후 README의 게임 목록과 API 목록도 함께 갱신해야 한다.

## 13. 신규 삼단오목 작업 순서

1. 삼단오목의 정확한 규칙과 2인/관전자 정책 확정
2. `src/ThreeMok/types.ts`와 `constants.ts` 작성
3. `engine.ts`에 방 생성/참가/퇴장/준비/시작/착수/상태/재대국 구현
4. 서버 권위 기준의 승리·무승부 판정 함수 작성
5. `html.ts`에 닉네임, 방 목록, 로비, 보드, 결과 UI 작성
6. `index.ts` export 작성
7. 루트 서버에 API 등록 및 페이지 라우트 연결
8. 루트 게임 선택 링크 연결
9. `npm run build` 및 API/규칙 스모크 테스트
10. README의 게임 목록·API·실행 흐름 갱신

이 순서를 따르면 신규게임은 기존 게임의 상태 저장소와 phase가 섞이지 않으면서도, 현재 프로젝트가 이미 사용하는 사용자 세션·로비·방장·폴링 패턴을 그대로 재사용할 수 있다.
