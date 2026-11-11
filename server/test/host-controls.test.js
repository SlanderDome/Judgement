import test from "node:test";
import assert from "node:assert/strict";
import { RoomManager } from "../src/game/roomManager.js";
import { getCurrentPlayer, getLegalBids, getLegalCards, getSeatedPlayers, handleTurnTimeout } from "../src/game/stateEngine.js";

function table(count = 2) {
  const manager = new RoomManager();
  const { room, player: host } = manager.createRoom({ nickname: "Host", socketId: "host-socket" });
  manager.takeSeat(room.roomId, host.playerId, 0);
  for (let seat = 1; seat < count; seat++) {
    const { player } = manager.joinRoom({ roomId: room.roomId, nickname: `Player ${seat}`, socketId: `socket-${seat}` });
    manager.takeSeat(room.roomId, player.playerId, seat);
  }
  manager.startGame(room.roomId, host.playerId, { cardsInRound: 1, trumpSuit: "SPADES" });
  return { manager, room, host };
}

function join(manager, room, name) {
  return manager.joinRoom({ roomId: room.roomId, nickname: name, socketId: `${name}-socket` }).player;
}

function finishRound(manager, room, host) {
  manager.startBidding(room.roomId, host.playerId);
  while (room.status === "BIDDING") manager.submitBid(room.roomId, getCurrentPlayer(room).playerId, getLegalBids(room)[0]);
  while (room.status === "TRICK_PLAYING") manager.playCard(room.roomId, getCurrentPlayer(room).playerId, getLegalCards(room)[0].id);
  assert.equal(room.status, "TRICK_COMPLETE");
  handleTurnTimeout(room);
  assert.equal(room.status, "ROUND_SUMMARY");
}

test("leaving preserves an active hand and removes a player between rounds", () => {
  const { manager, room } = table();
  const player = room.players.find(entry => entry.seatIndex === 1);
  const hand = player.hand.map(card => card.id);
  const activeResult = manager.leaveRoom(room.roomId, player.playerId);
  assert.equal(activeResult.removed, false);
  assert.equal(player.isOnline, false);
  assert.equal(player.socketId, null);
  assert.deepEqual(player.hand.map(card => card.id), hand);
  assert(room.players.includes(player));

  room.status = "ROUND_SUMMARY";
  const summaryResult = manager.leaveRoom(room.roomId, player.playerId);
  assert.equal(summaryResult.removed, true);
  assert(!room.players.includes(player));
});

test("host approvals reserve exactly one seat without changing the current round", () => {
  const { manager, room, host } = table();
  const waiting = join(manager, room, "Waiting");
  const spectator = join(manager, room, "Spectator");
  const originalActors = getSeatedPlayers(room).map(p => p.playerId);
  const other = room.players.find(p => p.playerId !== host.playerId && p.seatIndex === 1);
  assert.throws(() => manager.takeSeat(room.roomId, waiting.playerId, 2), /host/);
  assert.throws(() => manager.admitPlayer(room.roomId, other.playerId, waiting.playerId), /host/);
  manager.admitPlayer(room.roomId, host.playerId, waiting.playerId);
  const reserved = waiting.seatIndex;
  manager.admitPlayer(room.roomId, host.playerId, waiting.playerId);
  assert.equal(waiting.seatIndex, reserved);
  assert.equal(waiting.pendingNextRound, true);
  assert.equal(waiting.isActiveInGame, false);
  assert.deepEqual(waiting.hand, []);
  assert.deepEqual(getSeatedPlayers(room).map(p => p.playerId), originalActors);
  finishRound(manager, room, host);
  assert(room.players.includes(waiting));
  assert(room.players.includes(spectator));
  manager.advanceRound(room.roomId, host.playerId);
  assert.equal(waiting.pendingNextRound, false);
  assert.equal(waiting.isActiveInGame, true);
  assert.equal(waiting.hand.length, room.gameConfig.cardsInRound);
  assert.equal(spectator.isActiveInGame, false);
  assert.deepEqual(spectator.hand, []);
});

test("capacity, offline arrivals, host protection and between-round removal", () => {
  const { manager, room, host } = table(8);
  const waiting = join(manager, room, "Waiting");
  const offline = join(manager, room, "Offline arrival");
  manager.disconnectSocket(offline.socketId);
  assert.throws(() => manager.admitPlayer(room.roomId, host.playerId, waiting.playerId), /full/);
  const target = room.players.find(p => p.seatIndex === 3);
  manager.disconnectSocket(target.socketId);
  assert.throws(() => manager.kickPlayer(room.roomId, host.playerId, target.playerId), /between rounds/);
  assert.throws(() => manager.kickPlayer(room.roomId, host.playerId, host.playerId), /cannot be kicked/);
  finishRound(manager, room, host);
  manager.togglePause(room.roomId, host.playerId, { paused: true });
  manager.kickPlayer(room.roomId, host.playerId, target.playerId);
  assert.throws(() => manager.admitPlayer(room.roomId, host.playerId, offline.playerId), /reconnect/);
  manager.admitPlayer(room.roomId, host.playerId, waiting.playerId);
  assert.equal(waiting.seatIndex, 3);
  assert.equal(manager.getSanitizedRoom(room.roomId, host.playerId).nextRoundSetup.maxCards, 6);
  assert.throws(() => manager.advanceRound(room.roomId, host.playerId, { cardsInRound: 7 }), /between 1 and 6/);
  assert.equal(room.status, "ROUND_SUMMARY");
  manager.advanceRound(room.roomId, host.playerId, { cardsInRound: 6 });
  assert.equal(getSeatedPlayers(room).length, 8);
  assert(getSeatedPlayers(room).every(p => p.hand.length === 6));
});

test("pause/resume preserves milliseconds, and repeated pause commands are idempotent", t => {
  t.mock.timers.enable({ apis: ["Date"], now: 100000 });
  const { manager, room, host } = table();
  finishRound(manager, room, host);
  assert.equal(room.timer.durationMs, 5000);
  t.mock.timers.tick(1234);
  manager.togglePause(room.roomId, host.playerId, { paused: true });
  assert.equal(room.timer.remainingMs, 3766);
  assert.equal(room.timer.endsAt, null);
  t.mock.timers.tick(20000);
  manager.togglePause(room.roomId, host.playerId, { paused: true });
  assert.equal(room.timer.remainingMs, 3766);
  assert.equal(room.paused, true);
  handleTurnTimeout(room);
  assert.equal(room.status, "ROUND_SUMMARY");
  manager.togglePause(room.roomId, host.playerId, { paused: false });
  assert.equal(room.timer.endsAt, Date.now() + 3766);
});

test("stale actions cannot pause, remove players or advance a different round", () => {
  const { manager, room, host } = table();
  finishRound(manager, room, host);
  const context = { expectedRound: 1, expectedStatus: "ROUND_SUMMARY" };
  manager.advanceRound(room.roomId, host.playerId, context);
  assert.equal(room.gameConfig.roundNumber, 2);
  assert.throws(() => manager.advanceRound(room.roomId, host.playerId, context), /phase changed/);
  assert.throws(() => manager.togglePause(room.roomId, host.playerId, { ...context, paused: true }), /phase changed/);
  assert.equal(room.paused, false);
  assert.throws(() => manager.kickPlayer(room.roomId, host.playerId, room.players[1].playerId, context), /phase changed/);
  assert.throws(() => manager.startGame(room.roomId, host.playerId), /already in progress/);
  assert.throws(() => manager.rematch(room.roomId, host.playerId), /after the game ends/);
});

test("saved round setup is validated and applies to automatic progression", () => {
  const { manager, room, host } = table();
  finishRound(manager, room, host);
  assert.throws(() => manager.configureNextRound(room.roomId, host.playerId, { cardsInRound: 3, trumpSuit: "HEARTS" }), /Pause/);
  manager.togglePause(room.roomId, host.playerId, { paused: true });
  assert.throws(() => manager.configureNextRound(room.roomId, host.playerId, { cardsInRound: 0, trumpSuit: "HEARTS" }), /Choose/);
  assert.throws(() => manager.configureNextRound(room.roomId, host.playerId, { cardsInRound: 3, trumpSuit: "INVALID" }), /valid trump/);
  manager.configureNextRound(room.roomId, host.playerId, { cardsInRound: 3, trumpSuit: "HEARTS" });
  manager.togglePause(room.roomId, host.playerId, { paused: false });
  handleTurnTimeout(room);
  assert.equal(room.gameConfig.cardsInRound, 3);
  assert.equal(room.gameConfig.trumpSuit, "HEARTS");
  assert.equal(room.nextRoundOptions, null);
});

test("too few players or a changed roster holds the next round for management", () => {
  const { manager, room, host } = table();
  finishRound(manager, room, host);
  manager.kickPlayer(room.roomId, host.playerId, room.players[1].playerId);
  handleTurnTimeout(room);
  assert.equal(room.status, "ROUND_SUMMARY");
  assert.equal(room.paused, true);
  assert.throws(() => manager.togglePause(room.roomId, host.playerId, { paused: false }), /At least 2/);
  const arrival = join(manager, room, "Arrival");
  manager.admitPlayer(room.roomId, host.playerId, arrival.playerId);
  manager.configureNextRound(room.roomId, host.playerId, { cardsInRound: 26, trumpSuit: "CLUBS" });
  const another = join(manager, room, "Another");
  manager.admitPlayer(room.roomId, host.playerId, another.playerId);
  assert.match(manager.getSanitizedRoom(room.roomId, host.playerId).nextRoundSetup.configurationError, /roster changed/);
  assert.throws(() => manager.togglePause(room.roomId, host.playerId, { paused: false }), /roster changed/);
});

test("normal reconnection preserves approved membership and does not duplicate it", () => {
  const { manager, room, host } = table();
  const arrival = join(manager, room, "Arrival");
  manager.admitPlayer(room.roomId, host.playerId, arrival.playerId);
  const seat = arrival.seatIndex;
  manager.disconnectSocket(arrival.socketId);
  const resumed = manager.joinRoom({ roomId: room.roomId, playerId: arrival.playerId, socketId: "resumed", nickname: arrival.nickname });
  assert.equal(resumed.reconnected, true);
  assert.equal(resumed.player.seatIndex, seat);
  assert.equal(resumed.player.pendingNextRound, true);
  assert.equal(room.players.filter(p => p.playerId === arrival.playerId).length, 1);
});

test("removing the previous dealer keeps the next dealer clockwise around physical seats", () => {
  const { manager, room, host } = table(3);
  finishRound(manager, room, host);
  manager.advanceRound(room.roomId, host.playerId, { cardsInRound: 1 });
  const previousDealer = getSeatedPlayers(room)[room.gameConfig.dealerIndex];
  assert.equal(previousDealer.seatIndex, 1);
  finishRound(manager, room, host);
  manager.kickPlayer(room.roomId, host.playerId, previousDealer.playerId);
  manager.advanceRound(room.roomId, host.playerId, { cardsInRound: 1 });
  assert.equal(getSeatedPlayers(room)[room.gameConfig.dealerIndex].seatIndex, 2);
});

test("bid acknowledgements can reject stale turn context and expired deadlines without mutation", () => {
  const { manager, room, host }=table();
  manager.startBidding(room.roomId,host.playerId);
  const actor=getCurrentPlayer(room);
  assert.throws(()=>manager.submitBid(room.roomId,actor.playerId,0,{expectedRound:2}),/turn changed/);
  assert.throws(()=>manager.submitBid(room.roomId,actor.playerId,0,{expectedTurnIndex:0}),/turn changed/);
  room.timer.endsAt=Date.now()-1;
  assert.throws(()=>manager.submitBid(room.roomId,actor.playerId,0),/expired/);
  assert.deepEqual(room.currentRound.bids,{});
});
