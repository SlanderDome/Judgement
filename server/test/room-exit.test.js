import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { Server } from "socket.io";
import { io as connect } from "socket.io-client";
import { registerSocketHandlers } from "../src/socket/handlers.js";

test("room exit acknowledges departure and updates the remaining players", async (t) => {
  const http = createServer();
  const io = new Server(http);
  registerSocketHandlers(io);
  http.listen(0, "127.0.0.1");
  await once(http, "listening");
  const url = `http://127.0.0.1:${http.address().port}`;
  const host = connect(url, { forceNew: true });
  const guest = connect(url, { forceNew: true });
  t.after(async () => {
    host.disconnect();
    guest.disconnect();
    await new Promise(resolve => io.close(resolve));
  });
  await Promise.all([once(host, "connect"), once(guest, "connect")]);
  const created = once(host, "room:created");
  host.emit("room:create", { nickname: "Host" });
  const [room] = await created;
  const joined = once(guest, "room:joined");
  guest.emit("room:join", { roomId: room.roomId, nickname: "Guest" });
  const [player] = await joined;
  const remaining = once(host, "room:state_update");
  const response = await new Promise(resolve => guest.emit("room:leave", { roomId: room.roomId, playerId: player.playerId }, resolve));
  assert.equal(response.success, true);
  const [update] = await remaining;
  assert.equal(update.roomState.players.some(entry => entry.playerId === player.playerId), false);
  const rejected = await new Promise(resolve => guest.emit("room:leave", { roomId: room.roomId, playerId: player.playerId }, resolve));
  assert.equal(rejected.success, false);
});
