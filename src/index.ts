import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { fileURLToPath } from 'node:url'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const APP_VERSION = 'v1.02'

// ============================================================
// 시멈비 라이어게임 - In-Memory Game State (Edge Worker)
// ============================================================

type Player = {
  id: string
  nickname: string
  ready: boolean
  isHost: boolean
  isLiar: boolean
  word: string
  lastSeen: number
}

type ChatMessage = {
  id: string
  playerId: string
  nickname: string
  message: string
  timestamp: number
  type: 'chat' | 'system' | 'speak'
}

type Vote = {
  voterId: string
  targetId: string
}

type GameMode = 'classic' | 'fool'

type GamePhase =
  | 'waiting'      // 대기실
  | 'word_reveal'  // 제시어 공개 (각자 확인)
  | 'speaking'     // 순서대로 발언
  | 'free_chat'    // 자유 채팅 (3분)
  | 'vote_extend'  // 추가 토론 투표
  | 'speaking2'    // 2차 발언
  | 'final_vote'   // 최종 라이어 투표
  | 'liar_guess'   // 라이어 제시어 맞추기
  | 'result'       // 결과 공개

type Room = {
  id: string
  name: string
  hostId: string
  players: Player[]
  maxPlayers: number
  phase: GamePhase
  gameMode: GameMode
  category: string
  realWord: string
  liarWord: string
  liarId: string
  speakingOrder: string[]
  currentSpeakerIndex: number
  currentSpeakerStartTime: number
  speakingTimeLimit: number // seconds per speaker
  messages: ChatMessage[]
  votes: Vote[]
  extendVotes: { playerId: string; extend: boolean }[]
  liarGuess: string
  roundNumber: number
  phaseStartTime: number
  freeChatDuration: number // seconds
  createdAt: number
  lastActivity: number
  version: number
}

// Word categories
const WORD_BANK: Record<string, string[]> = {
  '음식': ['치킨', '피자', '김치찌개', '떡볶이', '비빔밥', '삼겹살', '초밥', '파스타', '햄버거', '라면', '불고기', '갈비탕', '된장찌개', '냉면', '짜장면', '만두', '김밥', '칼국수', '부대찌개', '제육볶음'],
  '동물': ['고양이', '강아지', '코끼리', '기린', '펭귄', '호랑이', '토끼', '햄스터', '돌고래', '독수리', '판다', '여우', '사자', '곰', '원숭이', '앵무새', '거북이', '상어', '고래', '카멜레온'],
  '장소': ['도서관', '놀이공원', '병원', '학교', '카페', '공항', '해변', '산꼭대기', '지하철', '영화관', '박물관', '체육관', '수영장', '공원', '시장', '호텔', '편의점', '백화점', '경찰서', '소방서'],
  '직업': ['의사', '선생님', '소방관', '요리사', '파일럿', '경찰', '간호사', '프로그래머', '변호사', '건축가', '수의사', '약사', '기자', '배우', '가수', '화가', '운동선수', '과학자', '사진작가', '유튜버'],
  '영화/드라마': ['해리포터', '어벤져스', '겨울왕국', '기생충', '타이타닉', '인터스텔라', '오징어게임', '도깨비', '반지의제왕', '스파이더맨', '배트맨', '아이언맨', '토이스토리', '알라딘', '매트릭스'],
  '스포츠': ['축구', '야구', '농구', '테니스', '수영', '탁구', '배드민턴', '볼링', '골프', '스키', '아이스하키', '복싱', '태권도', '양궁', '마라톤'],
  '가전제품': ['냉장고', '세탁기', '에어컨', '전자레인지', '청소기', '텔레비전', '컴퓨터', '노트북', '스마트폰', '드라이기', '토스터', '믹서기', '공기청정기', '가습기', '제습기'],
}

// Similar words for liar (related but different)
const LIAR_SIMILAR: Record<string, string> = {
  '치킨': '통닭', '피자': '빵', '김치찌개': '된장찌개', '떡볶이': '라볶이', '비빔밥': '볶음밥',
  '고양이': '강아지', '강아지': '고양이', '코끼리': '하마', '기린': '사슴', '펭귄': '오리',
  '도서관': '서점', '놀이공원': '동물원', '병원': '약국', '학교': '학원', '카페': '식당',
  '의사': '약사', '선생님': '교수', '소방관': '경찰', '요리사': '제빵사', '파일럿': '기장',
}

const EXPANDED_WORD_BANK: Record<string, string[]> = {
  '음식': [
    '김치', '피자', '치킨', '짜장면', '짬뽕', '라면', '우동', '냉면', '비빔밥', '불고기',
    '갈비', '삼겹살', '제육볶음', '닭갈비', '찜닭', '떡볶이', '순대', '튀김', '핫도그', '김밥',
    '주먹밥', '샌드위치', '햄버거', '파스타', '리조또', '스테이크', '돈가스', '오므라이스', '카레', '쌀국수',
    '월남쌈', '타코', '부리토', '초밥', '사시미', '덮밥', '오징어볶음', '해물탕', '된장찌개', '순두부찌개',
    '김치찌개', '부대찌개', '삼계탕', '갈비탕', '설렁탕', '곰탕', '매운탕', '아구찜', '조개구이', '장어구이',
    '계란말이', '잡채', '전', '파전', '호떡', '붕어빵', '와플', '팬케이크', '도넛', '케이크',
    '마카롱', '쿠키', '초콜릿', '젤리', '빙수', '아이스크림', '요거트', '치즈케이크', '타르트', '푸딩',
    '복숭아', '딸기', '수박', '바나나', '사과', '배', '포도', '망고', '파인애플', '블루베리',
  ],
  '동물': [
    '고양이', '강아지', '토끼', '햄스터', '기니피그', '고슴도치', '다람쥐', '여우', '늑대', '곰',
    '사자', '호랑이', '치타', '표범', '하이에나', '코끼리', '기린', '얼룩말', '코뿔소', '하마',
    '원숭이', '고릴라', '침팬지', '오랑우탄', '판다', '캥거루', '코알라', '나무늘보', '수달', '비버',
    '너구리', '라쿤', '미어캣', '족제비', '사슴', '말', '당나귀', '소', '양', '염소',
    '돼지', '닭', '오리', '거위', '독수리', '참새', '비둘기', '까마귀', '부엉이', '펭귄',
    '플라밍고', '백조', '앵무새', '매', '타조', '갈매기', '상어', '고래', '돌고래', '문어',
    '오징어', '해파리', '게', '새우', '가재', '거북이', '악어', '도마뱀', '카멜레온', '뱀',
    '개구리', '두꺼비', '금붕어', '잉어', '연어', '참치', '나비', '벌', '개미', '잠자리',
  ],
  '장소': [
    '학교', '도서관', '병원', '약국', '카페', '식당', '빵집', '편의점', '마트', '백화점',
    '시장', '놀이공원', '동물원', '수족관', '영화관', '공원', '미술관', '박물관', '체육관', '수영장',
    '헬스장', '볼링장', '노래방', 'PC방', '문구점', '서점', '꽃집', '세탁소', '은행', '우체국',
    '경찰서', '소방서', '시청', '구청', '법원', '공항', '기차역', '버스터미널', '지하철역', '주차장',
    '호텔', '펜션', '캠핑장', '해변', '산', '계곡', '호수', '강', '섬', '정원',
    '광장', '공연장', '경기장', '야구장', '축구장', '농구장', '테니스장', '스키장', '빙상장', '골프장',
    '교실', '강당', '연구실', '사무실', '회의실', '공장', '창고', '정비소', '주유소', '세차장',
    '미용실', '네일샵', '응급실', '카페테리아', '약수터', '전망대', '천문대', '온천', '찜질방', '리조트',
  ],
  '직업': [
    '의사', '간호사', '약사', '교사', '교수', '학생', '경찰', '소방관', '군인', '변호사',
    '판사', '검사', '기자', '아나운서', '배우', '가수', '작곡가', '화가', '조각가', '사진작가',
    '요리사', '제빵사', '바리스타', '미용사', '네일아티스트', '디자이너', '건축가', '프로그래머', '게임개발자', '데이터분석가',
    '기획자', '마케터', '회계사', '세무사', '은행원', '공무원', '비서', '번역가', '통역사', '작가',
    '웹툰작가', '유튜버', '스트리머', '운동선수', '축구선수', '야구선수', '농구선수', '수영선수', '골프선수', '코치',
    '파일럿', '승무원', '기관사', '버스기사', '택시기사', '배달기사', '정비사', '목수', '용접사', '전기기사',
    '과학자', '연구원', '천문학자', '생물학자', '화학자', '물리학자', '수의사', '사육사', '농부', '어부',
    '환경미화원', '부동산중개사', '상담사', '심리학자', '사회복지사', '치과의사', '치위생사', '보육교사', '사서', '큐레이터',
  ],
  '영화/드라마': [
    '해리포터', '반지의제왕', '어벤져스', '아이언맨', '스파이더맨', '배트맨', '슈퍼맨', '캡틴아메리카', '토르', '헐크',
    '겨울왕국', '토이스토리', '인사이드아웃', '코코', '업', '라따뚜이', '월E', '니모를찾아서', '몬스터주식회사', '알라딘',
    '라이온킹', '미녀와야수', '인어공주', '모아나', '주토피아', '슈렉', '쿵푸팬더', '드래곤길들이기', '미니언즈', '슈퍼배드',
    '기생충', '올드보이', '부산행', '극한직업', '명량', '암살', '범죄도시', '신과함께', '도둑들', '국제시장',
    '타이타닉', '아바타', '인터스텔라', '인셉션', '테넷', '매트릭스', '존윅', '미션임파서블', '분노의질주', '007',
    '라라랜드', '위대한쇼맨', '맘마미아', '보헤미안랩소디', '레미제라블', '노트북', '귀멸의칼날', '센과치히로의행방불명', '하울의움직이는성', '너의이름은',
    '날씨의아이', '슬램덩크', '원피스', '나루토', '드래곤볼', '포켓몬', '디지몬', '짱구는못말려', '도깨비', '미생',
    '응답하라1988', '슬기로운의사생활', '이상한변호사우영우', '오징어게임', '더글로리', '킹덤', '사랑의불시착', '태양의후예', '비밀의숲', '무빙',
  ],
  '스포츠': [
    '축구', '야구', '농구', '배구', '탁구', '테니스', '배드민턴', '골프', '볼링', '당구',
    '수영', '다이빙', '서핑', '요트', '카약', '조정', '양궁', '사격', '펜싱', '유도',
    '태권도', '복싱', '킥복싱', '레슬링', '씨름', '체조', '리듬체조', '육상', '마라톤', '높이뛰기',
    '멀리뛰기', '창던지기', '역도', '승마', '사이클', '산악자전거', '스케이트보드', '인라인스케이트', '스키', '스노보드',
    '피겨스케이팅', '쇼트트랙', '스피드스케이팅', '아이스하키', '컬링', '봅슬레이', 'e스포츠', '체스', '바둑', '피구',
    '풋살', '족구', '핸드볼', '럭비', '미식축구', '크리켓', '클라이밍', '철인3종', '크로스핏', '필라테스',
    '요가', '줄넘기', '팔씨름', '스쿼시', '라크로스', '드론레이싱', '레이싱', '카트', '브레이킹', '암벽등반',
  ],
  '가전제품': [
    '냉장고', '김치냉장고', '세탁기', '건조기', '에어컨', '선풍기', '서큘레이터', '공기청정기', '가습기', '제습기',
    '청소기', '로봇청소기', '전자레인지', '오븐', '에어프라이어', '전기밥솥', '인덕션', '가스레인지', '식기세척기', '정수기',
    '커피머신', '믹서기', '블렌더', '토스터', '전기포트', '전기그릴', 'TV', '프로젝터', '사운드바', '스피커',
    '헤드폰', '이어폰', '노트북', '데스크톱', '모니터', '프린터', '복합기', '태블릿', '스마트폰', '스마트워치',
    '게임기', '공유기', '웹캠', '외장하드', '보조배터리', '키보드', '마우스', '안마의자', '전기장판', '히터',
    '드라이기', '고데기', '면도기', '전동칫솔', '비데', '스타일러', '의류관리기', '도어락', '인터폰', '와인셀러',
    'AI스피커', '미니냉장고', '휴대용선풍기', '전기주전자', '살균기', '소독기', '탈취기', '재봉틀', '무드등', '전기담요',
  ],
  '교통수단': [
    '자동차', '세단', 'SUV', '쿠페', '해치백', '경차', '스포츠카', '전기차', '하이브리드차', '택시',
    '버스', '고속버스', '트럭', '덤프트럭', '소방차', '구급차', '경찰차', '오토바이', '스쿠터', '자전거',
    '전동킥보드', '기차', 'KTX', '지하철', '트램', '모노레일', '케이블카', '비행기', '여객기', '전투기',
    '헬리콥터', '드론', '열기구', '패러글라이더', '우주선', '로켓', '잠수함', '유람선', '크루즈', '보트',
    '카누', '카약', '요트', '페리', '제트스키', '휠체어', '스케이트보드', '인라인', '트랙터', '굴착기',
    '지게차', '전동휠', '삼륜차', '사륜바이크', '견인차', '캠핑카', '카라반', '리무진', '택배차', '냉동탑차',
  ],
  '학교용품': [
    '연필', '샤프', '볼펜', '만년필', '형광펜', '색연필', '사인펜', '매직', '지우개', '수정테이프',
    '연필깎이', '자', '삼각자', '각도기', '컴퍼스', '노트', '공책', '오답노트', '스프링노트', '메모지',
    '포스트잇', '파일', '클리어파일', '바인더', '클립', '집게', '스테이플러', '펀치', '가위', '커터칼',
    '풀', '딱풀', '테이프', '양면테이프', '색종이', '도화지', '스케치북', '필통', '책가방', '실내화',
    '실내화주머니', '도시락가방', '물통', '독서대', '책받침', '시간표', '이름표', '계산기', '전자사전', '태블릿',
    '노트북', 'USB메모리', '화이트보드', '보드마카', '칠판지우개', '분필', '시험지', '프린트물', '스티커', '북마크',
  ],
  '의류/패션': [
    '티셔츠', '셔츠', '맨투맨', '후드티', '니트', '가디건', '블라우스', '원피스', '치마', '청바지',
    '슬랙스', '반바지', '트레이닝복', '레깅스', '점퍼', '패딩', '코트', '재킷', '블레이저', '조끼',
    '잠옷', '속옷', '양말', '스타킹', '운동화', '구두', '로퍼', '샌들', '슬리퍼', '부츠',
    '모자', '비니', '캡모자', '버킷햇', '목도리', '장갑', '선글라스', '안경', '귀걸이', '목걸이',
    '팔찌', '반지', '시계', '벨트', '넥타이', '브로치', '헤어핀', '머리띠', '가방', '백팩',
    '크로스백', '토트백', '에코백', '클러치', '지갑', '향수', '립스틱', '쿠션', '파운데이션', '한복',
  ],
  '자연/날씨': [
    '해', '달', '별', '구름', '비', '눈', '우박', '번개', '천둥', '무지개',
    '안개', '서리', '이슬', '바람', '태풍', '폭풍', '햇살', '노을', '새벽', '황혼',
    '봄', '여름', '가을', '겨울', '장마', '한파', '폭염', '미세먼지', '황사', '꽃',
    '장미', '튤립', '해바라기', '벚꽃', '민들레', '코스모스', '라벤더', '단풍', '나무', '소나무',
    '숲', '정글', '사막', '오아시스', '산', '화산', '빙하', '바다', '파도', '해변',
    '모래사장', '섬', '강', '폭포', '호수', '연못', '계곡', '동굴', '바위', '조약돌',
  ],
  '게임/취미': [
    '보드게임', '체스', '장기', '바둑', '오목', '포커', '마술', '퍼즐', '큐브', '레고',
    '뜨개질', '자수', '재봉', '그림그리기', '수채화', '유화', '캘리그라피', '사진촬영', '영상편집', '독서',
    '글쓰기', '피아노', '기타', '바이올린', '드럼', '우쿨렐레', '노래부르기', '댄스', '러닝', '등산',
    '캠핑', '낚시', '드라이브', '여행', '베이킹', '요리', '홈카페', '수집', '피규어수집', '게임',
    '롤', '오버워치', '마인크래프트', '테트리스', '동물의숲', '젤다', '포켓몬스터', '리듬게임', 'VR게임', '방탈출',
    '컬러링북', '원예', '가드닝', '반려식물', '캔들만들기', '비누만들기', '도예', '목공', '3D프린팅', 'DIY',
  ],
}

const EXPANDED_LIAR_SIMILAR: Record<string, string> = {
  '김치': '깍두기',
  '피자': '파스타',
  '치킨': '닭강정',
  '짜장면': '짬뽕',
  '라면': '우동',
  '냉면': '막국수',
  '비빔밥': '돌솥비빔밥',
  '불고기': '제육볶음',
  '갈비': '갈비찜',
  '삼겹살': '목살',
  '떡볶이': '로제떡볶이',
  '김밥': '참치김밥',
  '샌드위치': '햄버거',
  '파스타': '리조또',
  '초밥': '사시미',
  '김치찌개': '부대찌개',
  '삼계탕': '백숙',
  '고양이': '강아지',
  '강아지': '고양이',
  '토끼': '햄스터',
  '여우': '늑대',
  '사자': '호랑이',
  '코끼리': '하마',
  '기린': '얼룩말',
  '문어': '오징어',
  '학교': '도서관',
  '병원': '약국',
  '카페': '식당',
  '놀이공원': '동물원',
  '의사': '간호사',
  '교사': '교수',
  '경찰': '소방관',
  '변호사': '판사',
  '배우': '가수',
  '요리사': '제빵사',
  '프로그래머': '게임개발자',
  '유튜버': '스트리머',
  '파일럿': '승무원',
  '해리포터': '반지의제왕',
  '어벤져스': '아이언맨',
  '스파이더맨': '배트맨',
  '겨울왕국': '모아나',
  '기생충': '올드보이',
  '축구': '풋살',
  '야구': '소프트볼',
  '농구': '3x3농구',
  '탁구': '테니스',
  '스키': '스노보드',
  '냉장고': '김치냉장고',
  '세탁기': '건조기',
  '에어컨': '선풍기',
  'TV': '프로젝터',
  '스마트폰': '태블릿',
  '자동차': '세단',
  '전기차': '하이브리드차',
  '버스': '지하철',
  '비행기': '헬리콥터',
  '연필': '샤프',
  '볼펜': '만년필',
  '노트': '공책',
  '티셔츠': '셔츠',
  '원피스': '치마',
  '운동화': '구두',
  '해': '달',
  '비': '눈',
  '봄': '가을',
  '여름': '겨울',
  '바다': '호수',
  '보드게임': '체스',
  '장기': '바둑',
  '퍼즐': '큐브',
  '피아노': '기타',
  '베이킹': '요리',
}

// Global state
const rooms = new Map<string, Room>()
const playerSessions = new Map<string, { roomId: string; playerId: string; nickname: string }>()

function generateId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function cleanupStaleRooms() {
  const now = Date.now()
  for (const [id, room] of rooms) {
    // Remove players not seen in 60 seconds
    room.players = room.players.filter(p => now - p.lastSeen < 60000)
    // Remove room if empty or inactive for 10 minutes
    if (room.players.length === 0 || now - room.lastActivity > 600000) {
      rooms.delete(id)
    }
  }
}

function getRandomWord(category: string): { realWord: string; liarWord: string } {
  const words = EXPANDED_WORD_BANK[category] || EXPANDED_WORD_BANK['음식']
  const realWord = words[Math.floor(Math.random() * words.length)]
  const liarCandidates = words.filter((word) => word !== realWord)
  const liarWord =
    EXPANDED_LIAR_SIMILAR[realWord] ||
    liarCandidates[Math.floor(Math.random() * liarCandidates.length)] ||
    '비밀단어'
  return { realWord, liarWord }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

// ============================================================
// Hono App
// ============================================================
const app = new Hono()
app.use('/api/*', cors())

// Static assets for Azure App Service / Node.js runtime
const publicRoot = fileURLToPath(new URL('../public', import.meta.url))
app.use('/static/*', serveStatic({ root: publicRoot }))

// Lightweight health endpoint for warm-up / availability checks
app.get('/health', (c) => c.json({ ok: true, version: APP_VERSION, timestamp: Date.now() }))

// --- Room List ---
app.get('/api/rooms', (c) => {
  cleanupStaleRooms()
  const roomList = Array.from(rooms.values()).map(r => ({
    id: r.id,
    name: r.name,
    hostNickname: r.players.find(p => p.isHost)?.nickname || '???',
    playerCount: r.players.length,
    maxPlayers: r.maxPlayers,
    phase: r.phase,
    category: r.category,
    createdAt: r.createdAt,
  }))
  return c.json({ rooms: roomList })
})

// --- Create Room ---
app.post('/api/rooms', async (c) => {
  const body = await c.req.json()
  const { nickname, roomName, category, maxPlayers, speakingTimeLimit, gameMode } = body

  if (!nickname || !roomName) {
    return c.json({ error: '닉네임과 방 이름을 입력해주세요.' }, 400)
  }

  const roomId = generateId()
  const playerId = generateId()

  const player: Player = {
    id: playerId,
    nickname,
    ready: true, // host is always ready
    isHost: true,
    isLiar: false,
    word: '',
    lastSeen: Date.now(),
  }

  const room: Room = {
    id: roomId,
    name: roomName,
    hostId: playerId,
    players: [player],
    maxPlayers: Math.min(Math.max(maxPlayers || 4, 3), 10),
    phase: 'waiting',
    gameMode: gameMode === 'fool' ? 'fool' : 'classic',
    category: category || '음식',
    realWord: '',
    liarWord: '',
    liarId: '',
    speakingOrder: [],
    currentSpeakerIndex: 0,
    currentSpeakerStartTime: 0,
    speakingTimeLimit: speakingTimeLimit || 30,
    messages: [],
    votes: [],
    extendVotes: [],
    liarGuess: '',
    roundNumber: 1,
    phaseStartTime: Date.now(),
    freeChatDuration: 180,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    version: 0,
  }

  rooms.set(roomId, room)
  playerSessions.set(playerId, { roomId, playerId, nickname })

  return c.json({ roomId, playerId })
})

// --- Join Room ---
app.post('/api/rooms/:roomId/join', async (c) => {
  const roomId = c.req.param('roomId')
  const { nickname } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'waiting') return c.json({ error: '이미 게임이 진행 중입니다.' }, 400)
  if (room.players.length >= room.maxPlayers) return c.json({ error: '방이 가득 찼습니다.' }, 400)
  if (room.players.some(p => p.nickname === nickname)) return c.json({ error: '이미 사용 중인 닉네임입니다.' }, 400)

  const playerId = generateId()
  const player: Player = {
    id: playerId,
    nickname,
    ready: false,
    isHost: false,
    isLiar: false,
    word: '',
    lastSeen: Date.now(),
  }

  room.players.push(player)
  room.lastActivity = Date.now()
  room.version++
  room.messages.push({
    id: generateId(),
    playerId: 'system',
    nickname: '시스템',
    message: `${nickname}님이 입장했습니다.`,
    timestamp: Date.now(),
    type: 'system',
  })

  playerSessions.set(playerId, { roomId, playerId, nickname })

  return c.json({ roomId, playerId })
})

// --- Leave Room ---
app.post('/api/rooms/:roomId/leave', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)

  const player = room.players.find(p => p.id === playerId)
  if (!player) return c.json({ error: '플레이어를 찾을 수 없습니다.' }, 404)

  room.players = room.players.filter(p => p.id !== playerId)
  room.version++
  playerSessions.delete(playerId)

  room.messages.push({
    id: generateId(),
    playerId: 'system',
    nickname: '시스템',
    message: `${player.nickname}님이 퇴장했습니다.`,
    timestamp: Date.now(),
    type: 'system',
  })

  // If host left, assign new host
  if (player.isHost && room.players.length > 0) {
    room.players[0].isHost = true
    room.hostId = room.players[0].id
    room.messages.push({
      id: generateId(),
      playerId: 'system',
      nickname: '시스템',
      message: `${room.players[0].nickname}님이 새로운 방장이 되었습니다.`,
      timestamp: Date.now(),
      type: 'system',
    })
  }

  if (room.players.length === 0) {
    rooms.delete(roomId)
  }

  return c.json({ success: true })
})

// --- Kick Player (host only, waiting phase) ---
app.post('/api/rooms/:roomId/kick', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, targetId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.hostId !== playerId) return c.json({ error: '방장만 플레이어를 강퇴할 수 있습니다.' }, 403)
  if (room.phase !== 'waiting') return c.json({ error: '게임 시작 전 대기실에서만 강퇴할 수 있습니다.' }, 400)
  if (playerId === targetId) return c.json({ error: '방장은 자기 자신을 강퇴할 수 없습니다.' }, 400)

  const targetPlayer = room.players.find(p => p.id === targetId)
  if (!targetPlayer) return c.json({ error: '플레이어를 찾을 수 없습니다.' }, 404)
  if (targetPlayer.isHost) return c.json({ error: '방장은 강퇴할 수 없습니다.' }, 400)

  room.players = room.players.filter(p => p.id !== targetId)
  room.version++
  room.lastActivity = Date.now()
  playerSessions.delete(targetId)

  room.messages.push({
    id: generateId(),
    playerId: 'system',
    nickname: '시스템',
    message: `${targetPlayer.nickname}님이 방에서 강퇴되었습니다.`,
    timestamp: Date.now(),
    type: 'system',
  })

  return c.json({ success: true })
})

// --- Toggle Ready ---
app.post('/api/rooms/:roomId/ready', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'waiting') return c.json({ error: '게임이 이미 진행 중입니다.' }, 400)

  const player = room.players.find(p => p.id === playerId)
  if (!player) return c.json({ error: '플레이어를 찾을 수 없습니다.' }, 404)
  if (player.isHost) return c.json({ error: '방장은 항상 준비 상태입니다.' }, 400)

  player.ready = !player.ready
  room.version++
  room.lastActivity = Date.now()

  return c.json({ ready: player.ready })
})

// --- Start Game ---
app.post('/api/rooms/:roomId/start', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.hostId !== playerId) return c.json({ error: '방장만 게임을 시작할 수 있습니다.' }, 403)
  if (room.players.length < 3) return c.json({ error: '최소 3명이 필요합니다.' }, 400)

  const allReady = room.players.every(p => p.isHost || p.ready)
  if (!allReady) return c.json({ error: '모든 플레이어가 준비해야 합니다.' }, 400)

  // Setup game
  const { realWord, liarWord } = getRandomWord(room.category)
  const liarIndex = Math.floor(Math.random() * room.players.length)
  const liarPlayer = room.players[liarIndex]

  room.realWord = realWord
  room.liarWord = liarWord
  room.liarId = liarPlayer.id
  room.roundNumber = 1

  // Assign words
  room.players.forEach(p => {
    const isLiar = p.id === liarPlayer.id
    p.isLiar = isLiar
    p.word = isLiar
      ? (room.gameMode === 'classic' ? '???' : liarWord)
      : realWord
    p.ready = false
  })

  // Random speaking order
  room.speakingOrder = shuffleArray(room.players.map(p => p.id))
  room.currentSpeakerIndex = 0
  room.currentSpeakerStartTime = 0

  room.phase = 'word_reveal'
  room.phaseStartTime = Date.now()
  room.votes = []
  room.extendVotes = []
  room.liarGuess = ''
  room.version++
  room.lastActivity = Date.now()

  room.messages.push({
    id: generateId(),
    playerId: 'system',
    nickname: '시스템',
    message: `🎮 게임이 시작되었습니다! 카테고리: ${room.category}`,
    timestamp: Date.now(),
    type: 'system',
  })

  return c.json({ success: true })
})

// --- Confirm Word (player confirms they saw their word) ---
app.post('/api/rooms/:roomId/confirm-word', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'word_reveal') return c.json({ error: '제시어 확인 단계가 아닙니다.' }, 400)

  const player = room.players.find(p => p.id === playerId)
  if (!player) return c.json({ error: '플레이어를 찾을 수 없습니다.' }, 404)

  player.ready = true
  room.version++

  // If all confirmed, start speaking phase
  if (room.players.every(p => p.ready)) {
    room.phase = 'speaking'
    room.currentSpeakerIndex = 0
    room.currentSpeakerStartTime = Date.now()
    room.phaseStartTime = Date.now()
    room.players.forEach(p => p.ready = false)
    room.version++

    const firstSpeaker = room.players.find(p => p.id === room.speakingOrder[0])
    room.messages.push({
      id: generateId(),
      playerId: 'system',
      nickname: '시스템',
      message: `🎤 발언 시작! 첫 번째 발언자: ${firstSpeaker?.nickname}`,
      timestamp: Date.now(),
      type: 'system',
    })
  }

  return c.json({ success: true })
})

// --- Submit Speech ---
app.post('/api/rooms/:roomId/speak', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, message } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'speaking' && room.phase !== 'speaking2') return c.json({ error: '발언 단계가 아닙니다.' }, 400)

  const currentSpeakerId = room.speakingOrder[room.currentSpeakerIndex]
  if (currentSpeakerId !== playerId) return c.json({ error: '당신의 발언 차례가 아닙니다.' }, 400)

  const player = room.players.find(p => p.id === playerId)
  if (!player) return c.json({ error: '플레이어를 찾을 수 없습니다.' }, 404)

  room.messages.push({
    id: generateId(),
    playerId,
    nickname: player.nickname,
    message,
    timestamp: Date.now(),
    type: 'speak',
  })

  // Move to next speaker
  room.currentSpeakerIndex++
  room.version++
  room.lastActivity = Date.now()

  if (room.currentSpeakerIndex >= room.speakingOrder.length) {
    // All speakers done
    if (room.phase === 'speaking') {
      // Move to free chat
      room.phase = 'free_chat'
      room.phaseStartTime = Date.now()
      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: `💬 자유 토론 시간입니다! (${room.freeChatDuration / 60}분)`,
        timestamp: Date.now(),
        type: 'system',
      })
    } else {
      // speaking2 done -> final vote
      room.phase = 'final_vote'
      room.phaseStartTime = Date.now()
      room.votes = []
      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: '🗳️ 최종 투표를 시작합니다! 라이어라고 생각하는 사람을 지목해주세요.',
        timestamp: Date.now(),
        type: 'system',
      })
    }
    room.version++
  } else {
    const nextSpeaker = room.players.find(p => p.id === room.speakingOrder[room.currentSpeakerIndex])
    room.currentSpeakerStartTime = Date.now()
    room.messages.push({
      id: generateId(),
      playerId: 'system',
      nickname: '시스템',
      message: `🎤 다음 발언자: ${nextSpeaker?.nickname}`,
      timestamp: Date.now(),
      type: 'system',
    })
  }

  return c.json({ success: true })
})

// --- Chat (free chat phase) ---
app.post('/api/rooms/:roomId/chat', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, message } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  
  // Allow chat in free_chat, waiting phase, and vote phases
  const player = room.players.find(p => p.id === playerId)
  if (!player) return c.json({ error: '플레이어를 찾을 수 없습니다.' }, 404)

  room.messages.push({
    id: generateId(),
    playerId,
    nickname: player.nickname,
    message,
    timestamp: Date.now(),
    type: 'chat',
  })

  // Keep only last 200 messages
  if (room.messages.length > 200) {
    room.messages = room.messages.slice(-200)
  }

  room.version++
  room.lastActivity = Date.now()

  return c.json({ success: true })
})

// --- End free chat / Vote to extend ---
app.post('/api/rooms/:roomId/end-free-chat', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'free_chat') return c.json({ error: '자유 채팅 단계가 아닙니다.' }, 400)

  // Move to extend vote
  room.phase = 'vote_extend'
  room.phaseStartTime = Date.now()
  room.extendVotes = []
  room.version++

  room.messages.push({
    id: generateId(),
    playerId: 'system',
    nickname: '시스템',
    message: '⏰ 자유 토론이 종료되었습니다. 추가 토론이 필요한지 투표해주세요!',
    timestamp: Date.now(),
    type: 'system',
  })

  return c.json({ success: true })
})

// --- Vote extend ---
app.post('/api/rooms/:roomId/vote-extend', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, extend } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'vote_extend') return c.json({ error: '추가 토론 투표 단계가 아닙니다.' }, 400)

  // Remove previous vote
  room.extendVotes = room.extendVotes.filter(v => v.playerId !== playerId)
  room.extendVotes.push({ playerId, extend })
  room.version++

  // Check if all voted
  if (room.extendVotes.length >= room.players.length) {
    const extendCount = room.extendVotes.filter(v => v.extend).length
    const majority = Math.ceil(room.players.length / 2)

    if (extendCount >= majority) {
      // Extra round
      room.phase = 'speaking2'
      room.roundNumber = 2
      room.speakingOrder = shuffleArray(room.players.map(p => p.id))
      room.currentSpeakerIndex = 0
      room.currentSpeakerStartTime = Date.now()
      room.phaseStartTime = Date.now()

      const firstSpeaker = room.players.find(p => p.id === room.speakingOrder[0])
      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: `🔄 추가 토론이 결정되었습니다! 첫 번째 발언자: ${firstSpeaker?.nickname}`,
        timestamp: Date.now(),
        type: 'system',
      })
    } else {
      // Go to final vote
      room.phase = 'final_vote'
      room.phaseStartTime = Date.now()
      room.votes = []

      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: '🗳️ 최종 투표를 시작합니다! 라이어라고 생각하는 사람을 지목해주세요.',
        timestamp: Date.now(),
        type: 'system',
      })
    }
    room.version++
  }

  return c.json({ success: true })
})

// --- Final Vote ---
app.post('/api/rooms/:roomId/vote', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, targetId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'final_vote') return c.json({ error: '투표 단계가 아닙니다.' }, 400)

  // Remove previous vote
  room.votes = room.votes.filter(v => v.voterId !== playerId)
  room.votes.push({ voterId: playerId, targetId })
  room.version++

  // Check if all voted
  if (room.votes.length >= room.players.length) {
    // Count votes
    const voteCounts: Record<string, number> = {}
    room.votes.forEach(v => {
      voteCounts[v.targetId] = (voteCounts[v.targetId] || 0) + 1
    })

    // Find most voted
    let maxVotes = 0
    let mostVotedId = ''
    Object.entries(voteCounts).forEach(([id, count]) => {
      if (count > maxVotes) {
        maxVotes = count
        mostVotedId = id
      }
    })

    const mostVotedPlayer = room.players.find(p => p.id === mostVotedId)

    if (mostVotedId === room.liarId) {
      // Liar was caught! But liar gets a chance to guess the word
      room.phase = 'liar_guess'
      room.phaseStartTime = Date.now()
      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: `🎯 ${mostVotedPlayer?.nickname}님이 지목되었습니다! 라이어입니다! 하지만 제시어를 맞추면 라이어의 승리!`,
        timestamp: Date.now(),
        type: 'system',
      })
    } else {
      // Wrong person voted -> Liar wins
      const liarPlayer = room.players.find(p => p.id === room.liarId)
      room.phase = 'result'
      room.phaseStartTime = Date.now()
      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: `❌ ${mostVotedPlayer?.nickname}님이 지목되었지만 라이어가 아닙니다! 라이어는 ${liarPlayer?.nickname}님이었습니다. 🎉 라이어 승리!`,
        timestamp: Date.now(),
        type: 'system',
      })
    }
    room.version++
  }

  return c.json({ success: true })
})

// --- Liar Guess ---
app.post('/api/rooms/:roomId/liar-guess', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, guess } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.phase !== 'liar_guess') return c.json({ error: '라이어 추측 단계가 아닙니다.' }, 400)
  if (playerId !== room.liarId) return c.json({ error: '라이어만 제시어를 맞출 수 있습니다.' }, 403)

  room.liarGuess = guess
  const liarPlayer = room.players.find(p => p.id === room.liarId)

  if (guess.trim() === room.realWord.trim()) {
    // Liar guessed correctly -> Liar wins!
    room.messages.push({
      id: generateId(),
      playerId: 'system',
      nickname: '시스템',
      message: `🎉 라이어 ${liarPlayer?.nickname}님이 제시어 "${room.realWord}"을(를) 맞췄습니다! 라이어 승리!`,
      timestamp: Date.now(),
      type: 'system',
    })
  } else {
    room.messages.push({
      id: generateId(),
      playerId: 'system',
      nickname: '시스템',
      message: `✅ 라이어 ${liarPlayer?.nickname}님이 "${guess}"(을)를 제출했지만 틀렸습니다! 정답은 "${room.realWord}"! 시민 승리!`,
      timestamp: Date.now(),
      type: 'system',
    })
  }

  room.phase = 'result'
  room.phaseStartTime = Date.now()
  room.version++

  return c.json({ success: true })
})

// --- New Game (back to waiting) ---
app.post('/api/rooms/:roomId/new-game', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.hostId !== playerId) return c.json({ error: '방장만 새 게임을 시작할 수 있습니다.' }, 403)

  room.phase = 'waiting'
  room.realWord = ''
  room.liarWord = ''
  room.liarId = ''
  room.speakingOrder = []
  room.currentSpeakerIndex = 0
  room.votes = []
  room.extendVotes = []
  room.liarGuess = ''
  room.roundNumber = 1
  room.messages = []
  room.players.forEach(p => {
    p.ready = p.isHost
    p.isLiar = false
    p.word = ''
  })
  room.phaseStartTime = Date.now()
  room.version++
  room.lastActivity = Date.now()

  room.messages.push({
    id: generateId(),
    playerId: 'system',
    nickname: '시스템',
    message: '🔄 새로운 게임이 준비되었습니다!',
    timestamp: Date.now(),
    type: 'system',
  })

  return c.json({ success: true })
})

// --- Change Category ---
app.post('/api/rooms/:roomId/category', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, category } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.hostId !== playerId) return c.json({ error: '방장만 카테고리를 변경할 수 있습니다.' }, 403)
  if (room.phase !== 'waiting') return c.json({ error: '게임 중에는 변경할 수 없습니다.' }, 400)

  room.category = category
  room.version++

  return c.json({ success: true })
})

// --- Change Game Mode ---
app.post('/api/rooms/:roomId/game-mode', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId, gameMode } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)
  if (room.hostId !== playerId) return c.json({ error: '방장만 게임 모드를 변경할 수 있습니다.' }, 403)
  if (room.phase !== 'waiting') return c.json({ error: '게임 중에는 변경할 수 없습니다.' }, 400)

  room.gameMode = gameMode === 'fool' ? 'fool' : 'classic'
  room.version++

  return c.json({ success: true })
})

// --- Get Room State (Polling) ---
app.get('/api/rooms/:roomId/state', (c) => {
  const roomId = c.req.param('roomId')
  const playerId = c.req.query('playerId') || ''
  const sinceVersion = parseInt(c.req.query('v') || '0')

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)

  // Update player lastSeen
  const player = room.players.find(p => p.id === playerId)
  if (player) {
    player.lastSeen = Date.now()
  }

  // Auto-transition: free_chat timeout
  if (room.phase === 'free_chat') {
    const elapsed = (Date.now() - room.phaseStartTime) / 1000
    if (elapsed >= room.freeChatDuration) {
      room.phase = 'vote_extend'
      room.phaseStartTime = Date.now()
      room.extendVotes = []
      room.version++
      room.messages.push({
        id: generateId(),
        playerId: 'system',
        nickname: '시스템',
        message: '⏰ 자유 토론 시간이 종료되었습니다. 추가 토론 투표를 진행합니다.',
        timestamp: Date.now(),
        type: 'system',
      })
    }
  }

  // No change since last poll
  if (room.version <= sinceVersion) {
    return c.json({ changed: false, version: room.version })
  }

  // Build state for this player
  const currentSpeakerId = room.speakingOrder[room.currentSpeakerIndex] || ''

  // Vote results (only show when result phase)
  let voteResults: Record<string, number> | undefined
  if (room.phase === 'result' || room.phase === 'liar_guess') {
    voteResults = {}
    room.votes.forEach(v => {
      voteResults![v.targetId] = (voteResults![v.targetId] || 0) + 1
    })
  }

  const shouldRevealLiarRole =
    room.gameMode === 'classic' ||
    room.phase === 'liar_guess' ||
    room.phase === 'result'

  return c.json({
    changed: true,
    version: room.version,
    room: {
      id: room.id,
      name: room.name,
      hostId: room.hostId,
      maxPlayers: room.maxPlayers,
      phase: room.phase,
      gameMode: room.gameMode,
      category: room.category,
      roundNumber: room.roundNumber,
      speakingTimeLimit: room.speakingTimeLimit,
      freeChatDuration: room.freeChatDuration,
      phaseStartTime: room.phaseStartTime,
      currentSpeakerIndex: room.currentSpeakerIndex,
      currentSpeakerId,
      currentSpeakerStartTime: room.currentSpeakerStartTime,
      speakingOrder: room.speakingOrder,
      totalSpeakers: room.speakingOrder.length,
      voteCount: room.votes.length,
      extendVoteCount: room.extendVotes.length,
      totalPlayers: room.players.length,
      voteResults,
      liarId: (room.phase === 'result' || room.phase === 'liar_guess') ? room.liarId : undefined,
      realWord: (room.phase === 'result') ? room.realWord : undefined,
      liarWord: (room.phase === 'result') ? room.liarWord : undefined,
      liarGuess: room.phase === 'result' ? room.liarGuess : undefined,
    },
    myWord: player?.word || '',
    isLiar: shouldRevealLiarRole ? (player?.isLiar || false) : false,
    players: room.players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      ready: p.ready,
      isHost: p.isHost,
      isLiar: (room.phase === 'result' || room.phase === 'liar_guess') ? p.isLiar : undefined,
    })),
    messages: room.messages.slice(-100),
    myVote: room.votes.find(v => v.voterId === playerId)?.targetId,
    myExtendVote: room.extendVotes.find(v => v.playerId === playerId)?.extend,
    categories: Object.keys(EXPANDED_WORD_BANK),
  })
})

// --- Heartbeat ---
app.post('/api/rooms/:roomId/heartbeat', async (c) => {
  const roomId = c.req.param('roomId')
  const { playerId } = await c.req.json()

  const room = rooms.get(roomId)
  if (!room) return c.json({ error: '방을 찾을 수 없습니다.' }, 404)

  const player = room.players.find(p => p.id === playerId)
  if (player) {
    player.lastSeen = Date.now()
    room.lastActivity = Date.now()
  }

  return c.json({ success: true })
})

// ============================================================
// Frontend - Single Page Application
// ============================================================
app.get('/', (c) => {
  return c.html(getMainHTML())
})

function getMainHTML(): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>시멈비 라이어게임</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
<style>
:root {
  --slate-50: #f8fafc;
  --slate-100: #f1f5f9;
  --slate-200: #e2e8f0;
  --slate-300: #cbd5e1;
  --slate-400: #94a3b8;
  --slate-500: #64748b;
  --slate-600: #475569;
  --slate-700: #334155;
  --slate-800: #1e293b;
  --slate-900: #0f172a;
  --blue-50: #eff6ff;
  --blue-100: #dbeafe;
  --blue-200: #bfdbfe;
  --blue-300: #93c5fd;
  --blue-400: #60a5fa;
  --blue-500: #3b82f6;
  --blue-600: #2563eb;
  --blue-700: #1d4ed8;
  --red-400: #f87171;
  --red-500: #ef4444;
  --red-600: #dc2626;
  --green-400: #4ade80;
  --green-500: #22c55e;
  --green-600: #16a34a;
  --amber-400: #fbbf24;
  --amber-500: #f59e0b;
  --purple-500: #a855f7;
  --purple-600: #9333ea;
  --radius: 12px;
  --radius-lg: 16px;
  --radius-xl: 20px;
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
  background: linear-gradient(135deg, var(--slate-100) 0%, var(--blue-50) 50%, var(--slate-100) 100%);
  min-height: 100vh;
  color: var(--slate-800);
  -webkit-font-smoothing: antialiased;
}

/* ===== SCREENS ===== */
.screen { display: none; min-height: 100vh; }
.screen.active { display: flex; flex-direction: column; }

/* ===== LOBBY ===== */
#lobby-screen {
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lobby-container {
  width: 100%;
  max-width: 560px;
}

.logo-section {
  text-align: center;
  margin-bottom: 40px;
}

.logo-icon {
  width: 80px; height: 80px;
  background: linear-gradient(135deg, var(--blue-500), var(--purple-600));
  border-radius: var(--radius-xl);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  color: white;
  margin-bottom: 16px;
  box-shadow: 0 8px 24px rgba(59,130,246,0.3);
}

.logo-title {
  font-size: 32px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--slate-800), var(--blue-700));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}

.logo-subtitle {
  font-size: 14px;
  color: var(--slate-500);
  margin-top: 6px;
  font-weight: 400;
}

.card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--slate-200);
}

.card + .card { margin-top: 16px; }

.card-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--slate-700);
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title i { color: var(--blue-500); }

.input-group { margin-bottom: 14px; }
.input-group:last-child { margin-bottom: 0; }

.input-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--slate-500);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input, select {
  width: 100%;
  padding: 12px 16px;
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius);
  font-size: 15px;
  font-family: inherit;
  color: var(--slate-800);
  background: var(--slate-50);
  transition: all 0.2s;
  outline: none;
}

input:focus, select:focus {
  border-color: var(--blue-400);
  background: white;
  box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
}

input::placeholder { color: var(--slate-400); }

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.btn:active { transform: scale(0.97); }

.btn-primary {
  background: linear-gradient(135deg, var(--blue-500), var(--blue-600));
  color: white;
  box-shadow: 0 2px 8px rgba(59,130,246,0.3);
}
.btn-primary:hover { box-shadow: 0 4px 12px rgba(59,130,246,0.4); }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  background: var(--slate-100);
  color: var(--slate-700);
  border: 1.5px solid var(--slate-200);
}
.btn-secondary:hover { background: var(--slate-200); }

.btn-danger {
  background: linear-gradient(135deg, var(--red-500), var(--red-600));
  color: white;
  box-shadow: 0 2px 8px rgba(239,68,68,0.3);
}

.btn-success {
  background: linear-gradient(135deg, var(--green-500), var(--green-600));
  color: white;
  box-shadow: 0 2px 8px rgba(34,197,94,0.3);
}

.btn-amber {
  background: linear-gradient(135deg, var(--amber-400), var(--amber-500));
  color: var(--slate-800);
}

.btn-block { width: 100%; }

.btn-sm { padding: 8px 16px; font-size: 13px; }

.row { display: flex; gap: 10px; }
.row > * { flex: 1; }

/* Room List */
.room-list { max-height: 340px; overflow-y: auto; }
.room-list::-webkit-scrollbar { width: 4px; }
.room-list::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 4px; }

.room-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--slate-50);
}
.room-item:hover { border-color: var(--blue-300); background: var(--blue-50); }

.room-info { flex: 1; min-width: 0; }
.room-name { font-weight: 600; font-size: 15px; color: var(--slate-800); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.room-meta { font-size: 12px; color: var(--slate-500); margin-top: 3px; display: flex; gap: 10px; }

.room-players {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-600);
  padding: 4px 10px;
  background: var(--slate-200);
  border-radius: 20px;
  white-space: nowrap;
}

.room-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--slate-400);
  font-size: 14px;
}
.room-empty i { font-size: 32px; margin-bottom: 12px; display: block; color: var(--slate-300); }

.badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
}
.badge-blue { background: var(--blue-100); color: var(--blue-600); }
.badge-green { background: #dcfce7; color: var(--green-600); }
.badge-red { background: #fee2e2; color: var(--red-600); }
.badge-amber { background: #fef3c7; color: #b45309; }

/* ===== GAME ROOM ===== */
#game-screen {
  height: 100vh;
  overflow: hidden;
}

.game-header {
  background: white;
  border-bottom: 1px solid var(--slate-200);
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  box-shadow: var(--shadow-sm);
}

.game-header-left { display: flex; align-items: center; gap: 12px; }
.game-header-left .back-btn {
  width: 36px; height: 36px;
  border-radius: var(--radius);
  background: var(--slate-100);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--slate-600);
  font-size: 14px;
  transition: all 0.2s;
}
.game-header-left .back-btn:hover { background: var(--slate-200); }

.game-room-title { font-weight: 700; font-size: 16px; color: var(--slate-800); }
.game-phase-badge { margin-left: 8px; }

.game-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.game-sidebar {
  width: 240px;
  background: white;
  border-right: 1px solid var(--slate-200);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.sidebar-header {
  padding: 16px;
  font-size: 13px;
  font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid var(--slate-100);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.player-list { flex: 1; overflow-y: auto; padding: 8px; }

.player-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: var(--radius);
  margin-bottom: 4px;
  transition: background 0.15s;
}
.player-item:hover { background: var(--slate-50); }
.player-item.is-me { background: var(--blue-50); }
.player-item.is-speaking { background: #fef3c7; border: 1.5px solid var(--amber-400); }
.player-item.is-liar-reveal { background: #fee2e2; border: 1.5px solid var(--red-400); }

.player-avatar {
  width: 36px; height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 14px;
  color: white;
  flex-shrink: 0;
}

.player-details { flex: 1; min-width: 0; }
.player-nick {
  font-weight: 600;
  font-size: 14px;
  color: var(--slate-800);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.player-role { font-size: 11px; color: var(--slate-500); }

.player-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.player-kick-btn {
  border: none;
  border-radius: 999px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 700;
  color: white;
  background: var(--red-500);
  cursor: pointer;
  flex-shrink: 0;
}

.player-kick-btn:hover {
  background: var(--red-600);
}

.player-status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 20px;
  white-space: nowrap;
}

.status-ready { background: #dcfce7; color: var(--green-600); }
.status-not-ready { background: var(--slate-100); color: var(--slate-400); }
.status-host { background: var(--amber-400); color: var(--slate-800); }
.status-speaking { background: var(--amber-400); color: var(--slate-800); animation: pulse 1.5s infinite; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--slate-100);
}

/* Main Content Area */
.game-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--slate-50);
}

.game-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

/* Word Reveal Card */
.word-reveal-card {
  max-width: 400px;
  margin: 40px auto;
  text-align: center;
}

.word-card {
  background: white;
  border-radius: var(--radius-xl);
  padding: 40px 32px;
  box-shadow: var(--shadow-xl);
  border: 2px solid var(--slate-200);
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  overflow: hidden;
}

.word-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--blue-500), var(--purple-500));
}

.word-card.revealed { cursor: default; }

.word-card-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 16px;
}

.word-card-word {
  font-size: 36px;
  font-weight: 800;
  color: var(--slate-800);
  margin-bottom: 8px;
  letter-spacing: -0.5px;
  min-height: 1.3em;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.word-card-category {
  font-size: 13px;
  color: var(--slate-400);
}

.word-card-hidden {
  font-size: 48px;
  color: var(--slate-300);
  margin-bottom: 12px;
}

.word-card-hint {
  font-size: 13px;
  color: var(--slate-400);
  margin-top: 12px;
}

/* Speaking Phase */
.speaking-area {
  max-width: 600px;
  margin: 0 auto;
}

.speaking-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.speaking-dot {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: var(--slate-200);
  color: var(--slate-500);
  transition: all 0.3s;
}
.speaking-dot.done { background: var(--green-500); color: white; }
.speaking-dot.current { background: var(--blue-500); color: white; box-shadow: 0 0 0 4px rgba(59,130,246,0.2); }

.current-speaker-card {
  background: white;
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-md);
  text-align: center;
  margin-bottom: 20px;
}

.speaker-name {
  font-size: 22px;
  font-weight: 700;
  color: var(--slate-800);
  margin-bottom: 8px;
}

.speaker-prompt {
  font-size: 14px;
  color: var(--slate-500);
}

.speak-input-area {
  background: white;
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-md);
}

.speak-input-area textarea {
  width: 100%;
  padding: 14px;
  border: 1.5px solid var(--slate-200);
  border-radius: var(--radius);
  font-size: 15px;
  font-family: inherit;
  resize: none;
  height: 100px;
  outline: none;
  background: var(--slate-50);
  color: var(--slate-800);
}

.speak-input-area textarea:focus {
  border-color: var(--blue-400);
  background: white;
}

/* Timer */
.timer-display {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: var(--slate-800);
  color: white;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.timer-display.warning { background: var(--red-500); }

/* Chat Area */
.chat-section {
  border-top: 1px solid var(--slate-200);
  flex-shrink: 0;
  background: white;
  display: flex;
  flex-direction: column;
  height: 220px;
  position: relative;
}

/* Desktop Drag Resizer */
.chat-resize-handle {
  position: absolute;
  top: -5px; left: 0; right: 0;
  height: 10px;
  cursor: ns-resize;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-resize-handle::after {
  content: '';
  width: 40px;
  height: 4px;
  background: var(--slate-300);
  border-radius: 2px;
  transition: background 0.2s;
}
.chat-resize-handle:hover::after,
.chat-resize-handle.dragging::after {
  background: var(--blue-400);
}

/* Speaking Summary Panel (shown in vote/discussion phases) */
.speaking-summary {
  background: var(--slate-50);
  border-bottom: 1px solid var(--slate-200);
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 16px;
}
.speaking-summary-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--slate-500);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.speaking-summary-item {
  background: white;
  border-left: 3px solid var(--blue-400);
  padding: 8px 12px;
  border-radius: 0 var(--radius) var(--radius) 0;
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.5;
}
.speaking-summary-item .summary-nick {
  font-weight: 700;
  color: var(--blue-600);
  font-size: 12px;
  margin-bottom: 2px;
}
.speaking-summary-item .summary-text {
  color: var(--slate-700);
  word-break: break-word;
}

/* Mobile Tab Switcher for game content / chat */
.mobile-view-tabs {
  display: none;
  position: fixed;
  bottom: 60px;
  left: 0; right: 0;
  background: white;
  border-top: 1px solid var(--slate-200);
  z-index: 99;
  padding: 0;
}
.mobile-view-tabs-inner {
  display: flex;
}
.mobile-view-tab {
  flex: 1;
  padding: 10px 0;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-500);
  background: none;
  border: none;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.mobile-view-tab.active {
  color: var(--blue-600);
}
.mobile-view-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0; left: 20%; right: 20%;
  height: 3px;
  background: var(--blue-500);
  border-radius: 3px 3px 0 0;
}
.mobile-view-tab .unread-dot {
  width: 8px; height: 8px;
  background: var(--red-500);
  border-radius: 50%;
  display: none;
}
.mobile-view-tab .unread-dot.show {
  display: inline-block;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 16px;
}

.chat-msg {
  margin-bottom: 6px;
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
}

.chat-msg .nick {
  font-weight: 700;
  margin-right: 6px;
}

.chat-msg.system {
  color: var(--slate-500);
  font-style: italic;
  padding: 4px 10px;
  background: var(--slate-50);
  border-radius: var(--radius);
  font-size: 12px;
}

.chat-msg.speak-msg {
  background: var(--blue-50);
  border-left: 3px solid var(--blue-400);
  padding: 8px 12px;
  border-radius: 0 var(--radius) var(--radius) 0;
}

.chat-input-area {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  border-top: 1px solid var(--slate-100);
}

.chat-input-area input {
  flex: 1;
  padding: 10px 14px;
  font-size: 14px;
}

.chat-input-area button {
  padding: 10px 18px;
  background: var(--blue-500);
  color: white;
  border: none;
  border-radius: var(--radius);
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
  font-size: 13px;
}
.chat-input-area button:hover { background: var(--blue-600); }

/* Vote Area */
.vote-area {
  max-width: 500px;
  margin: 0 auto;
}

.vote-title {
  text-align: center;
  font-size: 20px;
  font-weight: 700;
  color: var(--slate-800);
  margin-bottom: 8px;
}

.vote-subtitle {
  text-align: center;
  font-size: 14px;
  color: var(--slate-500);
  margin-bottom: 24px;
}

.vote-option {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 2px solid var(--slate-200);
  border-radius: var(--radius);
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;
}
.vote-option:hover { border-color: var(--blue-300); background: var(--blue-50); }
.vote-option.selected { border-color: var(--blue-500); background: var(--blue-50); box-shadow: 0 0 0 2px rgba(59,130,246,0.15); }
.vote-option.disabled { cursor: default; opacity: 0.7; }

.vote-option .player-avatar { width: 40px; height: 40px; font-size: 15px; }
.vote-option .vote-nick { font-weight: 600; font-size: 15px; flex: 1; }
.vote-option .vote-count { font-weight: 700; font-size: 18px; color: var(--blue-500); }

/* Results */
.result-card {
  max-width: 480px;
  margin: 20px auto;
  text-align: center;
  background: white;
  border-radius: var(--radius-xl);
  padding: 40px 32px;
  box-shadow: var(--shadow-xl);
}

.result-icon { font-size: 56px; margin-bottom: 16px; }
.result-title { font-size: 24px; font-weight: 800; margin-bottom: 12px; }
.result-detail { font-size: 15px; color: var(--slate-600); line-height: 1.7; margin-bottom: 24px; }

.result-word-box {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--slate-50);
  border-radius: var(--radius);
  margin-bottom: 24px;
  border: 1.5px solid var(--slate-200);
}
.result-word-label { font-size: 12px; font-weight: 600; color: var(--slate-500); text-transform: uppercase; }
.result-word-value { font-size: 20px; font-weight: 800; color: var(--slate-800); }

/* Liar Guess */
.guess-area {
  max-width: 440px;
  margin: 40px auto;
  text-align: center;
}
.guess-title { font-size: 22px; font-weight: 700; margin-bottom: 8px; }
.guess-subtitle { font-size: 14px; color: var(--slate-500); margin-bottom: 24px; }

.guess-input-area {
  background: white;
  border-radius: var(--radius-lg);
  padding: 28px;
  box-shadow: var(--shadow-lg);
}

/* Extend Vote */
.extend-vote-area {
  max-width: 440px;
  margin: 40px auto;
  text-align: center;
}

.extend-btns {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
}

.extend-btn {
  padding: 16px 32px;
  border: 2px solid var(--slate-200);
  border-radius: var(--radius);
  background: white;
  cursor: pointer;
  font-size: 16px;
  font-weight: 700;
  font-family: inherit;
  transition: all 0.2s;
  min-width: 140px;
}
.extend-btn:hover { border-color: var(--blue-400); }
.extend-btn.selected { border-color: var(--blue-500); background: var(--blue-50); }
.extend-btn.selected-yes { border-color: var(--green-500); background: #dcfce7; }
.extend-btn.selected-no { border-color: var(--red-500); background: #fee2e2; }

/* Waiting Phase */
.waiting-area {
  max-width: 500px;
  margin: 20px auto;
  text-align: center;
}

.waiting-info {
  background: white;
  border-radius: var(--radius-lg);
  padding: 32px;
  box-shadow: var(--shadow-md);
  margin-bottom: 20px;
}

.waiting-info h3 {
  font-size: 18px;
  font-weight: 700;
  color: var(--slate-800);
  margin-bottom: 8px;
}

.waiting-info p {
  font-size: 14px;
  color: var(--slate-500);
}

.category-selector {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin: 16px 0;
}

.category-chip {
  padding: 8px 16px;
  border: 1.5px solid var(--slate-200);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
  color: var(--slate-600);
}
.category-chip:hover { border-color: var(--blue-300); }
.category-chip.active { background: var(--blue-500); color: white; border-color: var(--blue-500); }

/* Color palette for avatars */
.av-0 { background: #3b82f6; }
.av-1 { background: #8b5cf6; }
.av-2 { background: #ec4899; }
.av-3 { background: #f59e0b; }
.av-4 { background: #10b981; }
.av-5 { background: #ef4444; }
.av-6 { background: #6366f1; }
.av-7 { background: #14b8a6; }
.av-8 { background: #f97316; }
.av-9 { background: #06b6d4; }

/* ===== MOBILE ACTION BAR (floating bottom bar) ===== */
.mobile-action-bar {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  padding: 10px 16px;
  padding-bottom: max(10px, env(safe-area-inset-bottom));
  background: white;
  border-top: 1px solid var(--slate-200);
  box-shadow: 0 -4px 12px rgba(0,0,0,0.08);
  z-index: 100;
}

/* ===== MOBILE PLAYER TOGGLE ===== */
.mobile-player-toggle {
  display: none;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: white;
  border-bottom: 1px solid var(--slate-200);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--slate-600);
  -webkit-tap-highlight-color: transparent;
}
.mobile-player-toggle i.toggle-arrow { transition: transform 0.2s; }
.mobile-player-toggle.collapsed i.toggle-arrow { transform: rotate(-90deg); }

/* ===== MOBILE CHAT TOGGLE (deprecated - replaced by tabs) ===== */
.mobile-chat-toggle {
  display: none;
}

/* ===== RESPONSIVE ===== */
@media (max-width: 768px) {
  #game-screen { height: 100vh; height: 100dvh; }

  .game-header { padding: 8px 12px; }
  .game-room-title { font-size: 14px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .game-phase-badge { font-size: 10px; padding: 2px 6px; }

  .game-body { flex-direction: column; }

  /* Sidebar becomes collapsible */
  .game-sidebar {
    width: 100%;
    border-right: none;
    flex-shrink: 0;
    overflow: hidden;
  }
  .game-sidebar .sidebar-header { display: none; }
  .game-sidebar .player-list {
    display: flex;
    overflow-x: auto;
    padding: 6px 12px;
    gap: 4px;
    max-height: 200px;
    transition: max-height 0.3s ease, padding 0.3s ease, opacity 0.3s ease;
  }
  .game-sidebar .player-list.collapsed {
    max-height: 0;
    padding-top: 0;
    padding-bottom: 0;
    opacity: 0;
    pointer-events: none;
  }
  .player-item {
    min-width: 110px;
    flex-shrink: 0;
    margin-bottom: 0;
    padding: 6px 8px;
    gap: 6px;
  }
  .player-avatar { width: 28px; height: 28px; font-size: 12px; }
  .player-nick { font-size: 12px; }
  .player-status { font-size: 10px; padding: 1px 6px; }

  /* Hide desktop sidebar footer - we use mobile-action-bar instead */
  .sidebar-footer { display: none; }

  /* Show mobile-only elements */
  .mobile-action-bar { display: block; }
  .mobile-player-toggle { display: flex; }
  .mobile-view-tabs { display: block; }

  /* Hide desktop chat resize handle on mobile */
  .chat-resize-handle { display: none; }

  /* Main content area fills remaining space */
  .game-main { flex: 1; min-height: 0; }
  .game-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    padding-bottom: 120px; /* space for tab bar + action bar */
  }

  /* Chat section - mobile mode (full screen overlay) */
  .chat-section {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    height: auto !important;
    z-index: 95;
    display: none;
    flex-direction: column;
  }
  .chat-section.mobile-visible {
    display: flex;
  }
  .chat-section .chat-messages {
    flex: 1;
    max-height: none;
    padding-top: 12px;
    padding-bottom: 150px; /* space for input + tabs + action bar */
  }
  .chat-section .chat-input-area {
    position: fixed;
    bottom: 105px;
    left: 0; right: 0;
    padding: 8px 12px;
    background: white;
    border-top: 1px solid var(--slate-100);
    z-index: 96;
  }
  .chat-section #speaking-summary-container { display: none; }
  .chat-input-area input { padding: 8px 10px; font-size: 13px; }
  .chat-input-area button { padding: 8px 12px; font-size: 12px; }

  /* Speaking summary on mobile */
  .speaking-summary {
    max-height: 150px;
    padding: 8px 12px;
  }
  .speaking-summary-item { padding: 6px 10px; font-size: 12px; }

  /* Content adjustments */
  .waiting-area { margin: 8px auto; }
  .waiting-info { padding: 20px; margin-bottom: 12px; }
  .waiting-info h3 { font-size: 16px; }
  .word-reveal-card { margin: 16px auto; }
  .word-card { padding: 24px 20px; }
  .word-card-word { font-size: 28px; }
  .word-card-hidden { font-size: 36px; }
  .speaking-area { padding: 0; }
  .current-speaker-card { padding: 16px; }
  .speaker-name { font-size: 18px; }
  .speak-input-area { padding: 12px; }
  .speak-input-area textarea { height: 70px; font-size: 14px; }
  .speaking-dot { width: 26px; height: 26px; font-size: 11px; }
  .vote-area { padding: 0; }
  .vote-option { padding: 10px 12px; }
  .vote-option .player-avatar { width: 32px; height: 32px; font-size: 13px; }
  .vote-option .vote-nick { font-size: 14px; }
  .result-card { padding: 24px 16px; margin: 8px auto; }
  .result-icon { font-size: 40px; margin-bottom: 10px; }
  .result-title { font-size: 20px; }
  .result-word-box { padding: 10px 16px; gap: 8px; flex-wrap: wrap; justify-content: center; }
  .result-word-value { font-size: 17px; }
  .extend-vote-area { margin: 16px auto; }
  .extend-btns { flex-direction: column; gap: 8px; }
  .extend-btn { min-width: auto; padding: 14px 24px; }
  .guess-area { margin: 16px auto; }
  .guess-input-area { padding: 20px; }
  .category-chip { padding: 6px 12px; font-size: 12px; }

  /* Lobby */
  .logo-section { margin-bottom: 24px; }
  .logo-icon { width: 60px; height: 60px; font-size: 28px; }
  .logo-title { font-size: 26px; }
  .logo-subtitle { font-size: 13px; }
  .card { padding: 20px; }
}

/* Overlay / Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: var(--radius-xl);
  padding: 32px;
  max-width: 420px;
  width: 90%;
  box-shadow: var(--shadow-xl);
}

.modal-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
  color: var(--slate-800);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-in { animation: fadeIn 0.3s ease; }

/* Scrollbar */
::-webkit-scrollbar { width: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--slate-300); border-radius: 10px; }
::-webkit-scrollbar-thumb:hover { background: var(--slate-400); }

/* Toast */
.toast {
  position: fixed;
  top: 20px;
  right: 20px;
  padding: 12px 20px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  z-index: 2000;
  animation: slideIn 0.3s ease;
  box-shadow: var(--shadow-lg);
}
.toast-error { background: var(--red-500); color: white; }
.toast-success { background: var(--green-500); color: white; }
.toast-info { background: var(--blue-500); color: white; }

@keyframes slideIn {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
</style>
</head>
<body>

<!-- ===== LOBBY SCREEN ===== -->
<div id="lobby-screen" class="screen active">
  <div class="lobby-container">
    <div class="logo-section">
      <div class="logo-icon"><i class="fas fa-mask"></i></div>
      <div class="logo-title">시멈비 라이어게임</div>
      <div class="logo-subtitle">거짓말쟁이를 찾아라! 최대 10명과 함께하는 실시간 추리 게임</div>
    </div>

    <div class="card" id="nickname-card">
      <div class="card-title"><i class="fas fa-user"></i> 닉네임 설정</div>
      <div class="input-group">
        <input type="text" id="nickname-input" placeholder="닉네임을 입력하세요 (2~8자)" maxlength="8" autocomplete="off">
      </div>
      <button class="btn btn-primary btn-block" id="set-nickname-btn">
        <i class="fas fa-arrow-right"></i> 입장하기
      </button>
    </div>

    <div id="lobby-content" style="display:none">
      <div class="card">
        <div class="card-title">
          <i class="fas fa-plus-circle"></i> 방 만들기
        </div>
        <div class="input-group">
          <input type="text" id="room-name-input" placeholder="방 이름" maxlength="20" autocomplete="off">
        </div>
        <div class="row">
          <div class="input-group">
            <label class="input-label">카테고리</label>
            <select id="category-select">
              <option value="음식">🍕 음식</option>
              <option value="동물">🐾 동물</option>
              <option value="장소">📍 장소</option>
              <option value="직업">💼 직업</option>
              <option value="영화/드라마">🎬 영화/드라마</option>
              <option value="스포츠">⚽ 스포츠</option>
              <option value="가전제품">📺 가전제품</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">게임 모드</label>
            <select id="game-mode-select">
              <option value="classic" selected>기본 라이어</option>
              <option value="fool">바보 라이어</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">최대 인원</label>
            <select id="max-players-select">
              <option value="4">4명</option>
              <option value="5">5명</option>
              <option value="6" selected>6명</option>
              <option value="7">7명</option>
              <option value="8">8명</option>
              <option value="9">9명</option>
              <option value="10">10명</option>
            </select>
          </div>
        </div>
        <button class="btn btn-primary btn-block" id="create-room-btn">
          <i class="fas fa-door-open"></i> 방 만들기
        </button>
      </div>

      <div class="card">
        <div class="card-title" style="justify-content: space-between;">
          <span><i class="fas fa-list"></i> 게임방 목록</span>
          <button class="btn btn-sm btn-secondary" id="refresh-rooms-btn">
            <i class="fas fa-sync-alt"></i>
          </button>
        </div>
        <div class="room-list" id="room-list">
          <div class="room-empty">
            <i class="fas fa-ghost"></i>
            아직 만들어진 방이 없습니다
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ===== GAME SCREEN ===== -->
<div id="game-screen" class="screen">
  <div class="game-header">
    <div class="game-header-left">
      <button class="back-btn" id="leave-room-btn" title="나가기"><i class="fas fa-arrow-left"></i></button>
      <span class="game-room-title" id="game-room-name">방 이름</span>
      <span class="game-phase-badge badge badge-blue" id="game-phase-label">대기중</span>
    </div>
    <div>
      <span class="timer-display" id="game-timer" style="display:none">
        <i class="fas fa-clock"></i> <span id="timer-text">0:00</span>
      </span>
    </div>
  </div>

  <div class="game-body">
    <aside class="game-sidebar">
      <div class="sidebar-header">
        <span>플레이어</span>
        <span id="player-count">0/6</span>
      </div>
      <!-- Mobile: collapsible player toggle -->
      <div class="mobile-player-toggle" id="mobile-player-toggle" onclick="togglePlayerList()">
        <span><i class="fas fa-users" style="margin-right:6px"></i> 플레이어 <span id="mobile-player-count">0/6</span></span>
        <i class="fas fa-chevron-down toggle-arrow"></i>
      </div>
      <div class="player-list" id="player-list"></div>
      <div class="sidebar-footer" id="sidebar-footer"></div>
    </aside>

    <div class="game-main">
      <div class="game-content" id="game-content">
        <!-- Dynamic content goes here -->
      </div>
      <!-- Mobile: view tab switcher -->
      <div class="mobile-view-tabs" id="mobile-view-tabs">
        <div class="mobile-view-tabs-inner">
          <button class="mobile-view-tab active" id="tab-game" onclick="switchMobileTab('game')">
            <i class="fas fa-gamepad"></i> 게임
          </button>
          <button class="mobile-view-tab" id="tab-chat" onclick="switchMobileTab('chat')">
            <i class="fas fa-comments"></i> 채팅 <span class="unread-dot" id="chat-unread-dot"></span>
          </button>
        </div>
      </div>
      <div class="chat-section" id="chat-section">
        <div class="chat-resize-handle" id="chat-resize-handle"></div>
        <div id="speaking-summary-container"></div>
        <div class="chat-messages" id="chat-messages"></div>
        <div class="chat-input-area">
          <input type="text" id="chat-input" placeholder="메시지를 입력하세요..." maxlength="200" autocomplete="off">
          <button id="chat-send-btn">전송</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Mobile: fixed bottom action bar -->
  <div class="mobile-action-bar" id="mobile-action-bar"></div>
</div>

<!-- ===== MODAL ===== -->
<div class="modal-overlay" id="modal-overlay" style="display:none">
  <div class="modal" id="modal-content"></div>
</div>

<script>
// ============================================================
// CLIENT STATE & CONFIG
// ============================================================
const API = '';
let state = {
  nickname: localStorage.getItem('liar_nickname') || '',
  playerId: localStorage.getItem('liar_playerId') || '',
  roomId: null,
  pollInterval: null,
  version: 0,
  roomData: null,
  lastPhase: null,
  wordRevealed: false,
  mobileTab: 'game', // 'game' or 'chat'
  chatUnread: false,
};

const avatarColors = ['av-0','av-1','av-2','av-3','av-4','av-5','av-6','av-7','av-8','av-9'];

function $(id) { return document.getElementById(id); }
function show(el) { el.style.display = ''; }
function hide(el) { el.style.display = 'none'; }

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = 'info') {
  const t = document.createElement('div');
  t.className = 'toast toast-' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; setTimeout(() => t.remove(), 300); }, 3000);
}

// ============================================================
// API HELPERS
// ============================================================
async function api(path, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) {
    toast(data.error || '오류가 발생했습니다.', 'error');
    throw new Error(data.error);
  }
  return data;
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ============================================================
// LOBBY
// ============================================================
async function loadRooms() {
  try {
    const data = await api('/api/rooms');
    renderRoomList(data.rooms);
  } catch(e) { console.error(e); }
}

function renderRoomList(rooms) {
  const el = $('room-list');
  if (!rooms.length) {
    el.innerHTML = '<div class="room-empty"><i class="fas fa-ghost"></i>아직 만들어진 방이 없습니다</div>';
    return;
  }
  el.innerHTML = rooms.map(r => {
    const isFull = r.playerCount >= r.maxPlayers;
    const isPlaying = r.phase !== 'waiting';
    let statusBadge = '';
    if (isPlaying) statusBadge = '<span class="badge badge-red">게임중</span>';
    else if (isFull) statusBadge = '<span class="badge badge-amber">만석</span>';
    else statusBadge = '<span class="badge badge-green">대기중</span>';
    return \`
      <div class="room-item" onclick="joinRoom('\${r.id}')" \${isFull || isPlaying ? 'style="opacity:0.5;pointer-events:none"' : ''}>
        <div class="room-info">
          <div class="room-name">\${esc(r.name)} \${statusBadge}</div>
          <div class="room-meta">
            <span><i class="fas fa-crown" style="color:#f59e0b"></i> \${esc(r.hostNickname)}</span>
            <span><i class="fas fa-tag"></i> \${esc(r.category)}</span>
          </div>
        </div>
        <div class="room-players">
          <i class="fas fa-users"></i>
          \${r.playerCount}/\${r.maxPlayers}
        </div>
      </div>
    \`;
  }).join('');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Set nickname
$('set-nickname-btn').onclick = () => {
  const nick = $('nickname-input').value.trim();
  if (nick.length < 2 || nick.length > 8) {
    toast('닉네임은 2~8자로 입력해주세요.', 'error');
    return;
  }
  state.nickname = nick;
  localStorage.setItem('liar_nickname', nick);
  hide($('nickname-card'));
  show($('lobby-content'));
  loadRooms();
  toast(\`\${nick}님 환영합니다!\`, 'success');
};

// Check saved nickname
if (state.nickname) {
  $('nickname-input').value = state.nickname;
}

// Create room
$('create-room-btn').onclick = async () => {
  const roomName = $('room-name-input').value.trim() || (state.nickname + '님의 방');
  const category = $('category-select').value;
  const gameMode = $('game-mode-select').value;
  const maxPlayers = parseInt($('max-players-select').value);
  try {
    const data = await api('/api/rooms', 'POST', {
      nickname: state.nickname,
      roomName,
      category,
      gameMode,
      maxPlayers,
    });
    state.roomId = data.roomId;
    state.playerId = data.playerId;
    localStorage.setItem('liar_playerId', state.playerId);
    enterGameScreen();
  } catch(e) { console.error(e); }
};

// Join room
async function joinRoom(roomId) {
  try {
    const data = await api(\`/api/rooms/\${roomId}/join\`, 'POST', { nickname: state.nickname });
    state.roomId = data.roomId;
    state.playerId = data.playerId;
    localStorage.setItem('liar_playerId', state.playerId);
    enterGameScreen();
  } catch(e) { console.error(e); }
}

// Refresh rooms
$('refresh-rooms-btn').onclick = loadRooms;

// ============================================================
// GAME ROOM
// ============================================================
function enterGameScreen() {
  showScreen('game-screen');
  state.version = 0;
  state.wordRevealed = false;
  state.mobileTab = 'game';
  state.chatUnread = false;
  // On mobile, start with game tab active
  if (window.innerWidth <= 768) {
    const list = $('player-list');
    const toggle = $('mobile-player-toggle');
    if (list) list.classList.add('collapsed');
    if (toggle) toggle.classList.add('collapsed');
    // Show game, hide chat
    switchMobileTab('game');
  }
  startPolling();
}

function leaveRoom() {
  stopPolling();
  if (state.roomId && state.playerId) {
    api(\`/api/rooms/\${state.roomId}/leave\`, 'POST', { playerId: state.playerId }).catch(() => {});
  }
  state.roomId = null;
  state.version = 0;
  state.roomData = null;
  showScreen('lobby-screen');
  loadRooms();
}

$('leave-room-btn').onclick = () => {
  if (confirm('정말 방을 나가시겠습니까?')) leaveRoom();
};

// ============================================================
// POLLING
// ============================================================
function startPolling() {
  stopPolling();
  pollState();
  state.pollInterval = setInterval(pollState, 1000);
}

function stopPolling() {
  if (state.pollInterval) clearInterval(state.pollInterval);
  state.pollInterval = null;
}

async function pollState() {
  if (!state.roomId) return;
  try {
    const prevPhase = state.lastPhase;
    const data = await api(\`/api/rooms/\${state.roomId}/state?playerId=\${state.playerId}&v=\${state.version}\`);
    if (data.error) { leaveRoom(); return; }
    if (!data.changed) {
      updateTimer();
      return;
    }
    state.version = data.version;
    state.roomData = data;
    state.lastPhase = data.room?.phase || null;
    const focusPhases = ['vote_extend', 'final_vote'];
    if (window.innerWidth <= 768 && focusPhases.includes(state.lastPhase) && state.lastPhase !== prevPhase) {
      switchMobileTab('game');
      toast('투표 단계가 시작되어 게임 화면으로 이동했습니다.', 'info');
    }
    renderGameState(data);
  } catch(e) {
    console.error('Poll error:', e);
  }
}

// ============================================================
// RENDER GAME STATE
// ============================================================
function renderGameState(data) {
  const { room, players, messages, myWord, isLiar, myVote, myExtendVote, categories } = data;

  // Header
  $('game-room-name').textContent = room.name;
  $('player-count').textContent = \`\${players.length}/\${room.maxPlayers}\`;

  // Phase badge
  const phaseLabels = {
    waiting: '대기중', word_reveal: '제시어 확인', speaking: '1차 발언',
    free_chat: '자유 토론', vote_extend: '추가 토론 투표',
    speaking2: '2차 발언', final_vote: '최종 투표',
    liar_guess: '라이어 추측', result: '결과'
  };
  $('game-phase-label').textContent = phaseLabels[room.phase] || room.phase;

  // Players sidebar
  renderPlayers(players, room);

  // Sidebar footer (host controls)
  renderSidebarFooter(room, players);

  // Main content
  renderMainContent(room, players, myWord, isLiar, myVote, myExtendVote, categories);

  // Chat
  renderChat(messages);

  // Timer
  updateTimer();
}

function renderPlayers(players, room) {
  const el = $('player-list');
  const isHost = room.hostId === state.playerId;
  el.innerHTML = players.map((p, i) => {
    let classes = 'player-item';
    if (p.id === state.playerId) classes += ' is-me';
    if (room.phase === 'speaking' || room.phase === 'speaking2') {
      if (p.id === room.currentSpeakerId) classes += ' is-speaking';
    }
    if ((room.phase === 'result' || room.phase === 'liar_guess') && p.isLiar) classes += ' is-liar-reveal';

    let statusHtml = '';
    if (room.phase === 'waiting') {
      if (p.isHost) statusHtml = '<span class="player-status status-host"><i class="fas fa-crown"></i> 방장</span>';
      else if (p.ready) statusHtml = '<span class="player-status status-ready">준비완료</span>';
      else statusHtml = '<span class="player-status status-not-ready">대기중</span>';
    } else if ((room.phase === 'speaking' || room.phase === 'speaking2') && p.id === room.currentSpeakerId) {
      statusHtml = '<span class="player-status status-speaking"><i class="fas fa-microphone"></i> 발언중</span>';
    } else if ((room.phase === 'result' || room.phase === 'liar_guess') && p.isLiar) {
      statusHtml = '<span class="player-status" style="background:#fee2e2;color:#dc2626"><i class="fas fa-mask"></i> 라이어</span>';
    }

    const initial = p.nickname.charAt(0);
    const roleText = p.id === state.playerId ? '(나)' : '';
    const canKick = room.phase === 'waiting' && isHost && !p.isHost && p.id !== state.playerId;
    const safeNickname = esc(p.nickname).replace(/"/g, '&quot;');
    const actionHtml = canKick
      ? '<button class="player-kick-btn" data-player-id="' + p.id + '" data-player-nickname="' + safeNickname + '" onclick="kickPlayerFromButton(this)">강퇴</button>'
      : '';

    return \`
      <div class="\${classes}">
        <div class="player-avatar \${avatarColors[i % 10]}">\${esc(initial)}</div>
        <div class="player-details">
          <div class="player-nick">\${esc(p.nickname)} \${roleText}</div>
        </div>
        <div class="player-actions">
          \${statusHtml}
          \${actionHtml}
        </div>
      </div>
    \`;
  }).join('');
}

function renderSidebarFooter(room, players) {
  const el = $('sidebar-footer');
  const mobileEl = $('mobile-action-bar');
  const isHost = room.hostId === state.playerId;
  const me = players.find(p => p.id === state.playerId);

  let btnHtml = '';

  if (room.phase === 'waiting') {
    if (isHost) {
      const allReady = players.every(p => p.isHost || p.ready);
      const canStart = allReady && players.length >= 3;
      btnHtml = \`
        <button class="btn btn-success btn-block" \${canStart ? '' : 'disabled'} onclick="startGame()">
          <i class="fas fa-play"></i> 게임 시작
        </button>
      \`;
    } else {
      const readyText = me?.ready ? '준비 취소' : '준비 완료';
      const readyClass = me?.ready ? 'btn-secondary' : 'btn-primary';
      btnHtml = \`
        <button class="btn \${readyClass} btn-block" onclick="toggleReady()">
          <i class="fas fa-check"></i> \${readyText}
        </button>
      \`;
    }
  } else if (room.phase === 'result' && isHost) {
    btnHtml = \`
      <button class="btn btn-primary btn-block" onclick="newGame()">
        <i class="fas fa-redo"></i> 새 게임
      </button>
    \`;
  }

  // Desktop sidebar footer
  el.innerHTML = btnHtml;
  // Mobile floating action bar
  if (mobileEl) mobileEl.innerHTML = btnHtml;

  // Update mobile player count
  const mpc = $('mobile-player-count');
  if (mpc) mpc.textContent = \`\${players.length}/\${room.maxPlayers}\`;
}

function renderMainContent(room, players, myWord, isLiar, myVote, myExtendVote, categories) {
  const el = $('game-content');

  switch (room.phase) {
    case 'waiting':
      renderWaiting(el, room, players, categories);
      break;
    case 'word_reveal':
      renderWordReveal(el, myWord, isLiar, room);
      break;
    case 'speaking':
    case 'speaking2':
      renderSpeaking(el, room, players);
      break;
    case 'free_chat':
      renderFreeChat(el, room);
      break;
    case 'vote_extend':
      renderExtendVote(el, room, myExtendVote);
      break;
    case 'final_vote':
      renderFinalVote(el, room, players, myVote);
      break;
    case 'liar_guess':
      renderLiarGuess(el, room, isLiar);
      break;
    case 'result':
      renderResult(el, room, players);
      break;
  }
}

// ===== PHASE RENDERERS =====

function renderWaiting(el, room, players, categories) {
  const isHost = room.hostId === state.playerId;
  const modeLabel = room.gameMode === 'fool' ? '바보 라이어' : '기본 라이어';

  el.innerHTML = \`
    <div class="waiting-area animate-in">
      <div class="waiting-info">
        <h3><i class="fas fa-hourglass-half" style="color:var(--blue-500)"></i> 플레이어를 기다리는 중...</h3>
        <p>최소 3명이 모이면 게임을 시작할 수 있습니다</p>
        <div style="margin-top:16px">
          <span class="badge badge-blue" style="font-size:13px;padding:6px 14px">
            <i class="fas fa-tag"></i> \${esc(room.category)}
          </span>
          <span class="badge badge-amber" style="font-size:13px;padding:6px 14px;margin-left:8px">
            <i class="fas fa-masks-theater"></i> \${esc(modeLabel)}
          </span>
        </div>
        \${isHost ? \`
        <div style="margin-top:20px">
          <div class="input-label" style="text-align:left;margin-bottom:8px">카테고리 변경</div>
          <div class="category-selector" id="cat-selector">
            \${(categories || []).map(c => \`
              <button class="category-chip \${c === room.category ? 'active' : ''}" onclick="changeCategory('\${c}')">\${esc(c)}</button>
            \`).join('')}
          </div>
          <div class="input-label" style="text-align:left;margin:16px 0 8px">게임 모드</div>
          <div class="category-selector">
            <button class="category-chip \${room.gameMode === 'classic' ? 'active' : ''}" onclick="changeGameMode('classic')">기본 라이어</button>
            <button class="category-chip \${room.gameMode === 'fool' ? 'active' : ''}" onclick="changeGameMode('fool')">바보 라이어</button>
          </div>
        </div>\` : ''}
      </div>
    </div>
  \`;
}

function renderWordReveal(el, myWord, isLiar, room) {
  const me = state.roomData.players.find(p => p.id === state.playerId);
  const confirmed = me?.ready;
  const displayWord = myWord && myWord.trim() ? myWord : '불러오는 중...';
  const knowsLiarRole = room.gameMode !== 'fool' || isLiar;
  const wordLabel = knowsLiarRole && isLiar ? '🎭 당신은 라이어입니다!' : '📋 당신의 제시어';
  const wordStyle = knowsLiarRole && isLiar ? 'color:var(--red-500)' : '';
  const liarHint = knowsLiarRole && isLiar
    ? '<div class="word-card-hint" style="color:var(--red-400);margin-top:12px">⚠️ 다른 사람들과 다른 단어가 주어졌습니다. 들키지 마세요!</div>'
    : room.gameMode === 'fool'
      ? '<div class="word-card-hint" style="margin-top:12px">💡 주어진 단어를 기준으로 자연스럽게 플레이해보세요.</div>'
      : '';

  if (state.wordRevealed || confirmed) {
    el.innerHTML = \`
      <div class="word-reveal-card animate-in">
        <div class="word-card revealed">
          <div class="word-card-label">\${isLiar ? '🎭 당신은 라이어입니다!' : '📋 당신의 제시어'}</div>
          <div class="word-card-word" style="\${isLiar ? 'color:var(--red-500)' : ''}">\${esc(myWord)}</div>
          <div class="word-card-category">카테고리: \${esc(room.category)}</div>
          \${isLiar ? '<div class="word-card-hint" style="color:var(--red-400);margin-top:12px">⚠️ 다른 사람들과 다른 단어가 주어졌습니다. 들키지 마세요!</div>' : ''}
        </div>
        \${!confirmed ? \`
          <button class="btn btn-primary btn-block" style="margin-top:16px" onclick="confirmWord()">
            <i class="fas fa-check"></i> 확인 완료
          </button>
        \` : \`
          <div style="margin-top:16px;color:var(--slate-500);font-size:14px">
            <i class="fas fa-spinner fa-spin"></i> 다른 플레이어를 기다리는 중...
          </div>
        \`}
      </div>
    \`;

    const labelEl = el.querySelector('.word-card-label');
    if (labelEl) labelEl.textContent = wordLabel;

    const wordEl = el.querySelector('.word-card-word');
    if (wordEl) {
      wordEl.textContent = displayWord;
      wordEl.setAttribute('style', wordStyle);
    }

    const existingHintEl = el.querySelector('.word-card-hint');
    if (liarHint) {
      if (existingHintEl) {
        existingHintEl.outerHTML = liarHint;
      } else {
        const cardEl = el.querySelector('.word-card.revealed');
        if (cardEl) cardEl.insertAdjacentHTML('beforeend', liarHint);
      }
    } else if (existingHintEl) {
      existingHintEl.remove();
    }
  } else {
    el.innerHTML = \`
      <div class="word-reveal-card animate-in">
        <div class="word-card" onclick="revealWord()">
          <div class="word-card-hidden"><i class="fas fa-eye-slash"></i></div>
          <div class="word-card-label">카드를 터치하여 제시어를 확인하세요</div>
          <div class="word-card-hint">다른 사람에게 보여주지 마세요!</div>
        </div>
      </div>
    \`;
  }
}

function renderSpeaking(el, room, players) {
  const currentSpeaker = players.find(p => p.id === room.currentSpeakerId);
  const isMyTurn = room.currentSpeakerId === state.playerId;
  const roundLabel = room.phase === 'speaking2' ? '2차' : '1차';

  // Progress dots
  const dots = room.speakingOrder.map((pid, i) => {
    const p = players.find(x => x.id === pid);
    let cls = 'speaking-dot';
    if (i < room.currentSpeakerIndex) cls += ' done';
    else if (i === room.currentSpeakerIndex) cls += ' current';
    return \`<div class="\${cls}" title="\${p ? esc(p.nickname) : ''}">\${i + 1}</div>\`;
  }).join('');

  el.innerHTML = \`
    <div class="speaking-area animate-in">
      <div style="text-align:center;margin-bottom:16px">
        <span class="badge badge-blue" style="font-size:13px;padding:6px 14px">\${roundLabel} 발언 - \${room.currentSpeakerIndex + 1}/\${room.totalSpeakers}</span>
      </div>
      <div class="speaking-progress">\${dots}</div>
      <div class="current-speaker-card">
        <div class="speaker-name">
          <i class="fas fa-microphone" style="color:var(--amber-500)"></i>
          \${currentSpeaker ? esc(currentSpeaker.nickname) : '???'}
        </div>
        <div class="speaker-prompt">제시어에 대해 설명해주세요</div>
      </div>
      \${isMyTurn ? \`
        <div class="speak-input-area">
          <textarea id="speak-textarea" placeholder="제시어에 대한 당신의 생각을 적어주세요..." autofocus></textarea>
          <button class="btn btn-primary btn-block" style="margin-top:12px" onclick="submitSpeech()">
            <i class="fas fa-paper-plane"></i> 발언 제출
          </button>
        </div>
      \` : \`
        <div style="text-align:center;color:var(--slate-500);font-size:14px;padding:20px">
          <i class="fas fa-hourglass-half"></i> \${currentSpeaker ? esc(currentSpeaker.nickname) : '???'}님의 발언을 기다리는 중...
        </div>
      \`}
    </div>
  \`;
}

function renderFreeChat(el, room) {
  const isHost = room.hostId === state.playerId;
  const elapsed = Math.floor((Date.now() - room.phaseStartTime) / 1000);
  const remaining = Math.max(0, room.freeChatDuration - elapsed);
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  // Get speaking messages for summary
  const speakMsgs = (state.roomData?.messages || []).filter(m => m.type === 'speak');
  let summaryHtml = '';
  if (speakMsgs.length > 0) {
    summaryHtml = '<div class="speaking-summary" style="margin-top:16px;border-radius:var(--radius)">';
    summaryHtml += '<div class="speaking-summary-title"><i class="fas fa-microphone"></i> 발언 요약</div>';
    speakMsgs.forEach(m => {
      summaryHtml += \`<div class="speaking-summary-item">
        <div class="summary-nick">\${esc(m.nickname)}</div>
        <div class="summary-text">\${esc(m.message)}</div>
      </div>\`;
    });
    summaryHtml += '</div>';
  }

  el.innerHTML = \`
    <div class="waiting-area animate-in">
      <div class="waiting-info">
        <h3><i class="fas fa-comments" style="color:var(--blue-500)"></i> 자유 토론 시간</h3>
        <p>채팅으로 자유롭게 의견을 나눠보세요!</p>
        <div style="margin-top:16px">
          <span class="timer-display" id="free-chat-timer">
            <i class="fas fa-clock"></i> \${mins}:\${String(secs).padStart(2,'0')}
          </span>
        </div>
        \${isHost ? \`
          <button class="btn btn-amber btn-block" style="margin-top:20px" onclick="endFreeChat()">
            <i class="fas fa-forward"></i> 토론 종료 (투표로 이동)
          </button>
        \` : ''}
      </div>
      \${summaryHtml}
    </div>
  \`;
}

function renderExtendVote(el, room, myExtendVote) {
  // Get speaking messages for summary
  const speakMsgs = (state.roomData?.messages || []).filter(m => m.type === 'speak');
  let summaryHtml = '';
  if (speakMsgs.length > 0) {
    summaryHtml = '<div class="speaking-summary" style="margin-top:16px;border-radius:var(--radius)">';
    summaryHtml += '<div class="speaking-summary-title"><i class="fas fa-microphone"></i> 발언 요약</div>';
    speakMsgs.forEach(m => {
      summaryHtml += \`<div class="speaking-summary-item">
        <div class="summary-nick">\${esc(m.nickname)}</div>
        <div class="summary-text">\${esc(m.message)}</div>
      </div>\`;
    });
    summaryHtml += '</div>';
  }

  el.innerHTML = \`
    <div class="extend-vote-area animate-in">
      <div class="waiting-info">
        <h3><i class="fas fa-vote-yea" style="color:var(--blue-500)"></i> 추가 토론 투표</h3>
        <p>추가 발언 라운드가 필요한가요?</p>
        <div style="margin-top:8px;color:var(--slate-500);font-size:13px">
          투표 현황: \${room.extendVoteCount}/\${room.totalPlayers}
        </div>
        <div class="extend-btns">
          <button class="extend-btn \${myExtendVote === true ? 'selected-yes' : ''}" onclick="voteExtend(true)">
            <i class="fas fa-check" style="color:var(--green-500)"></i><br>필요해요
          </button>
          <button class="extend-btn \${myExtendVote === false ? 'selected-no' : ''}" onclick="voteExtend(false)">
            <i class="fas fa-times" style="color:var(--red-500)"></i><br>바로 투표
          </button>
        </div>
      </div>
      \${summaryHtml}
    </div>
  \`;
}

function renderFinalVote(el, room, players, myVote) {
  const others = players.filter(p => p.id !== state.playerId);

  // Get speaking messages for summary
  const speakMsgs = (state.roomData?.messages || []).filter(m => m.type === 'speak');
  let summaryHtml = '';
  if (speakMsgs.length > 0) {
    summaryHtml = '<div class="speaking-summary" style="margin-bottom:16px;border-radius:var(--radius)">';
    summaryHtml += '<div class="speaking-summary-title"><i class="fas fa-microphone"></i> 발언 요약</div>';
    speakMsgs.forEach(m => {
      summaryHtml += \`<div class="speaking-summary-item">
        <div class="summary-nick">\${esc(m.nickname)}</div>
        <div class="summary-text">\${esc(m.message)}</div>
      </div>\`;
    });
    summaryHtml += '</div>';
  }

  el.innerHTML = \`
    <div class="vote-area animate-in">
      <div class="vote-title"><i class="fas fa-user-secret"></i> 라이어를 지목하세요!</div>
      <div class="vote-subtitle">투표 현황: \${room.voteCount}/\${room.totalPlayers}</div>
      \${summaryHtml}
      \${others.map((p, i) => {
        const selected = myVote === p.id;
        return \`
          <div class="vote-option \${selected ? 'selected' : ''}" onclick="voteLiar('\${p.id}')">
            <div class="player-avatar \${avatarColors[players.indexOf(p) % 10]}">\${esc(p.nickname.charAt(0))}</div>
            <div class="vote-nick">\${esc(p.nickname)}</div>
            \${selected ? '<i class="fas fa-check-circle" style="color:var(--blue-500);font-size:20px"></i>' : ''}
          </div>
        \`;
      }).join('')}
      \${myVote ? \`<div style="text-align:center;margin-top:16px;color:var(--slate-500);font-size:13px"><i class="fas fa-spinner fa-spin"></i> 다른 플레이어의 투표를 기다리는 중...</div>\` : ''}
    </div>
  \`;
}

function renderLiarGuess(el, room, isLiar) {
  if (isLiar) {
    el.innerHTML = \`
      <div class="guess-area animate-in">
        <div class="guess-title"><i class="fas fa-lightbulb" style="color:var(--amber-500)"></i> 마지막 기회!</div>
        <div class="guess-subtitle">정답 제시어를 맞추면 라이어의 승리입니다</div>
        <div class="guess-input-area">
          <div class="input-group">
            <input type="text" id="guess-input" placeholder="제시어를 입력하세요..." autofocus>
          </div>
          <button class="btn btn-primary btn-block" onclick="submitGuess()">
            <i class="fas fa-paper-plane"></i> 제출
          </button>
        </div>
      </div>
    \`;
  } else {
    const liar = state.roomData.players.find(p => p.id === room.liarId);
    el.innerHTML = \`
      <div class="waiting-area animate-in">
        <div class="waiting-info">
          <h3><i class="fas fa-mask" style="color:var(--red-500)"></i> 라이어 발견!</h3>
          <p>\${liar ? esc(liar.nickname) : '???'}님이 라이어였습니다!</p>
          <p style="margin-top:8px">라이어가 제시어를 맞추는 중...</p>
          <div style="margin-top:16px;color:var(--slate-400);font-size:13px"><i class="fas fa-spinner fa-spin"></i></div>
        </div>
      </div>
    \`;
  }
}

function renderResult(el, room, players) {
  const liar = players.find(p => p.id === room.liarId);
  const liarGuess = room.liarGuess;
  const liarCaught = room.voteResults && room.voteResults[room.liarId] > 0;
  const guessCorrect = liarGuess && liarGuess.trim() === room.realWord?.trim();

  let liarWon = false;
  // Liar wins if: not caught OR (caught but guessed correctly)
  if (!liarCaught || guessCorrect) liarWon = true;

  // Find who was voted most
  let maxVotes = 0, mostVotedId = '';
  if (room.voteResults) {
    Object.entries(room.voteResults).forEach(([id, cnt]) => {
      if (cnt > maxVotes) { maxVotes = cnt; mostVotedId = id; }
    });
  }

  const isMe = state.playerId === room.liarId;
  const icon = liarWon
    ? (isMe ? '🎉' : '😱')
    : (isMe ? '😭' : '🎊');
  const title = liarWon
    ? '라이어 승리!'
    : '시민 승리!';

  let detailHtml = '';
  if (!liarCaught) {
    const wrongPerson = players.find(p => p.id === mostVotedId);
    detailHtml = \`<p>\${wrongPerson ? esc(wrongPerson.nickname) : '???'}님이 지목되었지만 라이어가 아니었습니다!</p>
    <p><strong>라이어: \${liar ? esc(liar.nickname) : '???'}</strong></p>\`;
  } else if (guessCorrect) {
    detailHtml = \`<p>라이어 \${liar ? esc(liar.nickname) : '???'}님이 지목당했지만</p>
    <p>제시어 "<strong>\${esc(room.realWord)}</strong>"를 맞췄습니다!</p>\`;
  } else {
    detailHtml = \`<p>라이어 \${liar ? esc(liar.nickname) : '???'}님이 지목당하고</p>
    <p>제시어 맞추기에도 실패했습니다!</p>
    \${liarGuess ? \`<p style="color:var(--slate-400)">라이어의 추측: "\${esc(liarGuess)}"</p>\` : ''}\`;
  }

  // Vote breakdown
  let voteHtml = '';
  if (room.voteResults) {
    voteHtml = '<div style="margin-top:16px;text-align:left">';
    voteHtml += '<div class="input-label" style="margin-bottom:8px">투표 결과</div>';
    players.forEach(p => {
      const cnt = room.voteResults[p.id] || 0;
      if (cnt > 0) {
        voteHtml += \`<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:14px">
          <span style="font-weight:600">\${esc(p.nickname)}</span>
          <span style="color:var(--slate-400)">→ \${cnt}표</span>
          \${p.id === room.liarId ? '<span class="badge badge-red">라이어</span>' : ''}
        </div>\`;
      }
    });
    voteHtml += '</div>';
  }

  const isHost = room.hostId === state.playerId;

  el.innerHTML = \`
    <div class="result-card animate-in">
      <div class="result-icon">\${icon}</div>
      <div class="result-title">\${title}</div>
      <div class="result-detail">\${detailHtml}</div>
      <div class="result-word-box">
        <div><div class="result-word-label">정답 제시어</div><div class="result-word-value">\${esc(room.realWord || '')}</div></div>
        <div style="width:1px;height:40px;background:var(--slate-200)"></div>
        <div><div class="result-word-label">라이어 제시어</div><div class="result-word-value" style="color:var(--red-500)">\${esc(room.liarWord || '')}</div></div>
      </div>
      \${voteHtml}
      \${isHost ? \`
        <button class="btn btn-primary btn-block" style="margin-top:20px" onclick="newGame()">
          <i class="fas fa-redo"></i> 새 게임
        </button>
      \` : '<div style="margin-top:16px;color:var(--slate-500);font-size:13px">방장이 새 게임을 시작할 때까지 기다려주세요</div>'}
    </div>
  \`;
}

// ===== CHAT =====
let lastMsgCount = 0;
function renderChat(messages) {
  if (messages.length === lastMsgCount) return;

  // Mark unread if on mobile and in game tab
  if (window.innerWidth <= 768 && state.mobileTab === 'game' && messages.length > lastMsgCount) {
    state.chatUnread = true;
    const dot = $('chat-unread-dot');
    if (dot) dot.classList.add('show');
  }

  lastMsgCount = messages.length;

  const el = $('chat-messages');
  el.innerHTML = messages.map(m => {
    if (m.type === 'system') {
      return \`<div class="chat-msg system">\${esc(m.message)}</div>\`;
    }
    if (m.type === 'speak') {
      return \`<div class="chat-msg speak-msg"><span class="nick" style="color:var(--blue-600)">\${esc(m.nickname)}</span>\${esc(m.message)}</div>\`;
    }
    const isMe = m.playerId === state.playerId;
    return \`<div class="chat-msg"><span class="nick" style="color:\${isMe ? 'var(--blue-500)' : 'var(--slate-600)'}">\${esc(m.nickname)}</span>\${esc(m.message)}</div>\`;
  }).join('');
  el.scrollTop = el.scrollHeight;

  // Also render speaking summary in the chat section (desktop)
  renderSpeakingSummaryInChat(messages);
}

function renderSpeakingSummaryInChat(messages) {
  const container = $('speaking-summary-container');
  if (!container) return;
  container.innerHTML = '';
  return;
  if (!state.roomData) { container.innerHTML = ''; return; }

  const phase = state.roomData.room.phase;
  // Show summary during free_chat, vote_extend, final_vote, liar_guess phases
  const showPhases = ['free_chat', 'vote_extend', 'final_vote', 'liar_guess'];
  if (!showPhases.includes(phase)) {
    container.innerHTML = '';
    return;
  }

  const speakMsgs = messages.filter(m => m.type === 'speak');
  if (speakMsgs.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = \`
    <div class="speaking-summary">
      <div class="speaking-summary-title"><i class="fas fa-microphone"></i> 발언 요약</div>
      \${speakMsgs.map(m => \`
        <div class="speaking-summary-item">
          <div class="summary-nick">\${esc(m.nickname)}</div>
          <div class="summary-text">\${esc(m.message)}</div>
        </div>
      \`).join('')}
    </div>
  \`;
}

// Chat send
function sendChat() {
  const input = $('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  api(\`/api/rooms/\${state.roomId}/chat\`, 'POST', { playerId: state.playerId, message: msg }).catch(() => {});
}

$('chat-send-btn').onclick = sendChat;
$('chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };

// ===== TIMER =====
function updateTimer() {
  if (!state.roomData) return;
  const room = state.roomData.room;
  const timerEl = $('game-timer');
  const timerText = $('timer-text');

  if (room.phase === 'free_chat') {
    show(timerEl);
    const elapsed = Math.floor((Date.now() - room.phaseStartTime) / 1000);
    const remaining = Math.max(0, room.freeChatDuration - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    timerText.textContent = \`\${mins}:\${String(secs).padStart(2, '0')}\`;
    timerEl.className = remaining < 30 ? 'timer-display warning' : 'timer-display';

    // Also update inline timer if exists
    const fcTimer = document.getElementById('free-chat-timer');
    if (fcTimer) {
      fcTimer.innerHTML = \`<i class="fas fa-clock"></i> \${mins}:\${String(secs).padStart(2, '0')}\`;
      fcTimer.className = remaining < 30 ? 'timer-display warning' : 'timer-display';
    }
  } else {
    hide(timerEl);
  }
}

// ===== ACTIONS =====
function revealWord() {
  state.wordRevealed = true;
  if (state.roomData) renderGameState(state.roomData);
}

async function confirmWord() {
  try {
    await api(\`/api/rooms/\${state.roomId}/confirm-word\`, 'POST', { playerId: state.playerId });
  } catch(e) {}
}

async function toggleReady() {
  try {
    await api(\`/api/rooms/\${state.roomId}/ready\`, 'POST', { playerId: state.playerId });
  } catch(e) {}
}

async function startGame() {
  try {
    await api(\`/api/rooms/\${state.roomId}/start\`, 'POST', { playerId: state.playerId });
    state.wordRevealed = false;
  } catch(e) {}
}

async function submitSpeech() {
  const textarea = document.getElementById('speak-textarea');
  if (!textarea) return;
  const msg = textarea.value.trim();
  if (!msg) { toast('발언을 입력해주세요.', 'error'); return; }
  try {
    await api(\`/api/rooms/\${state.roomId}/speak\`, 'POST', { playerId: state.playerId, message: msg });
  } catch(e) {}
}

async function endFreeChat() {
  try {
    await api(\`/api/rooms/\${state.roomId}/end-free-chat\`, 'POST', { playerId: state.playerId });
  } catch(e) {}
}

async function voteExtend(extend) {
  try {
    await api(\`/api/rooms/\${state.roomId}/vote-extend\`, 'POST', { playerId: state.playerId, extend });
  } catch(e) {}
}

async function voteLiar(targetId) {
  try {
    await api(\`/api/rooms/\${state.roomId}/vote\`, 'POST', { playerId: state.playerId, targetId });
  } catch(e) {}
}

async function submitGuess() {
  const input = document.getElementById('guess-input');
  if (!input) return;
  const guess = input.value.trim();
  if (!guess) { toast('제시어를 입력해주세요.', 'error'); return; }
  try {
    await api(\`/api/rooms/\${state.roomId}/liar-guess\`, 'POST', { playerId: state.playerId, guess });
  } catch(e) {}
}

async function newGame() {
  try {
    await api(\`/api/rooms/\${state.roomId}/new-game\`, 'POST', { playerId: state.playerId });
    state.wordRevealed = false;
    lastMsgCount = 0;
  } catch(e) {}
}

async function changeCategory(cat) {
  try {
    await api(\`/api/rooms/\${state.roomId}/category\`, 'POST', { playerId: state.playerId, category: cat });
  } catch(e) {}
}

async function changeGameMode(gameMode) {
  try {
    await api(\`/api/rooms/\${state.roomId}/game-mode\`, 'POST', { playerId: state.playerId, gameMode });
  } catch(e) {}
}

async function kickPlayer(targetId, nickname) {
  if (!confirm(nickname + '님을 강퇴하시겠습니까?')) return;
  try {
    await api(\`/api/rooms/\${state.roomId}/kick\`, 'POST', { playerId: state.playerId, targetId });
    toast(nickname + '님을 강퇴했습니다.', 'success');
  } catch(e) {}
}

function kickPlayerFromButton(button) {
  const targetId = button.getAttribute('data-player-id');
  const nickname = button.getAttribute('data-player-nickname') || '';
  if (!targetId) return;
  kickPlayer(targetId, nickname);
}

// ===== MOBILE TAB SWITCHER =====
function switchMobileTab(tab) {
  state.mobileTab = tab;
  const gameContent = $('game-content');
  const chatSection = $('chat-section');
  const tabGame = $('tab-game');
  const tabChat = $('tab-chat');

  if (tab === 'game') {
    if (gameContent) gameContent.style.display = '';
    if (chatSection) chatSection.classList.remove('mobile-visible');
    if (tabGame) tabGame.classList.add('active');
    if (tabChat) tabChat.classList.remove('active');
  } else {
    if (gameContent) gameContent.style.display = 'none';
    if (chatSection) chatSection.classList.add('mobile-visible');
    if (tabGame) tabGame.classList.remove('active');
    if (tabChat) tabChat.classList.add('active');
    // Clear unread
    state.chatUnread = false;
    const dot = $('chat-unread-dot');
    if (dot) dot.classList.remove('show');
    // Scroll chat to bottom
    const msgs = $('chat-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }
}

function togglePlayerList() {
  const list = $('player-list');
  const toggle = $('mobile-player-toggle');
  list.classList.toggle('collapsed');
  toggle.classList.toggle('collapsed');
}

// ===== DESKTOP CHAT RESIZE HANDLE =====
(function initChatResize() {
  const handle = $('chat-resize-handle');
  const chatSection = $('chat-section');
  if (!handle || !chatSection) return;

  let isDragging = false;
  let startY = 0;
  let startHeight = 0;

  handle.addEventListener('mousedown', (e) => {
    if (window.innerWidth <= 768) return; // Disable on mobile
    isDragging = true;
    startY = e.clientY;
    startHeight = chatSection.offsetHeight;
    handle.classList.add('dragging');
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const diff = startY - e.clientY;
    const newHeight = Math.min(Math.max(startHeight + diff, 80), 600);
    chatSection.style.height = newHeight + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    handle.classList.remove('dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });

  // Touch support for tablets
  handle.addEventListener('touchstart', (e) => {
    if (window.innerWidth <= 768) return;
    isDragging = true;
    startY = e.touches[0].clientY;
    startHeight = chatSection.offsetHeight;
    handle.classList.add('dragging');
    e.preventDefault();
  });

  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const diff = startY - e.touches[0].clientY;
    const newHeight = Math.min(Math.max(startHeight + diff, 80), 600);
    chatSection.style.height = newHeight + 'px';
  });

  document.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    handle.classList.remove('dragging');
  });
})();

// ===== INIT =====
setInterval(loadRooms, 5000);
</script>
</body>
</html>`
}

export default app

const port = Number(process.env.PORT) || 3000
serve({
  fetch: app.fetch,
  port,
})

console.log(`LiarGame server is running on port ${port}`)
