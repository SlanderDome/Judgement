import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "framer-motion";
import { GameBoard } from "../components/GameBoard.jsx";
import * as engine from "../../../server/src/game/stateEngine.js";
import "./room-preview.css";

const SCENARIOS = [["pre","Pre-bidding"],["bidding","Bidding"],["active","Active round"],["summary","Round complete"],["paused","Management paused"],["full","Table full"],["over","Game over"]];
const HOST = "preview-host";

function createPreview(scenario, requested) {
  const host = engine.createPlayer({ playerId:HOST, nickname:"You", socketId:"local-host", seatIndex:0, isAdmin:true });
  const room = engine.createRoom({ roomId:"PREVIEW", player:host });
  const count = scenario === "full" ? 8 : Math.max(2, Math.min(6, Math.floor(52 / requested)));
  const names = ["You","Maya","Imani","Dev","Rafael","Noor","Mei-Ling Chen","Luca"];
  for (let index=1; index<count; index++) room.players.push(engine.createPlayer({ playerId:`preview-${index}`, nickname:names[index], socketId:`local-${index}`, seatIndex:index }));
  engine.startGame(room, { cardsInRound:Math.min(requested,Math.floor(52/count)), trumpSuit:"HEARTS" });
  room.players[Math.min(4,count-1)].isOnline=false;
  if (scenario !== "full") {
    const arrival=engine.createPlayer({playerId:"preview-reserved",nickname:"Sofia",socketId:"local-reserved"});
    engine.attachPlayerToRoom(room,arrival);engine.admitNextRound(room,arrival.playerId);
  }
  for (const [index,name] of ["Arjun","Rohan"].entries()) engine.attachPlayerToRoom(room,engine.createPlayer({playerId:`waiting-${index}`,nickname:name,socketId:`local-waiting-${index}`}));
  if (scenario === "pre") return room;
  engine.startBidding(room);
  while (room.status === "BIDDING") {
    const player=engine.getCurrentPlayer(room);
    if (scenario === "bidding" && player.playerId === HOST) return room;
    const choices=engine.getLegalBids(room);
    const preferred=Object.keys(room.currentRound.bids).length === 0 ? 1 : 0;
    engine.submitBid(room,player.playerId,choices.includes(preferred)?preferred:choices[0]);
  }
  if (scenario === "active") return room;
  while (room.status !== "ROUND_SUMMARY") {
    if (room.status === "TRICK_COMPLETE") engine.handleTurnTimeout(room);
    else engine.playCard(room,engine.getCurrentPlayer(room).playerId,engine.getLegalCards(room)[0].id);
  }
  if (["paused","full"].includes(scenario)) engine.togglePause(room,true);
  if (scenario === "over") engine.advanceRound(room,{action:"end_game"});
  return room;
}

export function RoomPreview() {
  const query = new URLSearchParams(window.location.search).get("room-preview");
  const initial = SCENARIOS.some(([key])=>key===query) ? query : "pre";
  const [scenario,setScenario]=useState(initial);
  const [cards,setCards]=useState(4);
  const roomRef=useRef(null);
  if (!roomRef.current) roomRef.current=createPreview(initial,4);
  const snapshot=()=>structuredClone(engine.sanitizeRoomForPlayer(roomRef.current,HOST));
  const [roomState,setRoomState]=useState(snapshot);
  const [epoch,setEpoch]=useState(0);
  const [connected,setConnected]=useState(true);
  const [rejectBid,setRejectBid]=useState(false);
  const [notice,setNotice]=useState("Local development preview. No connection to a multiplayer server.");
  const timers=useRef(new Map());
  const publish=()=>setRoomState(snapshot());

  function cancelPending() {
    timers.current.forEach((resolve,timer)=>{clearTimeout(timer);resolve({success:false,message:"The preview was reset."});});
    timers.current.clear();
  }
  function reset(next=scenario, size=cards) {
    cancelPending();roomRef.current=createPreview(next,size);setScenario(next);setConnected(true);setRejectBid(false);setEpoch(value=>value+1);publish();
    setNotice("Scenario reset. All timers and visual effects from the previous scenario were cleared.");
  }
  function action(operation, context={}) {
    try {
      const room=roomRef.current;
      if ((context.expectedRound!==undefined&&context.expectedRound!==room.gameConfig.roundNumber)||(context.expectedStatus!==undefined&&context.expectedStatus!==room.status)) throw Error("The preview phase changed. Try again.");
      operation(room);publish();return Promise.resolve({success:true});
    } catch (error) { return Promise.resolve({success:false,message:error.message}); }
  }
  useEffect(()=>{
    const timer=setInterval(()=>{
      const room=roomRef.current;
      if (!room.paused && room.timer?.endsAt!=null && room.timer.endsAt<=Date.now()) action(current=>engine.handleTurnTimeout(current));
    },200);
    return ()=>{clearInterval(timer);cancelPending();};
  },[]);

  function playAce(kind) {
    action(room=>{
      if (!["TRICK_PLAYING","TRICK_COMPLETE"].includes(room.status)) throw Error("Choose the Active round scenario first.");
      room.paused=false;
      if (room.status === "TRICK_COMPLETE") engine.handleTurnTimeout(room);
      if (room.status !== "TRICK_PLAYING") throw Error("Reset to Active round to replay the effect.");
      // A fixture-only new trick gives the current actor a legal ace lead. The
      // engine accepts the play; effects still come from observed state changes.
      if (room.currentRound.currentTrick.cardsPlayed.length) room.currentRound.tricksHistory.push({ cardsPlayed:[],winnerPlayerId:null });
      room.currentRound.currentTrick={leadSuit:null,cardsPlayed:[],winnerPlayerId:null};
      const suit=kind === "trump" ? room.gameConfig.trumpSuit : room.gameConfig.trumpSuit === "SPADES" ? "CLUBS" : "SPADES";
      const card={id:`${suit[0]}A`,label:"A",value:14,suit};
      room.players.forEach(player=>{player.hand=player.hand.filter(item=>item.id!==card.id);});
      const actor=engine.getCurrentPlayer(room);actor.hand.push(card);room.paused=false;
      engine.playCard(room,actor.playerId,card.id);
    });
  }

  return <MotionConfig reducedMotion="user"><main className="app-shell app-shell--game">
    <GameBoard key={epoch} roomState={roomState} clientPlayerId={HOST} isConnected={connected} connectionStatus={connected?"connected":"reconnecting"} errorMessage=""
      onStartGame={options=>action(room=>engine.startGame(room,options),options)}
      onStartBidding={context=>action(room=>engine.startBidding(room),context)}
      onSetPaused={(paused,context)=>action(room=>engine.togglePause(room,paused),context)}
      onSubmitBid={(bid,context)=>new Promise(resolve=>{
        const shouldReject=rejectBid;setRejectBid(false);
        const timer=setTimeout(()=>{timers.current.delete(timer);if(shouldReject)resolve({success:false,message:"Preview rejection. Choose again and retry."});else action(room=>engine.submitBid(room,HOST,bid),context).then(resolve);},350);
        timers.current.set(timer,resolve);
      })}
      onPlayCard={id=>action(room=>engine.playCard(room,HOST,id))}
      onTakeSeat={seat=>action(room=>engine.takeSeat(room,HOST,seat))}
      onKickPlayer={(id,context)=>action(room=>engine.removePlayer(room,id),context)}
      onAdmitPlayer={(id,context)=>action(room=>engine.admitNextRound(room,id),context)}
      onConfigureNextRound={options=>action(room=>engine.configureNextRound(room,options),options)}
      onNextRound={options=>action(room=>engine.advanceRound(room,{...room.nextRoundOptions,...options}),options)}
      onRematch={()=>action(room=>engine.resetRoom(room))}
      onLeaveRoom={()=>window.location.assign("/")} />
    <section className="room-preview-tools" aria-label="Development scenario tools">
      <h2>Development room preview</h2><p>These controls and local fixtures are excluded from the production build.</p>
      <div className="room-preview-scenarios">{SCENARIOS.map(([key,label])=><button type="button" key={key} aria-pressed={scenario===key} onClick={()=>reset(key)}>{label}</button>)}</div>
      <div className="room-preview-actions"><label>Reset round size<select value={cards} onChange={event=>{const size=Number(event.target.value);setCards(size);reset(scenario,size);}}>{[1,4,6,8,13,26].map(count=><option key={count} value={count}>{count} cards</option>)}</select></label>
        <button type="button" onClick={()=>setConnected(value=>!value)}>{connected?"Disconnect preview":"Reconnect preview"}</button>
        <button type="button" aria-pressed={rejectBid} onClick={()=>setRejectBid(value=>!value)}>Reject next bid</button>
        <button type="button" disabled={!connected||!["TRICK_PLAYING","TRICK_COMPLETE"].includes(roomState.status)} onClick={()=>playAce("ordinary")}>Play ordinary ace</button>
        <button type="button" disabled={!connected||!["TRICK_PLAYING","TRICK_COMPLETE"].includes(roomState.status)} onClick={()=>playAce("trump")}>Play trump ace</button>
      </div><p role="status">{notice}</p><a href="/">Leave preview</a>
    </section>
  </main></MotionConfig>;
}
