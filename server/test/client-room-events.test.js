import test from "node:test";
import assert from "node:assert/strict";
import { getBidChoices, getForbiddenBid, canConfirmBid } from "../../client/src/lib/bidding.js";
import { roomEventSnapshot, newRoomEvents } from "../../client/src/lib/roomEvents.js";

function room() {
  return { roomId:"TEST", status:"BIDDING", paused:false, gameConfig:{roundNumber:1,cardsInRound:26,currentTurnIndex:0,trumpSuit:"HEARTS"},
    players:[{playerId:"me",seatIndex:0,nickname:"You"},{playerId:"other",seatIndex:1,nickname:"Maya"}],
    timer:{endsAt:2000}, currentRound:{bids:{},forbiddenBidForFinalPlayer:null,tricksHistory:[],currentTrick:{cardsPlayed:[]}} };
}

test("large bidding ranges include zero; null forbidden bids remain server-authoritative", () => {
  const state=room();
  assert.equal(getBidChoices(state).length,27);
  assert.equal(getBidChoices(state).at(-1),26);
  assert.equal(getForbiddenBid(state),null);
  assert.equal(canConfirmBid(state,"me",0,true,false,1000),true);
  for(const bid of [null,undefined,-1,27,1.5]) assert.equal(canConfirmBid(state,"me",bid,true,false,1000),false);
  state.currentRound.forbiddenBidForFinalPlayer=26;
  assert.equal(canConfirmBid(state,"me",26,true,false,1000),false);
});

test("bid confirmation is blocked by phase, turn, pause, disconnect, expiry and pending state", () => {
  const state=room();
  assert.equal(canConfirmBid(state,"other",0,true,false,1000),false);
  assert.equal(canConfirmBid(state,"me",0,false,false,1000),false);
  assert.equal(canConfirmBid(state,"me",0,true,true,1000),false);
  assert.equal(canConfirmBid(state,"me",0,true,false,2000),false);
  state.paused=true;assert.equal(canConfirmBid(state,"me",0,true,false,1000),false);
  state.paused=false;state.status="TRICK_PLAYING";assert.equal(canConfirmBid(state,"me",0,true,false,1000),false);
  state.status="BIDDING";state.currentRound.bids.me=0;assert.equal(canConfirmBid(state,"me",0,true,false,1000),false);
});

test("accepted zero bids produce one receipt, including the final bid changing phase", () => {
  const state=room();const previous=roomEventSnapshot(state,true);
  state.currentRound.bids.me=0;state.status="TRICK_PLAYING";
  const next=roomEventSnapshot(state,true);
  assert.equal(newRoomEvents(previous,next,"me").bid.value,0);
  assert.equal(newRoomEvents(next,roomEventSnapshot(state,true),"me").bid,null);
});

test("ace events distinguish trump, preserve batched plays and ignore duplicate snapshots", () => {
  const state=room();state.status="TRICK_PLAYING";
  const previous=roomEventSnapshot(state,true);
  state.currentRound.currentTrick.cardsPlayed.push({playerId:"other",card:{id:"SA",value:14,suit:"SPADES"}},{playerId:"me",card:{id:"HA",value:14,suit:"HEARTS"}});
  state.status="TRICK_COMPLETE";
  const next=roomEventSnapshot(state,true);
  assert.deepEqual(newRoomEvents(previous,next,"me").aces.map(event=>event.kind),["ordinary","trump"]);
  assert.equal(newRoomEvents(next,roomEventSnapshot(state,true),"me").aces.length,0);
});

test("initial/reconnected/history/paused snapshots do not replay ace effects", () => {
  const state=room();state.status="TRICK_PLAYING";
  const disconnected=roomEventSnapshot(state,false);
  state.currentRound.currentTrick.cardsPlayed.push({playerId:"me",card:{id:"HA",value:14,suit:"HEARTS"}});
  const historical=roomEventSnapshot(state,true);
  assert.equal(newRoomEvents(null,historical,"me").aces.length,0);
  assert.equal(newRoomEvents(disconnected,historical,"me").aces.length,0);
  state.paused=true;assert.equal(newRoomEvents(disconnected,roomEventSnapshot(state,true),"me").aces.length,0);
  state.paused=false;state.gameConfig.roundNumber=2;assert.equal(newRoomEvents(historical,roomEventSnapshot(state,true),"me").aces.length,0);
  state.gameConfig.roundNumber=1;state.status="ROUND_SUMMARY";assert.equal(newRoomEvents(roomEventSnapshot(room(),true),roomEventSnapshot(state,true),"me").aces.length,0);
});

test("no-trump aces remain ordinary and pausing/resuming does not replay an existing ace", () => {
  const state=room();state.status="TRICK_PLAYING";state.gameConfig.trumpSuit="NO_TRUMP";
  const previous=roomEventSnapshot(state,true);
  state.currentRound.currentTrick.cardsPlayed.push({playerId:"me",card:{id:"HA",value:14,suit:"HEARTS"}});
  const next=roomEventSnapshot(state,true);
  assert.equal(newRoomEvents(previous,next,"me").aces[0].kind,"ordinary");
  state.paused=true;const paused=roomEventSnapshot(state,true);
  state.paused=false;assert.equal(newRoomEvents(paused,roomEventSnapshot(state,true),"me").aces.length,0);
});
