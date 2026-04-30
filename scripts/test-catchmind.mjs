import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import process from "node:process";
import { io } from "socket.io-client";

const PORT = 3012;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout.
    }
    await sleep(250);
  }
  throw new Error("Timed out while waiting for the local server.");
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

function createClient({ roomId, playerId, label }) {
  const socket = io(`${BASE_URL}/catchmind`, {
    transports: ["websocket"],
    reconnection: false,
    forceNew: true,
    timeout: 5000,
  });

  const waiters = {
    state: [],
    draw: [],
    clear: [],
    error: [],
  };

  const client = {
    label,
    roomId,
    playerId,
    socket,
    latestState: null,
    waitForState(predicate, timeoutMs = 8000, name = "state") {
      return waitForEvent("state", predicate, timeoutMs, `${label}:${name}`);
    },
    waitForDraw(predicate, timeoutMs = 8000, name = "draw") {
      return waitForEvent("draw", predicate, timeoutMs, `${label}:${name}`);
    },
    waitForClear(predicate, timeoutMs = 8000, name = "clear") {
      return waitForEvent("clear", predicate, timeoutMs, `${label}:${name}`);
    },
    disconnect() {
      socket.disconnect();
    },
  };

  function flush(type, payload) {
    const pending = waiters[type];
    if (!pending || pending.length === 0) {
      return;
    }

    for (let index = pending.length - 1; index >= 0; index -= 1) {
      const waiter = pending[index];
      let matched = false;
      try {
        matched = waiter.predicate(payload);
      } catch (error) {
        clearTimeout(waiter.timer);
        pending.splice(index, 1);
        waiter.reject(error);
        continue;
      }

      if (matched) {
        clearTimeout(waiter.timer);
        pending.splice(index, 1);
        waiter.resolve(payload);
      }
    }
  }

  function waitForEvent(type, predicate, timeoutMs, labelText) {
    const currentPayload =
      type === "state" ? client.latestState : undefined;
    if (currentPayload && predicate(currentPayload)) {
      return Promise.resolve(currentPayload);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const bucket = waiters[type];
        const index = bucket.indexOf(waiter);
        if (index >= 0) {
          bucket.splice(index, 1);
        }
        reject(new Error(`Timed out while waiting for ${labelText}`));
      }, timeoutMs);

      const waiter = {
        predicate,
        resolve,
        reject,
        timer,
      };

      waiters[type].push(waiter);
    });
  }

  socket.on("connect", () => {
    socket.emit("catchmind:session", { roomId, playerId });
  });

  socket.on("catchmind:state", (payload) => {
    client.latestState = payload;
    flush("state", payload);
  });

  socket.on("catchmind:draw-line", (payload) => {
    flush("draw", payload);
  });

  socket.on("catchmind:canvas-clear", (payload) => {
    flush("clear", payload);
  });

  socket.on("catchmind:error", (payload) => {
    flush("error", payload);
  });

  return client;
}

async function connectPlayers(roomId, players) {
  const clients = players.map((player) =>
    createClient({
      roomId,
      playerId: player.playerId,
      label: player.label,
    }),
  );

  await Promise.all(
    clients.map((client) =>
      client.waitForState(
        (state) => state && state.myState && state.myState.id === client.playerId,
        8000,
        "initial-state",
      ),
    ),
  );

  return clients;
}

function getClientById(clients, playerId) {
  const client = clients.find((entry) => entry.playerId === playerId);
  assert.ok(client, `Client for player ${playerId} was not found.`);
  return client;
}

async function testLobbyHostTransfer() {
  console.log("1/3 lobby host transfer");

  const created = await api("/api/catchmind/rooms", {
    method: "POST",
    body: {
      nickname: "HostLobby",
      roomName: "Lobby Transfer",
      maxPlayers: 4,
      maxRounds: 1,
      turnDurationSeconds: 30,
    },
  });
  const joined = await api(`/api/catchmind/rooms/${created.roomId}/join`, {
    method: "POST",
    body: { nickname: "GuestLobby" },
  });

  const [hostClient, guestClient] = await connectPlayers(created.roomId, [
    { playerId: created.playerId, label: "lobby-host" },
    { playerId: joined.playerId, label: "lobby-guest" },
  ]);

  hostClient.disconnect();

  const transferred = await guestClient.waitForState(
    (state) =>
      state.room &&
      state.room.hostId === joined.playerId &&
      Array.isArray(state.players) &&
      state.players.some((player) => player.id === joined.playerId && player.isHost),
    8000,
    "host-transfer",
  );

  assert.equal(transferred.room.hostId, joined.playerId);
  guestClient.disconnect();
}

async function testRealtimeGameFlow() {
  console.log("2/3 realtime drawing + leave flow");

  const created = await api("/api/catchmind/rooms", {
    method: "POST",
    body: {
      nickname: "HostGame",
      roomName: "Realtime Flow",
      maxPlayers: 5,
      maxRounds: 1,
      turnDurationSeconds: 30,
    },
  });
  const guest1 = await api(`/api/catchmind/rooms/${created.roomId}/join`, {
    method: "POST",
    body: { nickname: "GuestOne" },
  });
  const guest2 = await api(`/api/catchmind/rooms/${created.roomId}/join`, {
    method: "POST",
    body: { nickname: "GuestTwo" },
  });

  const clients = await connectPlayers(created.roomId, [
    { playerId: created.playerId, label: "game-host" },
    { playerId: guest1.playerId, label: "game-guest1" },
    { playerId: guest2.playerId, label: "game-guest2" },
  ]);

  await api(`/api/catchmind/rooms/${created.roomId}/ready`, {
    method: "POST",
    body: { playerId: guest1.playerId },
  });
  await api(`/api/catchmind/rooms/${created.roomId}/ready`, {
    method: "POST",
    body: { playerId: guest2.playerId },
  });

  await api(`/api/catchmind/rooms/${created.roomId}/start`, {
    method: "POST",
    body: { playerId: created.playerId },
  });

  await Promise.all(
    clients.map((client) =>
      client.waitForState((state) => state.room && state.room.phase === "turn", 10000, "turn-start"),
    ),
  );

  const roomState = clients[0].latestState.room;
  const drawerClient = getClientById(clients, roomState.currentDrawerId);
  const guesserClient = clients.find((client) => client.playerId !== drawerClient.playerId);
  assert.ok(guesserClient, "A guesser client should exist.");

  const drawerWord = drawerClient.latestState.room.displayWord;
  const guesserWord = guesserClient.latestState.room.displayWord;
  assert.notEqual(drawerWord, guesserWord);

  const drawReceived = guesserClient.waitForDraw(
    (payload) =>
      Math.abs(Number(payload.x0) - 0.5) < 0.000001 &&
      Math.abs(Number(payload.y0) - 0.5) < 0.000001 &&
      Math.abs(Number(payload.x1) - 0.5) < 0.000001 &&
      Math.abs(Number(payload.y1) - 0.5) < 0.000001,
    8000,
    "dot-draw",
  );

  drawerClient.socket.emit("catchmind:draw-line", {
    roomId: created.roomId,
    playerId: drawerClient.playerId,
    x0: 0.5,
    y0: 0.5,
    x1: 0.5,
    y1: 0.5,
    color: "#111827",
    size: 8,
    tool: "pen",
  });

  await drawReceived;

  const correctGuessSeen = Promise.all(
    clients.map((client) =>
      client.waitForState(
        (state) =>
          state.room &&
          state.room.phase === "turn_result" &&
          Array.isArray(state.messages) &&
          state.messages.some((message) => String(message.text || "").includes(drawerWord)),
        10000,
        "correct-guess",
      ),
    ),
  );

  guesserClient.socket.emit("catchmind:chat", {
    roomId: created.roomId,
    playerId: guesserClient.playerId,
    text: drawerWord,
  });

  await correctGuessSeen;

  await Promise.all(
    clients.map((client) =>
      client.waitForState(
        (state) => state.room && state.room.phase === "turn",
        10000,
        "next-turn",
      ),
    ),
  );

  await api(`/api/catchmind/rooms/${created.roomId}/leave`, {
    method: "POST",
    body: { playerId: created.playerId },
  });
  getClientById(clients, created.playerId).disconnect();

  const remainingClients = clients.filter((client) => client.playerId !== created.playerId);
  const hostTransferred = await remainingClients[0].waitForState(
    (state) => state.room && state.room.hostId !== created.playerId,
    8000,
    "host-transfer-midgame",
  );
  assert.notEqual(hostTransferred.room.hostId, created.playerId);

  const currentState = remainingClients[0].latestState;
  if (currentState.room.phase === "turn") {
    const currentDrawerId = currentState.room.currentDrawerId;
    const leavingDrawer = getClientById(remainingClients, currentDrawerId);

    const turnResultSeen = remainingClients
      .filter((client) => client.playerId !== leavingDrawer.playerId)
      .map((client) =>
        client.waitForState(
          (state) =>
            state.room &&
            (state.room.phase === "turn_result" || state.room.phase === "result"),
          8000,
          "drawer-left-result",
        ),
      );

    await api(`/api/catchmind/rooms/${created.roomId}/leave`, {
      method: "POST",
      body: { playerId: leavingDrawer.playerId },
    });
    leavingDrawer.disconnect();

    await Promise.all(turnResultSeen);

    const survivor = remainingClients.find((client) => client.playerId !== leavingDrawer.playerId);
    assert.ok(survivor, "A survivor client should remain.");

    if (survivor.latestState.room.phase !== "result") {
      await survivor.waitForState(
        (state) =>
          state.room &&
          (state.room.phase === "turn" || state.room.phase === "result"),
        10000,
        "post-drawer-leave-progress",
      );
    }
    survivor.disconnect();
  } else {
    remainingClients.forEach((client) => client.disconnect());
  }
}

async function testDisconnectedDrawerTimeout() {
  console.log("3/3 disconnected drawer timeout");

  const created = await api("/api/catchmind/rooms", {
    method: "POST",
    body: {
      nickname: "HostTimeout",
      roomName: "Timeout Flow",
      maxPlayers: 2,
      maxRounds: 1,
      turnDurationSeconds: 30,
    },
  });
  const guest = await api(`/api/catchmind/rooms/${created.roomId}/join`, {
    method: "POST",
    body: { nickname: "GuestTimeout" },
  });

  const [hostClient, guestClient] = await connectPlayers(created.roomId, [
    { playerId: created.playerId, label: "timeout-host" },
    { playerId: guest.playerId, label: "timeout-guest" },
  ]);

  await api(`/api/catchmind/rooms/${created.roomId}/ready`, {
    method: "POST",
    body: { playerId: guest.playerId },
  });

  await api(`/api/catchmind/rooms/${created.roomId}/start`, {
    method: "POST",
    body: { playerId: created.playerId },
  });

  await Promise.all(
    [hostClient, guestClient].map((client) =>
      client.waitForState((state) => state.room && state.room.phase === "turn", 10000, "turn-start"),
    ),
  );

  const drawerId = hostClient.latestState.room.currentDrawerId;
  const drawerClient = drawerId === hostClient.playerId ? hostClient : guestClient;
  const watcherClient = drawerId === hostClient.playerId ? guestClient : hostClient;
  const initialTurn = watcherClient.latestState.room.currentTurn;

  drawerClient.disconnect();

  await watcherClient.waitForState(
    (state) =>
      state.room &&
      String(state.room.statusText || "").includes("연결이 끊겼습니다"),
    10000,
    "disconnect-notice",
  );

  await watcherClient.waitForState(
    (state) => state.room && state.room.phase === "turn_result",
    40000,
    "timeout-result",
  );

  const progressed = await watcherClient.waitForState(
    (state) =>
      state.room &&
      (state.room.phase === "result" || state.room.currentTurn > initialTurn),
    10000,
    "timeout-progressed",
  );

  assert.ok(progressed.room.phase === "result" || progressed.room.currentTurn > initialTurn);
  watcherClient.disconnect();
}

async function main() {
  const serverStdout = [];
  const serverStderr = [];
  const server = spawn(process.execPath, ["dist/index.js"], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  server.stdout.on("data", (chunk) => {
    serverStdout.push(String(chunk));
  });
  server.stderr.on("data", (chunk) => {
    serverStderr.push(String(chunk));
  });

  try {
    await waitForServer();
    await testLobbyHostTransfer();
    await testRealtimeGameFlow();
    await testDisconnectedDrawerTimeout();
    console.log("CatchMind integration tests passed.");
  } catch (error) {
    console.error(error);
    if (serverStdout.length > 0) {
      console.error("Server stdout:\n" + serverStdout.join(""));
    }
    if (serverStderr.length > 0) {
      console.error("Server stderr:\n" + serverStderr.join(""));
    }
    process.exitCode = 1;
  } finally {
    server.kill();
    await Promise.race([once(server, "exit"), sleep(3000)]);
  }
}

await main();
