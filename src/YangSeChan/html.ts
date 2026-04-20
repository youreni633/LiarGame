export function getYangSeChanHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>양세찬 게임</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Noto Sans KR', sans-serif;
      background:
        radial-gradient(circle at top left, rgba(34, 197, 94, 0.18), transparent 26%),
        radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.20), transparent 24%),
        #020617;
      color: #e2e8f0;
    }
    .screen { display: none; min-height: 100vh; }
    .screen.active { display: flex; }
    .lobby { align-items: center; justify-content: center; padding: 24px; }
    .wrap { width: 100%; max-width: 1120px; display: grid; gap: 20px; grid-template-columns: 360px 1fr; }
    .card {
      background: rgba(15, 23, 42, 0.90);
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 24px;
      padding: 24px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(12px);
    }
    .brand h1 { margin: 0; font-size: 38px; letter-spacing: -0.03em; }
    .brand p { color: #94a3b8; line-height: 1.7; }
    .label {
      display: block;
      margin-bottom: 8px;
      font-size: 12px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    input, textarea, button { font: inherit; }
    input, textarea {
      width: 100%;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 14px;
      padding: 12px 14px;
    }
    textarea { min-height: 100px; resize: vertical; }
    button {
      border: none;
      border-radius: 14px;
      padding: 12px 16px;
      cursor: pointer;
      background: linear-gradient(135deg, #16a34a, #2563eb);
      color: white;
      font-weight: 700;
    }
    button.secondary { background: #1e293b; }
    button.danger { background: linear-gradient(135deg, #dc2626, #7f1d1d); }
    button.warning { background: linear-gradient(135deg, #f59e0b, #d97706); }
    .stack { display: grid; gap: 14px; }
    .room-list { display: grid; gap: 12px; max-height: 600px; overflow: auto; }
    .room-item {
      border: 1px solid rgba(148, 163, 184, 0.18);
      border-radius: 18px;
      padding: 16px;
      background: rgba(15, 23, 42, 0.72);
      cursor: pointer;
    }
    .room-item h3 { margin: 0 0 8px; }
    .meta { display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #cbd5e1; }
    .badge {
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(96, 165, 250, 0.18);
    }
    .small { font-size: 12px; color: #94a3b8; }
    .game { display: none; min-height: 100vh; flex-direction: column; }
    .game.active { display: flex; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: rgba(2, 6, 23, 0.92);
      border-bottom: 1px solid rgba(148, 163, 184, 0.14);
      backdrop-filter: blur(12px);
    }
    .topbar h2 { margin: 0; }
    .topbar-actions { display: flex; gap: 10px; }
    .mobile-tabs {
      display: none;
      gap: 8px;
      padding: 10px 16px 0;
      background: rgba(2, 6, 23, 0.92);
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
    }
    .mobile-tab {
      flex: 1;
      border: 1px solid rgba(148, 163, 184, 0.18);
      background: rgba(15, 23, 42, 0.8);
      color: #cbd5e1;
      border-radius: 999px;
      padding: 10px 14px;
      font-size: 13px;
      font-weight: 700;
    }
    .mobile-tab.active {
      background: linear-gradient(135deg, #16a34a, #2563eb);
      color: white;
      border-color: transparent;
    }
    .game-body {
      flex: 1;
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) 380px 260px;
      min-height: 0;
    }
    .panel { overflow: auto; padding: 18px; }
    .game-panel { display: flex; flex-direction: column; gap: 16px; }
    .chat-panel {
      border-left: 1px solid rgba(148, 163, 184, 0.12);
      border-right: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(2, 6, 23, 0.20);
    }
    .status-panel { background: rgba(2, 6, 23, 0.14); }
    .hero {
      background: linear-gradient(135deg, rgba(34, 197, 94, 0.14), rgba(59, 130, 246, 0.18));
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 22px;
      padding: 20px;
    }
    .hero h3 { margin: 0 0 8px; font-size: 20px; }
    .hero-text { color: #cbd5e1; line-height: 1.7; white-space: pre-wrap; }
    .block {
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 22px;
      padding: 18px;
    }
    .block h3 { margin: 0 0 12px; font-size: 17px; }
    .messages {
      max-height: 48vh;
      overflow: auto;
      display: grid;
      gap: 10px;
      margin-bottom: 14px;
    }
    .msg {
      padding: 12px 14px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.12);
      white-space: pre-wrap;
      line-height: 1.6;
      word-break: break-word;
    }
    .msg.system { color: #dbeafe; background: rgba(30, 41, 59, 0.98); }
    .players, .leaderboard { display: grid; gap: 10px; }
    .player, .leader-item {
      padding: 12px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }
    .chat-lines {
      max-height: 48vh;
      overflow: auto;
      margin-bottom: 14px;
      padding-right: 4px;
    }
    .chat-line {
      padding: 6px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.08);
      color: #e2e8f0;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .chat-line:last-child { border-bottom: none; }
    .chat-line strong { color: #93c5fd; }
    .prompt-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(34, 197, 94, 0.14);
      border: 1px solid rgba(34, 197, 94, 0.22);
      color: #dcfce7;
      font-size: 13px;
      font-weight: 700;
    }
    .prompt-list {
      display: grid;
      gap: 8px;
      margin-top: 12px;
    }
    .prompt-row {
      padding: 10px 12px;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.72);
      border: 1px solid rgba(148, 163, 184, 0.12);
      font-size: 13px;
      line-height: 1.5;
    }
    .player.dead { opacity: 0.56; }
    .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .action-note { color: #94a3b8; font-size: 13px; line-height: 1.7; margin-bottom: 12px; }
    .target-list { display: grid; gap: 8px; margin-bottom: 12px; }
    .target-btn {
      width: 100%;
      text-align: left;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 14px;
      padding: 10px 12px;
      color: #e2e8f0;
    }
    .target-btn.active {
      border-color: rgba(34, 197, 94, 0.9);
      background: rgba(22, 163, 74, 0.16);
    }
    @media (max-width: 980px) {
      .wrap, .game-body { grid-template-columns: 1fr; }
      .mobile-tabs { display: flex; }
      .chat-panel, .status-panel { border: none; }
      .topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
      .topbar-actions { width: 100%; flex-wrap: wrap; }
      .topbar-actions button { flex: 1; }
      .game-body.mobile-game .chat-panel,
      .game-body.mobile-game .status-panel { display: none; }
      .game-body.mobile-chat .game-panel,
      .game-body.mobile-chat .status-panel { display: none; }
      .game-body.mobile-status .game-panel,
      .game-body.mobile-status .chat-panel { display: none; }
    }
  </style>
</head>
<body>
  <div id="lobby-screen" class="screen active lobby">
    <div class="wrap">
      <div class="card">
        <div class="brand">
          <div class="small"><a href="/" style="color:inherit;text-decoration:none;">라이어게임으로 돌아가기</a></div>
          <h1>양세찬 게임</h1>
          <p>서로 제시어를 입력하고, 내 제시어가 아닌 다른 사람의 단어를 받아 질문과 정답 시도로 순위를 겨루는 스무고개형 게임입니다.</p>
        </div>
        <div class="stack">
          <div><label class="label">닉네임</label><input id="nickname" placeholder="닉네임을 입력하세요" /></div>
          <div><label class="label">방 이름</label><input id="room-name" placeholder="방 이름(선택)" /></div>
          <button id="create-room-btn">새 양세찬 게임 방 만들기</button>
        </div>
      </div>
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="margin:0;">참가 가능한 방</h3>
          <button id="refresh-btn" class="secondary">새로고침</button>
        </div>
        <div id="room-list" class="room-list"></div>
      </div>
    </div>
  </div>

  <div id="game-screen" class="game">
    <div class="topbar">
      <div>
        <div class="small" id="room-phase-badge"></div>
        <h2 id="room-title">양세찬 게임 방</h2>
      </div>
      <div class="topbar-actions">
        <button id="ready-btn" class="secondary">준비</button>
        <button id="start-btn">게임 시작</button>
        <button id="leave-btn" class="danger">나가기</button>
      </div>
    </div>

    <div class="mobile-tabs" id="mobile-tabs">
      <button class="mobile-tab active" id="tab-game-btn" type="button">게임</button>
      <button class="mobile-tab" id="tab-chat-btn" type="button">채팅</button>
      <button class="mobile-tab" id="tab-status-btn" type="button">현황</button>
    </div>

    <div class="game-body" id="game-body">
      <div class="panel game-panel">
        <div class="hero">
          <h3>현재 진행 상태</h3>
          <div id="status-text" class="hero-text">모든 인원이 준비를 누르면 방장이 게임을 시작할 수 있습니다.</div>
        </div>

        <div class="block">
          <h3>게임 진행</h3>
          <div id="game-panel-content" class="action-note">현재 단계에 맞는 입력창이 여기 표시됩니다.</div>
        </div>

        <div class="block">
          <h3>게임 로그</h3>
          <div id="game-messages" class="messages"></div>
        </div>
      </div>

      <div class="panel chat-panel">
        <div class="block">
          <h3>채팅</h3>
          <div id="chat-messages" class="chat-lines"></div>
          <textarea id="chat-input" placeholder="자유롭게 채팅을 입력하세요."></textarea>
          <div style="margin-top:12px;">
            <button id="chat-send-btn" type="button">채팅 전송</button>
          </div>
        </div>
      </div>

      <div class="panel status-panel">
        <div class="block">
          <h3>유저 현황</h3>
          <div id="player-list" class="players"></div>
        </div>
        <div class="block">
          <h3>순위표</h3>
          <div id="leaderboard" class="leaderboard"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    const state = {
      nickname: localStorage.getItem('ys:nickname') || '',
      roomId: localStorage.getItem('ys:roomId') || '',
      playerId: localStorage.getItem('ys:playerId') || '',
      version: 0,
      poll: null,
      room: null,
      selectedTargetId: '',
      mobileTab: 'game',
    };

    const $ = (id) => document.getElementById(id);
    $('nickname').value = state.nickname;

    const escapeHtml = (v) => String(v)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    function saveIdentity() {
      localStorage.setItem('ys:nickname', $('nickname').value.trim());
      localStorage.setItem('ys:roomId', state.roomId || '');
      localStorage.setItem('ys:playerId', state.playerId || '');
    }

    function showLobby() {
      $('lobby-screen').classList.add('active');
      $('game-screen').classList.remove('active');
    }

    function showGame() {
      $('lobby-screen').classList.remove('active');
      $('game-screen').classList.add('active');
      syncMobileTab();
    }

    function setMobileTab(tab) {
      state.mobileTab = ['game', 'chat', 'status'].includes(tab) ? tab : 'game';
      syncMobileTab();
    }

    function syncMobileTab() {
      const gameBody = $('game-body');
      gameBody.classList.remove('mobile-game', 'mobile-chat', 'mobile-status');
      gameBody.classList.add('mobile-' + state.mobileTab);
      $('tab-game-btn').classList.toggle('active', state.mobileTab === 'game');
      $('tab-chat-btn').classList.toggle('active', state.mobileTab === 'chat');
      $('tab-status-btn').classList.toggle('active', state.mobileTab === 'status');
    }

    async function api(url, options = {}) {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '요청 실패');
      return data;
    }

    async function loadRooms() {
      const data = await api('/api/yangsechan/rooms');
      const rooms = data.rooms || [];
      $('room-list').innerHTML = rooms.length
        ? rooms.map((room) => \`
          <div class="room-item" onclick="joinRoom('\${room.id}')">
            <h3>\${escapeHtml(room.name)}</h3>
            <div class="meta">
              <span class="badge">\${escapeHtml(room.phase)}</span>
              <span class="badge">\${room.playerCount}/10</span>
            </div>
          </div>
        \`).join('')
        : '<div class="small">현재 참가 가능한 양세찬 게임 방이 없습니다.</div>';
    }

    async function createRoom() {
      state.nickname = $('nickname').value.trim();
      if (!state.nickname) {
        alert('닉네임을 입력해주세요.');
        return;
      }
      const data = await api('/api/yangsechan/rooms', {
        method: 'POST',
        body: JSON.stringify({
          nickname: state.nickname,
          roomName: $('room-name').value.trim(),
        }),
      });
      state.roomId = data.roomId;
      state.playerId = data.playerId;
      state.version = 0;
      saveIdentity();
      showGame();
      startPolling();
    }

    async function joinRoom(roomId) {
      state.nickname = $('nickname').value.trim();
      if (!state.nickname) {
        alert('닉네임을 입력해주세요.');
        return;
      }
      const data = await api('/api/yangsechan/rooms/' + roomId + '/join', {
        method: 'POST',
        body: JSON.stringify({ nickname: state.nickname }),
      });
      state.roomId = data.roomId;
      state.playerId = data.playerId;
      state.version = 0;
      saveIdentity();
      showGame();
      startPolling();
    }

    async function leaveRoom() {
      if (!state.roomId || !state.playerId) return;
      try {
        await api('/api/yangsechan/rooms/' + state.roomId + '/leave', {
          method: 'POST',
          body: JSON.stringify({ playerId: state.playerId }),
        });
      } catch (_) {}
      state.roomId = '';
      state.playerId = '';
      state.version = 0;
      saveIdentity();
      if (state.poll) clearInterval(state.poll);
      showLobby();
      loadRooms();
    }

    async function toggleReady() {
      await api('/api/yangsechan/rooms/' + state.roomId + '/ready', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId }),
      });
    }

    async function startGame() {
      await api('/api/yangsechan/rooms/' + state.roomId + '/start', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId }),
      });
    }

    async function sendChat() {
      const input = $('chat-input');
      const text = input.value.trim();
      if (!text) return;
      await api('/api/yangsechan/rooms/' + state.roomId + '/chat', {
        method: 'POST',
        body: JSON.stringify({
          playerId: state.playerId,
          nickname: state.nickname,
          text,
        }),
      });
      input.value = '';
    }

    async function submitPrompt() {
      const promptInput = $('prompt-input');
      if (!promptInput) return;
      const prompt = promptInput.value.trim();
      await api('/api/yangsechan/rooms/' + state.roomId + '/prompt', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId, prompt }),
      });
    }

    async function submitQuestion() {
      const questionInput = $('question-input');
      if (!questionInput) return;
      const question = questionInput.value.trim();
      if (!state.selectedTargetId) {
        alert('질문 대상을 선택해주세요.');
        return;
      }
      await api('/api/yangsechan/rooms/' + state.roomId + '/question', {
        method: 'POST',
        body: JSON.stringify({
          playerId: state.playerId,
          targetId: state.selectedTargetId,
          question,
        }),
      });
      state.selectedTargetId = '';
    }

    async function submitAnswer() {
      const answerInput = $('answer-input');
      if (!answerInput) return;
      await api('/api/yangsechan/rooms/' + state.roomId + '/answer', {
        method: 'POST',
        body: JSON.stringify({
          playerId: state.playerId,
          answer: answerInput.value.trim(),
        }),
      });
    }

    async function submitGuess() {
      const guessInput = $('guess-input');
      if (!guessInput) return;
      await api('/api/yangsechan/rooms/' + state.roomId + '/guess', {
        method: 'POST',
        body: JSON.stringify({
          playerId: state.playerId,
          guess: guessInput.value.trim(),
        }),
      });
    }

    function renderLobbyActions(data) {
      const me = data.myState;
      const isHost = data.room.hostId === state.playerId;
      $('ready-btn').style.display = data.room.phase === 'lobby' && !isHost ? 'inline-flex' : 'none';
      $('start-btn').style.display = data.room.phase === 'lobby' && isHost ? 'inline-flex' : 'none';
      $('ready-btn').textContent = me?.ready ? '준비 해제' : '준비';
    }

    function renderPlayers(data) {
      $('player-list').innerHTML = (data.players || []).map((player) => \`
        <div class="player \${player.isSpectator ? 'dead' : ''}">
          <strong>\${escapeHtml(player.nickname)} \${player.id === state.playerId ? '(나)' : ''}</strong>
          <div class="small">\${player.isHost ? '방장' : player.ready ? '준비 완료' : '준비 전'}</div>
          <div class="small">\${player.isSpectator ? '관전자' : player.isPlaying ? '생존' : '대기'}</div>
          \${player.rank ? '<div class="small">' + player.rank + '등</div>' : ''}
          \${data.myState?.isSpectator && player.receivedPrompt ? '<div class="small">제시어: ' + escapeHtml(player.receivedPrompt) + '</div>' : ''}
        </div>
      \`).join('');
    }

    function renderLeaderboard(data) {
      const list = data.leaderboard?.length ? data.leaderboard : data.lastCompletedLeaderboard || [];
      $('leaderboard').innerHTML = list.length
        ? list.map((name, index) => \`<div class="leader-item"><strong>\${index + 1}등</strong><div class="small">\${escapeHtml(name)}</div></div>\`).join('')
        : '<div class="small">아직 정답을 맞힌 사람이 없습니다.</div>';
    }

    function renderMessages(data) {
      $('game-messages').innerHTML = (data.gameMessages || []).map((message) => \`
        <div class="msg \${message.type === 'system' ? 'system' : ''}">\${escapeHtml(message.text)}</div>
      \`).join('');
      $('chat-messages').innerHTML = (data.chatMessages || []).map((message) => \`
        <div class="msg"><strong>\${escapeHtml(message.nickname)}</strong><br/>\${escapeHtml(message.text)}</div>
      \`).join('');
      $('game-messages').scrollTop = $('game-messages').scrollHeight;
      $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    }

    function renderGameArea(data) {
      const room = data.room;
      const me = data.myState;
      let html = '';

      if (room.phase === 'lobby') {
        html = '<div class="action-note">현재는 로비입니다. 모든 인원이 준비를 누르면 방장이 게임을 시작할 수 있습니다.</div>';
      } else if (room.phase === 'prompt_input') {
        const remainSeconds = Math.max(0, Math.floor((room.promptInputEndsAt - Date.now()) / 1000));
        html = \`
          <div class="action-note">3분 안에 제시어를 입력하세요. 입력하지 않으면 기본 단어풀에서 자동으로 배정됩니다.</div>
          <div class="small" style="margin-bottom:10px;">남은 시간: \${remainSeconds}초</div>
          <textarea id="prompt-input" placeholder="내가 제시할 단어를 입력하세요.">\${escapeHtml(me?.submittedPrompt || '')}</textarea>
          <div style="margin-top:12px;"><button type="button" onclick="submitPrompt()">제시어 제출</button></div>
        \`;
      } else if (room.phase === 'turn') {
        if (data.canAskQuestion) {
          const targets = (data.players || []).filter((player) => player.id !== state.playerId && player.isPlaying);
          html = \`
            <div class="action-note">내 제시어: <strong>\${escapeHtml(me?.receivedPrompt || '')}</strong><br/>질문 대상을 선택하고 질문하거나, 아래에서 정답 시도를 진행하세요.</div>
            <div class="target-list">
              \${targets.map((player) => \`<button type="button" class="target-btn \${state.selectedTargetId === player.id ? 'active' : ''}" onclick="selectTarget('\${player.id}')">\${escapeHtml(player.nickname)}</button>\`).join('')}
            </div>
            <textarea id="question-input" placeholder="질문을 입력하세요."></textarea>
            <div class="row-2" style="margin-top:12px;">
              <button type="button" onclick="submitQuestion()">질문 전송</button>
              <button type="button" class="warning" onclick="toggleGuessBox()">정답 시도</button>
            </div>
            <div id="guess-box" style="display:none;margin-top:12px;">
              <input id="guess-input" placeholder="정답이라고 생각하는 제시어" />
              <div style="margin-top:10px;"><button type="button" class="warning" onclick="submitGuess()">정답 제출</button></div>
            </div>
          \`;
        } else if (data.canAnswerQuestion) {
          html = \`
            <div class="action-note">당신은 현재 질문을 받은 상태입니다. 답변을 입력하면 턴이 종료되고 다음 사람으로 넘어갑니다.</div>
            <div class="msg system" style="margin-bottom:12px;">\${escapeHtml(data.pendingTurn?.question || '')}</div>
            <textarea id="answer-input" placeholder="답변을 입력하세요."></textarea>
            <div style="margin-top:12px;"><button type="button" onclick="submitAnswer()">답변 전송</button></div>
          \`;
        } else if (me?.isSpectator) {
          html = \`
            <div class="action-note">관전 중입니다. 내 원래 제시어는 <strong>\${escapeHtml(me.receivedPrompt || '')}</strong> 입니다. 질문/답변에는 개입할 수 없고, 현황탭에서 모두의 제시어를 볼 수 있습니다.</div>
          \`;
        } else {
          html = \`
            <div class="action-note">현재 <strong>\${escapeHtml(room.currentActorNickname || '')}</strong>님의 턴입니다. 질문 또는 답변이 끝날 때까지 대기하세요.<br/>내 제시어: <strong>\${escapeHtml(me?.receivedPrompt || '')}</strong></div>
          \`;
        }
      }

      $('game-panel-content').innerHTML = html;
    }

    async function submitPrompt() {
      const promptInput = $('prompt-input');
      if (!promptInput || promptInput.disabled) return;
      const prompt = promptInput.value.trim();
      if (!prompt) {
        alert('제시어를 입력해주세요.');
        return;
      }
      await api('/api/yangsechan/rooms/' + state.roomId + '/prompt', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId, prompt }),
      });
      await pollState();
    }

    function renderLobbyActions(data) {
      const me = data.myState;
      const isHost = data.room.hostId === state.playerId;
      $('ready-btn').style.display = data.room.phase === 'lobby' && !isHost ? 'inline-flex' : 'none';
      $('start-btn').style.display = data.room.phase === 'lobby' && isHost ? 'inline-flex' : 'none';
      $('ready-btn').textContent = me?.ready ? '준비 해제' : '준비';
    }

    function renderPlayers(data) {
      $('player-list').innerHTML = (data.players || []).map((player) => \`
        <div class="player \${player.isSpectator ? 'dead' : ''}">
          <strong>\${escapeHtml(player.nickname)} \${player.id === state.playerId ? '(나)' : ''}</strong>
          <div class="small">\${player.isHost ? '방장' : player.ready ? '준비 완료' : '준비 전'}</div>
          <div class="small">\${player.isSpectator ? '관전자' : player.isPlaying ? '플레이 중' : '대기'}</div>
          \${player.rank ? '<div class="small">' + player.rank + '위</div>' : ''}
          \${player.receivedPrompt ? '<div class="prompt-row">' + escapeHtml(player.nickname) + ' - 제시어: <strong>' + escapeHtml(player.receivedPrompt) + '</strong></div>' : ''}
        </div>
      \`).join('');
    }

    function renderLeaderboard(data) {
      const list = data.leaderboard?.length ? data.leaderboard : data.lastCompletedLeaderboard || [];
      $('leaderboard').innerHTML = list.length
        ? list.map((name, index) => \`<div class="leader-item"><strong>\${index + 1}위</strong><div class="small">\${escapeHtml(name)}</div></div>\`).join('')
        : '<div class="small">아직 정답을 맞힌 플레이어가 없습니다.</div>';
    }

    function renderMessages(data) {
      $('game-messages').innerHTML = (data.gameMessages || []).map((message) => \`
        <div class="msg \${message.type === 'system' ? 'system' : ''}">\${escapeHtml(message.text)}</div>
      \`).join('');
      $('chat-messages').innerHTML = (data.chatMessages || []).map((message) => \`
        <div class="chat-line"><strong>\${escapeHtml(message.nickname)}</strong>: \${escapeHtml(message.text)}</div>
      \`).join('');
      $('game-messages').scrollTop = $('game-messages').scrollHeight;
      $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    }

    function renderPromptOverview(data) {
      const promptRows = (data.players || [])
        .filter((player) => player.receivedPrompt)
        .map((player) => \`<div class="prompt-row">\${escapeHtml(player.nickname)} - 제시어: <strong>\${escapeHtml(player.receivedPrompt)}</strong></div>\`)
        .join('');
      return promptRows ? '<div class="prompt-list">' + promptRows + '</div>' : '';
    }

    function renderGameArea(data) {
      const room = data.room;
      const me = data.myState;
      const submittedPrompt = (me?.submittedPrompt || '').trim();
      const promptOverview = renderPromptOverview(data);
      let html = '';

      if (room.phase === 'lobby') {
        html = '<div class="action-note">현재는 로비입니다. 모두 준비를 누르면 방장이 게임을 시작할 수 있습니다.</div>';
      } else if (room.phase === 'prompt_input') {
        const remainSeconds = Math.max(0, Math.floor((room.promptInputEndsAt - Date.now()) / 1000));
        const hasSubmitted = !!submittedPrompt;
        html = \`
          <div class="action-note">3분 안에 제시어를 입력하세요. 입력하지 않으면 기본 단어풀에서 자동 배정됩니다.</div>
          <div class="small" style="margin-bottom:10px;">남은 시간: \${remainSeconds}초 / 제출 완료: \${room.submittedPromptCount || 0}/\${room.totalPromptPlayers || 0}</div>
          \${hasSubmitted ? '<div class="prompt-status">제시어 제출 완료</div>' : ''}
          <textarea id="prompt-input" placeholder="내가 제시할 단어를 입력하세요." \${hasSubmitted ? 'disabled' : ''}>\${escapeHtml(submittedPrompt)}</textarea>
          <div style="margin-top:12px;"><button type="button" onclick="submitPrompt()" \${hasSubmitted ? 'disabled' : ''}>\${hasSubmitted ? '제출 완료' : '제시어 제출'}</button></div>
        \`;
      } else if (room.phase === 'turn') {
        if (data.canAskQuestion) {
          const targets = (data.players || []).filter((player) => player.id !== state.playerId && player.isPlaying);
          html = \`
            <div class="action-note">다른 사람들의 제시어를 보고 내 제시어를 유추해보세요. 질문 대상을 선택하고 질문하거나 정답 시도를 진행할 수 있습니다.</div>
            \${promptOverview}
            <div class="target-list">
              \${targets.map((player) => \`<button type="button" class="target-btn \${state.selectedTargetId === player.id ? 'active' : ''}" onclick="selectTarget('\${player.id}')">\${escapeHtml(player.nickname)}\${player.receivedPrompt ? ' - ' + escapeHtml(player.receivedPrompt) : ''}</button>\`).join('')}
            </div>
            <textarea id="question-input" placeholder="질문을 입력하세요."></textarea>
            <div class="row-2" style="margin-top:12px;">
              <button type="button" onclick="submitQuestion()">질문 전송</button>
              <button type="button" class="warning" onclick="toggleGuessBox()">정답 시도</button>
            </div>
            <div id="guess-box" style="display:none;margin-top:12px;">
              <input id="guess-input" placeholder="내 제시어라고 생각하는 단어를 입력하세요." />
              <div style="margin-top:10px;"><button type="button" class="warning" onclick="submitGuess()">정답 제출</button></div>
            </div>
          \`;
        } else if (data.canAnswerQuestion) {
          html = \`
            <div class="action-note">질문을 받은 상태입니다. 질문자의 이름과 제시어를 확인한 뒤 답변을 입력하세요.</div>
            \${promptOverview}
            <div class="msg system" style="margin-bottom:12px;"><strong>\${escapeHtml(data.pendingTurn?.actorNickname || '')}</strong> (제시어: \${escapeHtml(data.pendingTurn?.actorPrompt || '') || '비공개'})<br/>\${escapeHtml(data.pendingTurn?.question || '')}</div>
            <textarea id="answer-input" placeholder="답변을 입력하세요."></textarea>
            <div style="margin-top:12px;"><button type="button" onclick="submitAnswer()">답변 전송</button></div>
          \`;
        } else if (me?.isSpectator) {
          html = \`
            <div class="action-note">관전 중입니다. 질문/답변에는 개입할 수 없고, 현황에서 다른 플레이어 제시어와 순위를 볼 수 있습니다.</div>
            \${promptOverview}
          \`;
        } else {
          html = \`
            <div class="action-note">현재 <strong>\${escapeHtml(room.currentActorNickname || '')}</strong>님의 턴입니다. 질문 또는 답변이 끝날 때까지 기다려주세요.</div>
            \${promptOverview}
          \`;
        }
      }

      $('game-panel-content').innerHTML = html;
    }

    function toggleGuessBox() {
      const box = $('guess-box');
      if (box) box.style.display = box.style.display === 'none' ? 'block' : 'none';
    }

    function selectTarget(playerId) {
      state.selectedTargetId = playerId;
      if (state.room) {
        renderGameArea({
          room: state.room,
          players: state.players || [],
          myState: state.myState || null,
          canAskQuestion: state.canAskQuestion,
          canAnswerQuestion: state.canAnswerQuestion,
          pendingTurn: state.pendingTurn || null,
        });
      }
    }

    function renderState(data) {
      state.room = data.room;
      state.players = data.players;
      state.myState = data.myState;
      state.canAskQuestion = data.canAskQuestion;
      state.canAnswerQuestion = data.canAnswerQuestion;
      state.pendingTurn = data.pendingTurn;

      $('room-title').textContent = data.room.name;
      $('room-phase-badge').textContent = data.room.phase;
      $('status-text').textContent = data.room.statusText || '';

      renderLobbyActions(data);
      renderPlayers(data);
      renderLeaderboard(data);
      renderMessages(data);
      renderGameArea(data);

      if (data.canAskQuestion || data.canAnswerQuestion || data.room.phase === 'prompt_input') {
        setMobileTab('game');
      }
    }

    async function pollState() {
      if (!state.roomId || !state.playerId) return;
      const data = await api('/api/yangsechan/rooms/' + state.roomId + '/state?playerId=' + encodeURIComponent(state.playerId) + '&v=' + state.version);
      if (!data.changed) return;
      state.version = data.version;
      renderState(data);
    }

    function startPolling() {
      if (state.poll) clearInterval(state.poll);
      pollState();
      state.poll = setInterval(pollState, 2000);
    }

    $('create-room-btn').onclick = createRoom;
    $('refresh-btn').onclick = loadRooms;
    $('leave-btn').onclick = leaveRoom;
    $('ready-btn').onclick = toggleReady;
    $('start-btn').onclick = startGame;
    $('chat-send-btn').onclick = sendChat;
    $('tab-game-btn').onclick = () => setMobileTab('game');
    $('tab-chat-btn').onclick = () => setMobileTab('chat');
    $('tab-status-btn').onclick = () => setMobileTab('status');

    if (state.roomId && state.playerId) {
      showGame();
      startPolling();
    } else {
      loadRooms();
    }

    syncMobileTab();
    window.joinRoom = joinRoom;
    window.submitPrompt = submitPrompt;
    window.submitQuestion = submitQuestion;
    window.submitAnswer = submitAnswer;
    window.submitGuess = submitGuess;
    window.toggleGuessBox = toggleGuessBox;
    window.selectTarget = selectTarget;
  </script>
</body>
</html>`;
}
