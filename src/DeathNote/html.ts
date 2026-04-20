export function getDeathNoteHTML() {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>데스노트 게임</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Noto Sans KR', sans-serif;
      background:
        radial-gradient(circle at top, rgba(59, 130, 246, 0.18), transparent 28%),
        radial-gradient(circle at bottom right, rgba(124, 58, 237, 0.22), transparent 24%),
        #020617;
      color: #e2e8f0;
    }
    .screen { display: none; min-height: 100vh; }
    .screen.active { display: flex; }
    .lobby { align-items: center; justify-content: center; padding: 24px; }
    .wrap { width: 100%; max-width: 1120px; display: grid; gap: 20px; grid-template-columns: 360px 1fr; }
    .card {
      background: rgba(15, 23, 42, 0.88);
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
    input, select, textarea, button { font: inherit; }
    input, select, textarea {
      width: 100%;
      background: #0f172a;
      color: #f8fafc;
      border: 1px solid rgba(148, 163, 184, 0.24);
      border-radius: 14px;
      padding: 12px 14px;
    }
    textarea { min-height: 110px; resize: vertical; }
    .stack { display: grid; gap: 14px; }
    .row { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; }
    button {
      border: none;
      border-radius: 14px;
      padding: 12px 16px;
      cursor: pointer;
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: white;
      font-weight: 700;
    }
    button.secondary { background: #1e293b; }
    button.danger { background: linear-gradient(135deg, #dc2626, #7f1d1d); }
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
    .game { display: none; height: 100vh; flex-direction: column; }
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
      background: linear-gradient(135deg, #7c3aed, #2563eb);
      color: white;
      border-color: transparent;
    }
    .game-body {
      flex: 1;
      display: grid;
      grid-template-columns: 240px minmax(0, 1.35fr) 320px;
      min-height: 0;
    }
    .panel { overflow: auto; padding: 18px; }
    .player-panel { border-right: 1px solid rgba(148, 163, 184, 0.12); }
    .side-panel { border-left: 1px solid rgba(148, 163, 184, 0.12); background: rgba(2, 6, 23, 0.25); }
    .players { display: grid; gap: 10px; }
    .player {
      padding: 12px;
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.8);
      border: 1px solid rgba(148, 163, 184, 0.14);
    }
    .player.dead { opacity: 0.55; }
    .player strong { display: block; margin-bottom: 6px; }
    .center-panel {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-height: 0;
      padding: 18px;
    }
    .status-hero {
      padding: 18px 20px;
      border-radius: 22px;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.14), rgba(124, 58, 237, 0.16));
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
    }
    .status-hero h3 { margin: 0 0 8px; font-size: 20px; }
    .status-text { color: #cbd5e1; line-height: 1.7; white-space: pre-wrap; }
    .feed-card {
      flex: 1;
      min-height: 0;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .feed-head {
      padding: 16px 18px;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .feed-head h3 { margin: 0; font-size: 18px; }
    .messages {
      flex: 1;
      overflow: auto;
      padding: 16px;
      display: grid;
      gap: 10px;
      background: linear-gradient(180deg, rgba(15, 23, 42, 0.1), rgba(15, 23, 42, 0.32));
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
    .msg.system {
      color: #dbeafe;
      background: rgba(30, 41, 59, 0.98);
      border-color: rgba(96, 165, 250, 0.15);
    }
    .input-box {
      padding: 16px;
      border-top: 1px solid rgba(148, 163, 184, 0.12);
      display: grid;
      gap: 12px;
      background: rgba(2, 6, 23, 0.4);
    }
    .side-card {
      background: rgba(15, 23, 42, 0.88);
      border: 1px solid rgba(148, 163, 184, 0.14);
      border-radius: 22px;
      padding: 16px;
      margin-bottom: 14px;
    }
    .side-card h3 { margin: 0 0 10px; font-size: 16px; }
    .role-image-wrap {
      border-radius: 18px;
      overflow: hidden;
      background: #0f172a;
      border: 1px solid rgba(148, 163, 184, 0.12);
      margin-bottom: 12px;
    }
    .role-image-wrap img {
      width: 100%;
      display: block;
      aspect-ratio: 1.45 / 1;
      object-fit: cover;
    }
    .role-title { font-size: 18px; font-weight: 800; margin-bottom: 8px; }
    .role-desc { color: #94a3b8; line-height: 1.7; white-space: pre-wrap; font-size: 13px; }
    .command-chip {
      display: inline-block;
      padding: 8px 10px;
      border-radius: 999px;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.18);
      font-size: 12px;
      margin-right: 8px;
      margin-bottom: 8px;
      cursor: pointer;
    }
    .result {
      background: rgba(15, 23, 42, 0.92);
      border-radius: 24px;
      padding: 20px;
      border: 1px solid rgba(148, 163, 184, 0.14);
    }
    .result img {
      width: 100%;
      border-radius: 18px;
      display: block;
      margin-bottom: 16px;
      background: #0f172a;
    }
    @media (max-width: 1100px) {
      .game-body { grid-template-columns: 220px minmax(0, 1fr) 300px; }
    }
    @media (max-width: 920px) {
      .wrap, .game-body { grid-template-columns: 1fr; }
      .player-panel, .side-panel { border: none; }
      .topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
      .topbar-actions { flex-wrap: wrap; width: 100%; }
      .topbar-actions button { flex: 1; }
      .mobile-tabs { display: flex; }
      .center-panel { order: 1; }
      .side-panel { order: 2; }
      .player-panel { order: 3; }
      .game-body.mobile-chat .player-panel,
      .game-body.mobile-chat .side-panel {
        display: none;
      }
      .game-body.mobile-info .center-panel .status-hero,
      .game-body.mobile-info .center-panel .feed-card,
      .game-body.mobile-info .center-panel #result-box {
        display: none;
      }
      .game-body.mobile-chat .center-panel {
        padding-top: 14px;
      }
    }
  </style>
</head>
<body>
  <div id="lobby-screen" class="screen active lobby">
    <div class="wrap">
      <div class="card">
        <div class="brand">
          <div class="small"><a href="/" style="color:inherit;text-decoration:none;">라이어게임으로 돌아가기</a></div>
          <h1>데스노트 게임</h1>
          <p>완전히 분리된 데스노트 전용 방입니다. 방 생성, 참가, 역할 배정, 명령어 기반 스킬 사용까지 이 페이지에서 진행됩니다.</p>
        </div>
        <div class="stack">
          <div><label class="label">닉네임</label><input id="nickname" placeholder="닉네임을 입력하세요" /></div>
          <div><label class="label">방 이름</label><input id="room-name" placeholder="방 이름(선택)" /></div>
          <div class="row">
            <div><label class="label">게임 모드</label><select id="mode"><option>일반</option><option>사신</option><option>바보</option></select></div>
            <div><label class="label">표시 모드</label><select id="player-mode"><option>이미지</option><option>텍스트</option></select></div>
          </div>
          <button id="create-room-btn">새 데스노트 방 만들기</button>
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
        <div class="small" id="room-mode-badge"></div>
        <h2 id="room-title">데스노트 방</h2>
      </div>
      <div class="topbar-actions">
        <button id="change-mode-btn" class="secondary">모드 변경</button>
        <button id="start-btn">게임 시작</button>
        <button id="leave-btn" class="danger">나가기</button>
      </div>
    </div>
    <div class="mobile-tabs" id="mobile-tabs">
      <button class="mobile-tab active" id="tab-chat-btn" type="button">채팅</button>
      <button class="mobile-tab" id="tab-info-btn" type="button">정보</button>
    </div>
    <div class="game-body">
      <div class="panel player-panel">
        <h3 style="margin-top:0;">플레이어</h3>
        <div id="player-list" class="players"></div>
      </div>

      <div class="center-panel">
        <div class="status-hero">
          <h3>현재 진행 상태</h3>
          <div id="status-text" class="status-text">방장이 게임을 시작하면 역할이 배정됩니다.</div>
        </div>

        <div class="feed-card">
          <div class="feed-head">
            <h3>게임 로그 / 채팅</h3>
            <div class="small" id="feed-count"></div>
          </div>
          <div id="messages" class="messages"></div>
          <div class="input-box">
            <textarea id="message-input" placeholder="대화 또는 명령어를 입력하세요. 예: /데스노트 엘 홍길동 심장마비"></textarea>
            <button id="send-btn">전송</button>
          </div>
        </div>

        <div id="result-box" style="display:none;" class="result"></div>
      </div>

      <div class="panel side-panel">
        <div class="side-card">
          <h3>내 역할 / 정보</h3>
          <div class="role-image-wrap" id="role-image-wrap" style="display:none;">
            <img id="role-image" alt="role" />
          </div>
          <div id="hero-title" class="role-title">역할 정보</div>
          <div id="hero-desc" class="role-desc">게임이 시작되면 역할이 표시됩니다.</div>
        </div>

        <div class="side-card">
          <h3>사용 가능한 명령</h3>
          <div id="commands"></div>
        </div>
      </div>
    </div>
  </div>
  <script>
    const state = {
      nickname: localStorage.getItem('dn:nickname') || '',
      playerMode: localStorage.getItem('dn:playerMode') || '이미지',
      playerId: localStorage.getItem('dn:playerId') || '',
      roomId: localStorage.getItem('dn:roomId') || '',
      version: 0,
      poll: null,
      room: null,
      mobileTab: 'chat',
    };

    const $ = (id) => document.getElementById(id);
    $('nickname').value = state.nickname;
    $('player-mode').value = state.playerMode;

    const escapeHtml = (v) => String(v)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');

    const showLobby = () => {
      $('lobby-screen').classList.add('active');
      $('game-screen').classList.remove('active');
    };

    const showGame = () => {
      $('lobby-screen').classList.remove('active');
      $('game-screen').classList.add('active');
      syncMobileTab();
    };

    function syncMobileTab() {
      const body = document.querySelector('.game-body');
      if (!body) return;
      body.classList.remove('mobile-chat', 'mobile-info');
      body.classList.add(state.mobileTab === 'info' ? 'mobile-info' : 'mobile-chat');
      $('tab-chat-btn').classList.toggle('active', state.mobileTab === 'chat');
      $('tab-info-btn').classList.toggle('active', state.mobileTab === 'info');
    }

    function setMobileTab(nextTab) {
      state.mobileTab = nextTab === 'info' ? 'info' : 'chat';
      syncMobileTab();
    }

    function saveIdentity() {
      localStorage.setItem('dn:nickname', $('nickname').value.trim());
      localStorage.setItem('dn:playerMode', $('player-mode').value);
      localStorage.setItem('dn:playerId', state.playerId || '');
      localStorage.setItem('dn:roomId', state.roomId || '');
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
      const data = await api('/api/deathnote/rooms');
      const rooms = data.rooms || [];
      $('room-list').innerHTML = rooms.length
        ? rooms.map((room) => \`
          <div class="room-item" onclick="joinRoom('\${room.id}')">
            <h3>\${escapeHtml(room.name)}</h3>
            <div class="meta">
              <span class="badge">\${escapeHtml(room.mode)}</span>
              <span class="badge">\${escapeHtml(room.phase)}</span>
              <span class="badge">\${room.players}/\${room.maxPlayers}</span>
            </div>
          </div>
        \`).join('')
        : '<div class="small">현재 참가 가능한 데스노트 방이 없습니다.</div>';
    }

    async function createRoom() {
      state.nickname = $('nickname').value.trim();
      state.playerMode = $('player-mode').value;
      if (!state.nickname) {
        alert('닉네임을 입력해주세요.');
        return;
      }
      const data = await api('/api/deathnote/rooms', {
        method: 'POST',
        body: JSON.stringify({
          nickname: state.nickname,
          roomName: $('room-name').value.trim(),
          mode: $('mode').value,
          playerMode: state.playerMode,
        }),
      });
      state.playerId = data.playerId;
      state.roomId = data.roomId;
      state.version = 0;
      saveIdentity();
      showGame();
      startPolling();
    }

    async function joinRoom(roomId) {
      state.nickname = $('nickname').value.trim();
      state.playerMode = $('player-mode').value;
      if (!state.nickname) {
        alert('닉네임을 입력해주세요.');
        return;
      }
      const data = await api('/api/deathnote/rooms/' + roomId + '/join', {
        method: 'POST',
        body: JSON.stringify({
          nickname: state.nickname,
          playerMode: state.playerMode,
        }),
      });
      state.playerId = data.playerId;
      state.roomId = data.roomId;
      state.version = 0;
      saveIdentity();
      showGame();
      startPolling();
    }

    async function leaveRoom() {
      if (!state.roomId || !state.playerId) return;
      try {
        await api('/api/deathnote/rooms/' + state.roomId + '/leave', {
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

    async function startGame() {
      await api('/api/deathnote/rooms/' + state.roomId + '/start', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId }),
      });
    }

    async function changeMode() {
      const nextMode = prompt('변경할 모드를 입력하세요: 일반 / 사신 / 바보', state.room?.mode || '일반');
      if (!nextMode) return;
      await api('/api/deathnote/rooms/' + state.roomId + '/mode', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId, mode: nextMode }),
      });
    }

    async function sendMessage() {
      const input = $('message-input');
      const message = input.value.trim();
      if (!message) return;
      await api('/api/deathnote/rooms/' + state.roomId + '/chat', {
        method: 'POST',
        body: JSON.stringify({ playerId: state.playerId, nickname: state.nickname, message }),
      });
      input.value = '';
    }

    function renderState(data) {
      state.room = data.room;
      $('room-title').textContent = data.room.name;
      $('room-mode-badge').textContent = data.room.mode + ' 모드';
      $('status-text').textContent = data.room.statusText || '';
      $('feed-count').textContent = (data.messages || []).length + '개 로그';

      const isHost = data.room.hostId === state.playerId;
      $('start-btn').style.display = isHost && data.room.phase === 'lobby' ? 'inline-flex' : 'none';
      $('change-mode-btn').style.display = isHost && data.room.phase === 'lobby' ? 'inline-flex' : 'none';

      $('player-list').innerHTML = (data.players || []).map((player) => \`
        <div class="player \${player.alive ? '' : 'dead'}">
          <strong>\${escapeHtml(player.name)} \${player.id === state.playerId ? '(나)' : ''}</strong>
          <div class="small">상태: \${escapeHtml(player.alive ? '생존' : player.deathreason)}</div>
          \${player.revealedRole ? '<div class="small">역할: ' + escapeHtml(player.revealedRole) + '</div>' : ''}
        </div>
      \`).join('');

      const myRole = data.myRole;
      if (myRole) {
        const shouldHideImage = myRole.hidden || myRole.mode === '텍스트';
        $('role-image-wrap').style.display = shouldHideImage ? 'none' : 'block';
        $('role-image').src = myRole.img;
        $('hero-title').textContent = myRole.hidden ? '바보 모드' : myRole.role + ' / ' + myRole.team;
        $('hero-desc').textContent = myRole.hidden
          ? '바보모드에서는 당신의 역할을 알려주지 않습니다.'
          : myRole.explain + '\\n\\n상태: ' + myRole.deathreason + '\\n귓속말: ' + myRole.whisper + '회 / 쪽지: ' + myRole.note + '회';
      } else {
        $('role-image-wrap').style.display = 'none';
        $('role-image').removeAttribute('src');
        $('hero-title').textContent = '역할 정보';
        $('hero-desc').textContent = '게임이 시작되면 역할 정보가 이쪽에 작게 표시됩니다.';
      }

      $('commands').innerHTML = (data.availableCommands || []).map((command) => \`
        <span class="command-chip" onclick="fillCommand('\${command.replace(/'/g, "\\\\'")}')">\${escapeHtml(command)}</span>
      \`).join('');

      $('messages').innerHTML = (data.messages || []).slice(-120).map((message) => \`
        <div class="msg \${message.type === 'system' ? 'system' : ''}">\${escapeHtml(message.text)}</div>
      \`).join('');
      $('messages').scrollTop = $('messages').scrollHeight;

      const resultBox = $('result-box');
      if (data.result) {
        const image = data.result.imageByPlayerId[state.playerId];
        resultBox.style.display = 'block';
        resultBox.innerHTML = \`
          <img src="\${image}" alt="result" />
          <h3>\${escapeHtml(data.result.title)}</h3>
          <div class="status-text">\${escapeHtml(data.result.caption)}</div>
          <div class="status-text">\${data.result.entries.map((entry) => escapeHtml(entry.role + ': ' + entry.name + ' - 결과: ' + entry.result)).join('<br/>')}</div>
        \`;
      } else {
        resultBox.style.display = 'none';
      }
    }

    async function pollState() {
      if (!state.roomId || !state.playerId) return;
      try {
        const data = await api('/api/deathnote/rooms/' + state.roomId + '/state?playerId=' + encodeURIComponent(state.playerId) + '&v=' + state.version);
        if (!data.changed) return;
        state.version = data.version;
        renderState(data);
      } catch (error) {
        if (state.poll) clearInterval(state.poll);
        state.roomId = '';
        state.playerId = '';
        state.version = 0;
        saveIdentity();
        showLobby();
        loadRooms();
      }
    }

    function startPolling() {
      if (state.poll) clearInterval(state.poll);
      pollState();
      state.poll = setInterval(pollState, 2000);
    }

    function fillCommand(command) {
      $('message-input').value = command + ' ';
      $('message-input').focus();
    }

    $('create-room-btn').onclick = createRoom;
    $('refresh-btn').onclick = loadRooms;
    $('leave-btn').onclick = leaveRoom;
    $('start-btn').onclick = startGame;
    $('change-mode-btn').onclick = changeMode;
    $('send-btn').onclick = sendMessage;
    $('tab-chat-btn').onclick = () => setMobileTab('chat');
    $('tab-info-btn').onclick = () => setMobileTab('info');
    $('message-input').addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        sendMessage();
      }
    });

    if (state.roomId && state.playerId) {
      showGame();
      startPolling();
    } else {
      loadRooms();
    }

    syncMobileTab();

    window.joinRoom = joinRoom;
    window.fillCommand = fillCommand;
  </script>
</body>
</html>`;
}
