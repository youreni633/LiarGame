export function getSpyfallHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>스파이폴</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Noto Sans KR', sans-serif; background: radial-gradient(circle at top left, rgba(250, 204, 21, 0.18), transparent 24%), radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.20), transparent 26%), #020617; color: #e5eefb; }
    .screen { display: none; min-height: 100vh; }
    .screen.active { display: flex; }
    .lobby { align-items: center; justify-content: center; padding: 24px; }
    .wrap { width: 100%; max-width: 1120px; display: grid; gap: 20px; grid-template-columns: 360px 1fr; }
    .card, .block { background: rgba(15, 23, 42, 0.90); border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 24px; padding: 24px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35); backdrop-filter: blur(12px); }
    .brand h1 { margin: 0; font-size: 38px; letter-spacing: -0.03em; }
    .brand p { color: #94a3b8; line-height: 1.7; }
    .label { display: block; margin-bottom: 8px; font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.08em; }
    input, textarea, button, select { font: inherit; }
    input, textarea, select { width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 14px; padding: 12px 14px; }
    textarea { min-height: 112px; resize: vertical; }
    button { border: none; border-radius: 14px; padding: 12px 16px; cursor: pointer; background: linear-gradient(135deg, #eab308, #2563eb); color: white; font-weight: 700; }
    button.secondary { background: #1e293b; }
    button.danger { background: linear-gradient(135deg, #dc2626, #7f1d1d); }
    button:disabled { opacity: 0.55; cursor: not-allowed; }
    .room-list { display: grid; gap: 12px; max-height: 620px; overflow: auto; }
    .room-item { border: 1px solid rgba(148, 163, 184, 0.18); border-radius: 18px; padding: 16px; background: rgba(15, 23, 42, 0.72); cursor: pointer; }
    .room-item h3 { margin: 0 0 8px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #cbd5e1; }
    .badge { padding: 4px 10px; border-radius: 999px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(96, 165, 250, 0.18); }
    .small { font-size: 12px; color: #94a3b8; }
    .stack { display: grid; gap: 14px; }
    .game { display: none; min-height: 100vh; flex-direction: column; }
    .game.active { display: flex; }
    .topbar { display: flex; justify-content: space-between; align-items: center; gap: 14px; padding: 16px 20px; background: rgba(2, 6, 23, 0.92); border-bottom: 1px solid rgba(148, 163, 184, 0.14); backdrop-filter: blur(12px); }
    .topbar h2 { margin: 0; }
    .topbar-actions { display: flex; gap: 10px; flex-wrap: wrap; }
    .mobile-tabs { display: none; gap: 8px; padding: 10px 16px 0; background: rgba(2, 6, 23, 0.92); border-bottom: 1px solid rgba(148, 163, 184, 0.12); }
    .mobile-tab { flex: 1; border: 1px solid rgba(148, 163, 184, 0.18); background: rgba(15, 23, 42, 0.8); color: #cbd5e1; border-radius: 999px; padding: 10px 14px; font-size: 13px; font-weight: 700; }
    .mobile-tab.active { background: linear-gradient(135deg, #eab308, #2563eb); color: white; border-color: transparent; }
    .game-body { flex: 1; display: grid; grid-template-columns: minmax(0, 1.25fr) 380px 300px; min-height: 0; }
    .panel { overflow: auto; padding: 18px; }
    .chat-panel { border-left: 1px solid rgba(148, 163, 184, 0.12); border-right: 1px solid rgba(148, 163, 184, 0.12); background: rgba(2, 6, 23, 0.20); }
    .status-panel { background: rgba(2, 6, 23, 0.14); }
    .game-panel { display: flex; flex-direction: column; gap: 16px; }
    .hero { background: linear-gradient(135deg, rgba(234, 179, 8, 0.18), rgba(59, 130, 246, 0.18)); border: 1px solid rgba(148, 163, 184, 0.16); border-radius: 22px; padding: 20px; }
    .hero h3 { margin: 0 0 8px; font-size: 20px; }
    .hero-text { color: #cbd5e1; line-height: 1.7; white-space: pre-wrap; }
    .timer-pill { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: rgba(234, 179, 8, 0.16); border: 1px solid rgba(250, 204, 21, 0.24); color: #fef3c7; font-size: 13px; font-weight: 700; margin-top: 12px; }
    .locations-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-top: 14px; }
    .location-chip { padding: 10px 12px; border-radius: 14px; background: rgba(15, 23, 42, 0.84); border: 1px solid rgba(148, 163, 184, 0.14); font-size: 13px; line-height: 1.4; }
    .action-note { color: #94a3b8; font-size: 13px; line-height: 1.7; margin-bottom: 12px; }
    .vote-grid, .players { display: grid; gap: 10px; }
    .vote-row, .player-row { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 12px; border-radius: 14px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(148, 163, 184, 0.14); }
    .player-meta { display: grid; gap: 4px; }
    .player-sub, .muted { color: #94a3b8; font-size: 12px; }
    .messages { max-height: 58vh; overflow: auto; margin-bottom: 14px; padding-right: 2px; }
    .chat-line { padding: 4px 0; color: #e2e8f0; line-height: 1.5; font-size: 13px; white-space: pre-wrap; word-break: break-word; }
    .chat-line strong { color: #fde68a; }
    .chat-line.system { color: #93c5fd; font-weight: 700; }
    .chat-row { display: grid; grid-template-columns: 1fr auto; gap: 10px; }
    .result-card { padding: 18px; border-radius: 20px; background: linear-gradient(135deg, rgba(234, 179, 8, 0.18), rgba(59, 130, 246, 0.18)); border: 1px solid rgba(250, 204, 21, 0.24); line-height: 1.7; }
    .result-card h3 { margin: 0 0 10px; font-size: 22px; }
    .vote-pill { padding: 4px 10px; border-radius: 999px; background: rgba(59, 130, 246, 0.14); color: #bfdbfe; font-size: 12px; font-weight: 700; }
    @media (max-width: 980px) {
      .wrap, .game-body { grid-template-columns: 1fr; }
      .mobile-tabs { display: flex; }
      .chat-panel, .status-panel { border: none; }
      .game-body.mobile-game .chat-panel, .game-body.mobile-game .status-panel { display: none; }
      .game-body.mobile-chat .game-panel, .game-body.mobile-chat .status-panel { display: none; }
      .game-body.mobile-status .game-panel, .game-body.mobile-status .chat-panel { display: none; }
      .topbar { flex-direction: column; align-items: flex-start; }
      .topbar-actions { width: 100%; }
      .topbar-actions button { flex: 1; }
      .chat-row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div id="lobby-screen" class="screen active lobby">
    <div class="wrap">
      <div class="card">
        <div class="brand">
          <div class="small"><a href="/" style="color:inherit;text-decoration:none;">메인으로 돌아가기</a></div>
          <h1>스파이폴</h1>
          <p>시민은 스파이를 찾아내고, 스파이는 장소를 추리하세요. 채팅으로 질문과 답변을 주고받으며 눈치 싸움을 펼치는 게임입니다.</p>
        </div>
        <div class="stack">
          <div><label class="label">닉네임</label><input id="nickname" placeholder="닉네임을 입력해 주세요." maxlength="10" /></div>
          <div><label class="label">방 이름</label><input id="room-name" placeholder="방 이름(선택)" maxlength="24" /></div>
          <button id="create-room-btn">스파이폴 방 만들기</button>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h2 style="margin:0;">참가 가능한 방</h2>
          <button id="refresh-btn" class="secondary">새로고침</button>
        </div>
        <div id="room-list" class="room-list"></div>
      </div>
    </div>
  </div>

  <div id="game-screen" class="game">
    <div class="topbar">
      <div>
        <div class="small" id="room-phase">로비</div>
        <h2 id="room-title">스파이폴</h2>
      </div>
      <div class="topbar-actions">
        <button id="ready-btn" class="secondary">준비</button>
        <button id="start-btn">게임 시작</button>
        <button id="leave-btn" class="danger">나가기</button>
      </div>
    </div>
    <div class="mobile-tabs">
      <button class="mobile-tab active" data-tab="game">게임</button>
      <button class="mobile-tab" data-tab="chat">채팅</button>
      <button class="mobile-tab" data-tab="status">현황</button>
    </div>
    <div id="game-body" class="game-body mobile-chat">
      <div class="panel game-panel">
        <div class="hero">
          <h3>게임 정보</h3>
          <div id="role-text" class="hero-text">방장이 시작하면 역할이 배정됩니다.</div>
          <div id="timer-pill" class="timer-pill" style="display:none;"></div>
          <div id="location-list" class="locations-grid"></div>
        </div>
        <div class="block">
          <h3>액션</h3>
          <div id="action-note" class="action-note">시민은 과반수 투표로 스파이를 잡고, 스파이는 타이밍을 보고 장소를 맞혀야 합니다.</div>
          <div id="action-panel"></div>
        </div>
        <div id="result-panel" class="result-card" style="display:none;"></div>
      </div>
      <div class="panel chat-panel">
        <div class="block">
          <h3>채팅</h3>
          <div id="chat-messages" class="messages"></div>
          <form id="chat-form">
            <div class="chat-row">
              <textarea id="chat-input" placeholder="질문과 답변을 자유롭게 입력하세요. Enter로 전송, Shift+Enter로 줄바꿈"></textarea>
              <button type="submit">전송</button>
            </div>
          </form>
        </div>
      </div>
      <div class="panel status-panel">
        <div class="block">
          <h3>플레이어 현황</h3>
          <div id="player-list" class="players"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const state = { nickname: localStorage.getItem("sf:nickname") || "", roomId: localStorage.getItem("sf:roomId") || "", playerId: localStorage.getItem("sf:playerId") || "", version: 0, room: null, players: [], myState: null, chatMessages: [], rooms: [], mobileTab: "chat", timerHandle: null };
    const lobbyScreen = document.getElementById("lobby-screen");
    const gameScreen = document.getElementById("game-screen");
    const roomListEl = document.getElementById("room-list");
    const nicknameInput = document.getElementById("nickname");
    const roomNameInput = document.getElementById("room-name");
    const roomTitleEl = document.getElementById("room-title");
    const roomPhaseEl = document.getElementById("room-phase");
    const roleTextEl = document.getElementById("role-text");
    const locationListEl = document.getElementById("location-list");
    const actionPanelEl = document.getElementById("action-panel");
    const resultPanelEl = document.getElementById("result-panel");
    const chatMessagesEl = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const timerPillEl = document.getElementById("timer-pill");
    const playerListEl = document.getElementById("player-list");
    const gameBodyEl = document.getElementById("game-body");
    nicknameInput.value = state.nickname;

    function saveSession() { localStorage.setItem("sf:nickname", state.nickname || ""); state.roomId ? localStorage.setItem("sf:roomId", state.roomId) : localStorage.removeItem("sf:roomId"); state.playerId ? localStorage.setItem("sf:playerId", state.playerId) : localStorage.removeItem("sf:playerId"); }
    function clearSession() { state.roomId = ""; state.playerId = ""; state.version = 0; state.room = null; state.players = []; state.myState = null; state.chatMessages = []; saveSession(); }
    function setMobileTab(tab) { state.mobileTab = tab; gameBodyEl.className = "game-body mobile-" + tab; document.querySelectorAll(".mobile-tab").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab)); }
    function escapeHtml(value) { return String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;"); }
    function formatCountdown(targetTime) { if (!targetTime) return ""; const diff = Math.max(0, targetTime - Date.now()); const totalSeconds = Math.ceil(diff / 1000); const minutes = Math.floor(totalSeconds / 60); const seconds = totalSeconds % 60; return minutes + ":" + String(seconds).padStart(2, "0"); }
    function updateTimer() { if (!state.room) { timerPillEl.style.display = "none"; return; } const targetTime = state.room.phase === "playing" ? state.room.roundEndsAt : state.room.voteEndsAt; if (!targetTime) { timerPillEl.style.display = "none"; return; } timerPillEl.style.display = "inline-flex"; timerPillEl.textContent = (state.room.phase === "final_vote" ? "최종 투표 남은 시간 " : "라운드 남은 시간 ") + formatCountdown(targetTime); }
    function ensureTimer() { if (state.timerHandle) clearInterval(state.timerHandle); state.timerHandle = setInterval(updateTimer, 1000); updateTimer(); }
    async function api(path, options = {}) { const response = await fetch(path, { method: options.method || "GET", headers: { "Content-Type": "application/json" }, body: options.body ? JSON.stringify(options.body) : undefined }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error || "요청 처리 중 오류가 발생했습니다."); return data; }
    async function loadRooms() { const data = await api("/api/spyfall/rooms"); state.rooms = data.rooms || []; renderRoomList(); }
    function showLobby() { lobbyScreen.classList.add("active"); gameScreen.classList.remove("active"); }
    function showGame() { lobbyScreen.classList.remove("active"); gameScreen.classList.add("active"); setMobileTab(window.innerWidth <= 980 ? "chat" : "game"); }
    function renderRoomList() {
      if (!state.rooms.length) { roomListEl.innerHTML = '<div class="small">지금은 열려 있는 스파이폴 방이 없습니다.</div>'; return; }
      roomListEl.innerHTML = state.rooms.map((room) => '<div class="room-item" data-room-id="' + room.id + '"><h3>' + escapeHtml(room.name) + '</h3><div class="meta"><span class="badge">' + room.playerCount + '/' + room.maxPlayers + '명</span><span class="badge">' + escapeHtml(room.phase) + '</span></div></div>').join("");
      roomListEl.querySelectorAll(".room-item").forEach((item) => item.addEventListener("click", async () => {
        try {
          const nickname = nicknameInput.value.trim();
          if (!nickname) throw new Error("닉네임을 먼저 입력해 주세요.");
          state.nickname = nickname; saveSession();
          const data = await api("/api/spyfall/rooms/" + item.dataset.roomId + "/join", { method: "POST", body: { nickname } });
          state.roomId = data.roomId; state.playerId = data.playerId; state.version = 0; saveSession(); showGame(); await pollState(true);
        } catch (error) { alert(error.message); }
      }));
    }
    function renderChat() { chatMessagesEl.innerHTML = (state.chatMessages || []).map((message) => '<div class="' + (message.type === "system" ? 'chat-line system' : 'chat-line') + '">' + (message.type === "system" ? '[시스템]' : '<strong>' + escapeHtml(message.nickname) + '</strong>') + ' ' + escapeHtml(message.text) + '</div>').join(""); chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight; }
    function renderPlayers() {
      const spyId = state.room && state.room.result ? state.room.result.spyPlayerId : "";
      playerListEl.innerHTML = (state.players || []).map((player) => '<div class="player-row"><div class="player-meta"><strong>' + escapeHtml(player.nickname) + '</strong><div class="player-sub">' + (player.isHost ? '방장' : '플레이어') + ' · ' + (player.revealedRole === "spy" ? '스파이' : player.revealedRole === "citizen" ? '시민' : '역할 비공개') + '</div><div class="player-sub">현재 투표: ' + escapeHtml(player.voteTargetId ? ((state.players.find((item) => item.id === player.voteTargetId) || {}).nickname || '선택됨') : '미투표') + ' · 받은 표 ' + player.receivedVotes + '개</div></div><div class="vote-pill">' + (player.id === spyId && state.room && state.room.phase === "result" ? '스파이' : player.ready ? '준비' : '대기') + '</div></div>').join("");
    }
    function renderLocations() { const items = (state.myState && state.myState.candidateLocations) || []; locationListEl.innerHTML = items.map((location) => '<div class="location-chip">' + escapeHtml(location) + '</div>').join(""); }
    function renderActionPanel() {
      if (!state.room || !state.myState) { actionPanelEl.innerHTML = ""; return; }
      if (state.room.phase === "lobby") { actionPanelEl.innerHTML = '<div class="muted">로비에서는 준비 상태를 맞춘 뒤 방장이 게임을 시작합니다.</div>'; return; }
      if (state.room.phase === "guessing") {
        if (state.myState.isSpy) {
          actionPanelEl.innerHTML = '<div class="action-note">정체를 밝힌 뒤 장소를 선택하세요. 오답이면 시민 승리입니다.</div><select id="guess-location-select"><option value="">장소를 선택해 주세요</option>' + (state.myState.candidateLocations || []).map((location) => '<option value="' + escapeHtml(location) + '">' + escapeHtml(location) + '</option>').join("") + '</select><div style="margin-top:10px;"><button id="guess-submit-btn">장소 선택 제출</button></div>';
          document.getElementById("guess-submit-btn").addEventListener("click", submitSpyGuess);
          return;
        }
        actionPanelEl.innerHTML = '<div class="muted">스파이가 장소를 고르는 중입니다. 결과를 기다려 주세요.</div>';
        return;
      }
      if (state.room.phase === "result") { actionPanelEl.innerHTML = '<div class="muted">결과를 확인한 뒤 잠시 후 로비로 돌아갑니다.</div>'; return; }
      actionPanelEl.innerHTML = '<div class="action-note">' + escapeHtml(state.room.phase === "final_vote" ? '최종 투표 단계입니다. 한 명을 지목해 주세요.' : '시민은 과반수 투표로, 스파이는 장소 맞히기로 승부합니다.') + '</div><div class="vote-grid">' + (state.players || []).map((player) => '<div class="vote-row"><div class="player-meta"><strong>' + escapeHtml(player.nickname) + '</strong><div class="player-sub">받은 표 ' + player.receivedVotes + '개</div></div><button data-vote-id="' + player.id + '" class="vote-btn secondary">' + (state.myState.voteTargetId === player.id ? '투표 변경' : '투표하기') + '</button></div>').join("") + '</div>' + (state.myState.canGuess ? '<div class="block" style="padding:14px;margin-top:14px;"><div class="action-note">스파이라면 언제든 정체를 밝히고 장소 맞히기를 시도할 수 있습니다.</div><button id="declare-guess-btn">정체 밝히기 및 장소 선택</button></div>' : '');
      actionPanelEl.querySelectorAll(".vote-btn").forEach((button) => button.addEventListener("click", () => voteFor(button.dataset.voteId)));
      const guessButton = document.getElementById("declare-guess-btn");
      if (guessButton) guessButton.addEventListener("click", declareSpyGuess);
    }
    function renderRoleText() {
      if (!state.room || !state.myState) { roleTextEl.textContent = "방장이 시작하면 역할이 배정됩니다."; return; }
      if (state.room.phase === "lobby") { roleTextEl.textContent = "방장이 게임을 시작하면 역할과 장소 정보가 배정됩니다."; return; }
      roleTextEl.textContent = state.myState.isSpy ? "당신은 스파이입니다. 장소를 들키지 말고 대화를 통해 정답을 추리하세요." : "이번 장소는 " + (state.myState.location || "비공개") + " 입니다. 스파이를 찾아내세요.";
    }
    function renderResult() {
      if (!state.room || state.room.phase !== "result" || !state.room.result) { resultPanelEl.style.display = "none"; resultPanelEl.innerHTML = ""; return; }
      resultPanelEl.style.display = "block";
      resultPanelEl.innerHTML = '<h3>' + (state.room.result.winnerTeam === "spy" ? '스파이 승리' : '시민 승리') + '</h3><div>' + escapeHtml(state.room.result.caption) + '</div><div class="muted" style="margin-top:8px;">스파이: ' + escapeHtml(state.room.result.spyNickname) + ' · 실제 장소: ' + escapeHtml(state.room.result.location) + '</div>';
    }
    function renderGame() {
      if (!state.room) return;
      roomTitleEl.textContent = state.room.name; roomPhaseEl.textContent = state.room.phase;
      renderRoleText(); renderLocations(); renderActionPanel(); renderPlayers(); renderChat(); renderResult(); updateTimer();
      document.getElementById("ready-btn").style.display = state.room.phase === "lobby" ? "inline-flex" : "none";
      document.getElementById("start-btn").style.display = state.room.phase === "lobby" && state.myState && state.myState.isHost ? "inline-flex" : "none";
    }
    async function createRoom() { try { const nickname = nicknameInput.value.trim(); if (!nickname) throw new Error("닉네임을 입력해 주세요."); state.nickname = nickname; saveSession(); const data = await api("/api/spyfall/rooms", { method: "POST", body: { nickname, roomName: roomNameInput.value.trim() } }); state.roomId = data.roomId; state.playerId = data.playerId; state.version = 0; saveSession(); showGame(); await pollState(true); } catch (error) { alert(error.message); } }
    async function toggleReady() { try { await api("/api/spyfall/rooms/" + state.roomId + "/ready", { method: "POST", body: { playerId: state.playerId } }); await pollState(true); } catch (error) { alert(error.message); } }
    async function startGame() { try { await api("/api/spyfall/rooms/" + state.roomId + "/start", { method: "POST", body: { playerId: state.playerId } }); setMobileTab("game"); await pollState(true); } catch (error) { alert(error.message); } }
    async function leaveRoom() { try { if (state.roomId && state.playerId) await api("/api/spyfall/rooms/" + state.roomId + "/leave", { method: "POST", body: { playerId: state.playerId } }).catch(() => null); } finally { clearSession(); showLobby(); loadRooms(); } }
    async function sendChat() { const text = chatInput.value.trim(); if (!text || !state.roomId || !state.playerId) return; try { await api("/api/spyfall/rooms/" + state.roomId + "/chat", { method: "POST", body: { playerId: state.playerId, text } }); chatInput.value = ""; await pollState(true); } catch (error) { alert(error.message); } }
    async function voteFor(targetId) { try { setMobileTab("game"); await api("/api/spyfall/rooms/" + state.roomId + "/vote", { method: "POST", body: { playerId: state.playerId, targetId } }); await pollState(true); } catch (error) { alert(error.message); } }
    async function declareSpyGuess() { try { setMobileTab("game"); await api("/api/spyfall/rooms/" + state.roomId + "/declare-guess", { method: "POST", body: { playerId: state.playerId } }); await pollState(true); } catch (error) { alert(error.message); } }
    async function submitSpyGuess() { try { const select = document.getElementById("guess-location-select"); const location = select ? select.value.trim() : ""; if (!location) throw new Error("장소를 선택해 주세요."); await api("/api/spyfall/rooms/" + state.roomId + "/guess", { method: "POST", body: { playerId: state.playerId, location } }); await pollState(true); } catch (error) { alert(error.message); } }
    async function pollState(force) {
      if (!state.roomId || !state.playerId) return;
      try {
        const data = await api("/api/spyfall/rooms/" + state.roomId + "/state?playerId=" + encodeURIComponent(state.playerId) + "&v=" + (force ? 0 : state.version));
        if (data.changed === false) { updateTimer(); return; }
        state.version = data.version || 0; state.room = data.room; state.players = data.players || []; state.myState = data.myState; state.chatMessages = data.chatMessages || []; showGame(); renderGame();
      } catch (error) {
        if (String(error.message).includes("방을 찾을 수 없습니다") || String(error.message).includes("플레이어를 찾을 수 없습니다")) { clearSession(); showLobby(); loadRooms(); }
      }
    }
    document.getElementById("create-room-btn").addEventListener("click", createRoom);
    document.getElementById("refresh-btn").addEventListener("click", loadRooms);
    document.getElementById("ready-btn").addEventListener("click", toggleReady);
    document.getElementById("start-btn").addEventListener("click", startGame);
    document.getElementById("leave-btn").addEventListener("click", leaveRoom);
    document.getElementById("chat-form").addEventListener("submit", (event) => { event.preventDefault(); sendChat(); });
    chatInput.addEventListener("keydown", (event) => { if (event.isComposing) return; if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendChat(); } });
    document.querySelectorAll(".mobile-tab").forEach((button) => button.addEventListener("click", () => setMobileTab(button.dataset.tab)));
    ensureTimer(); loadRooms(); if (state.roomId && state.playerId) { showGame(); pollState(true); } setInterval(() => { if (state.roomId && state.playerId) pollState(false); }, 1500);
  </script>
</body>
</html>`;
}
