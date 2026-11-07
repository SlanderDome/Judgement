import { useEffect, useRef, useState } from "react";
import { RoomCodeButton } from "./RoomCodeButton.jsx";
import { SoundToggle } from "./SoundToggle.jsx";
import { ConnectionBadge } from "./ConnectionBadge.jsx";
import { TrumpIndicator } from "./TrumpIndicator.jsx";

export function RoomNavbar({ roomState, clientPlayerId, isConnected, connectionStatus, errorMessage, adminOpen, hostBusy = false, onToggleHost, onStartBidding, onSetPaused, onExit }) {
  const [open, setOpen] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startNotice, setStartNotice] = useState("");
  const scoreRef = useRef(null);
  const utilityRef = useRef(null);
  const navbarRef = useRef(null);
  const [pausePending, setPausePending] = useState(false);
  const requestRef = useRef(false);
  const isHost = roomState.adminPlayerId === clientPlayerId;
  const preBidding = roomState.status === "PRE_BIDDING";
  const lobby = roomState.status === "LOBBY";
  const gameOver = roomState.status === "GAME_OVER";
  const waiting = roomState.players.filter(player => player.playerId !== roomState.adminPlayerId && (!Number.isInteger(player.seatIndex) || player.pendingNextRound)).length;
  const scores = roomState.players.filter(player => Number.isInteger(player.seatIndex)).slice().sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  useEffect(() => {
    if (!preBidding || errorMessage || !isConnected) {
      requestRef.current = false;
      setStarting(false);
    }
  }, [preBidding, errorMessage, isConnected, roomState.roomId]);

  useEffect(() => {
    const navbar = navbarRef.current;
    const room = navbar.closest(".room-concept");
    const observer = new ResizeObserver(() => room.style.setProperty("--room-navbar-height", `${navbar.getBoundingClientRect().height}px`));
    observer.observe(navbar);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (adminOpen) setOpen(null); }, [adminOpen]);

  useEffect(() => {
    if (!open) return undefined;
    function closeOutside(event) {
      if (!event.target.closest?.(`[data-room-dropdown="${open}"]`)) setOpen(null);
    }
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(null);
      (open === "scores" ? scoreRef : utilityRef).current?.focus();
    }
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  async function startBidding() {
    if (!isHost || !preBidding || roomState.paused || !isConnected || requestRef.current) return;
    requestRef.current = true;
    setStarting(true);
    setStartNotice("");
    try {
      const result = await onStartBidding({ expectedRound: roomState.gameConfig.roundNumber, expectedStatus: roomState.status });
      if (!result?.success) setStartNotice(result?.message ?? "The server did not confirm bidding.");
    } finally { requestRef.current = false; setStarting(false); }
  }

  async function pauseGame() {
    if (pausePending || hostBusy) return;
    setPausePending(true);
    try {
      const result = await onSetPaused(!roomState.paused, { expectedRound: roomState.gameConfig.roundNumber, expectedStatus: roomState.status });
      if (!result?.success) setStartNotice(result?.message ?? "The server did not confirm the pause.");
    } finally { setPausePending(false); }
  }

  return (
    <header className="room-navbar" ref={navbarRef}>
      <span className="room-navbar__brand"><span aria-hidden="true">♠</span> JUDGEMENT</span>
      <nav className="room-navbar__items" aria-label="Table controls">
        <div className="room-metric room-metric--trump"><span>Trump suit</span>{lobby ? <strong>Not dealt</strong> : <TrumpIndicator roomState={roomState} showName />}</div>
        <div className="room-metric"><span>Round</span><strong>{lobby ? "Waiting" : `No. ${roomState.gameConfig.roundNumber}`}</strong></div>
        <RoomCodeButton roomId={roomState.roomId} disabled={adminOpen} />
        <div className="room-dropdown room-dropdown--scores" data-room-dropdown="scores">
          <button type="button" className="room-nav-button" ref={scoreRef} disabled={adminOpen} aria-label="Scores" aria-expanded={open === "scores"} aria-controls="room-live-scores" onClick={() => setOpen(open === "scores" ? null : "scores")}>Scores <span aria-hidden="true">⌄</span></button>
          {open === "scores" && <section className="room-popover" id="room-live-scores" aria-label="Live standings">
            <h2>Standings</h2>
            {scores.length ? scores.map(player => <div className={`room-score-row ${player.playerId === clientPlayerId ? "is-you" : ""}`} key={player.playerId}><span title={player.nickname}>{player.nickname}{player.playerId === clientPlayerId ? " (you)" : ""}</span><strong>{player.score ?? 0}</strong></div>) : <p>Take a seat to join the standings.</p>}
          </section>}
        </div>
        {isHost && preBidding && <button type="button" className="room-nav-button room-nav-button--primary room-start-bidding" disabled={starting || hostBusy || adminOpen || !isConnected || roomState.paused === true} onClick={startBidding}>{starting ? "Starting bidding…" : "Start bidding now"}</button>}
        {isHost && <button type="button" className="room-nav-button room-host-toggle" aria-haspopup="dialog" aria-expanded={adminOpen} aria-controls="room-host-dialog" onClick={() => { setOpen(null); onToggleHost(); }}>Host {waiting > 0 && <span className="room-waiting-count" aria-label={`${waiting} waiting or joining next round`}>{waiting}</span>}</button>}
        <button type="button" className="room-nav-button room-exit" disabled={adminOpen} aria-label="Exit room" onClick={onExit}><span className="room-exit__text">Exit</span> <span aria-hidden="true">↗</span></button>
        <div className="room-dropdown room-dropdown--utility" data-room-dropdown="utility">
          <button type="button" className="room-nav-button" ref={utilityRef} disabled={adminOpen} aria-label="Table options" aria-expanded={open === "utility"} aria-controls="room-utilities" onClick={() => setOpen(open === "utility" ? null : "utility")}>•••</button>
          {open === "utility" && <section className="room-popover" id="room-utilities" aria-label="Table options">
            <h2>Table options</h2>
            <div className="room-mobile-options">
              <RoomCodeButton roomId={roomState.roomId} disabled={adminOpen} />
              {isHost && preBidding && <button type="button" className="room-nav-button room-nav-button--primary" disabled={starting || hostBusy || adminOpen || !isConnected || roomState.paused === true} onClick={startBidding}>{starting ? "Starting bidding…" : "Start bidding now"}</button>}
              {isHost && <button type="button" className="room-nav-button" aria-haspopup="dialog" aria-expanded={adminOpen} aria-controls="room-host-dialog" onClick={() => { setOpen(null); onToggleHost(); }}>Host controls {waiting > 0 && `(${waiting} waiting)`}</button>}
            </div>
            <SoundToggle /><ConnectionBadge status={connectionStatus} />
            {!lobby && <p>{roomState.gameConfig.cardsInRound} cards per player <span aria-label={roomState.gameConfig.phase === "ASCENDING" ? "Ascending" : "Descending"}>{roomState.gameConfig.phase === "ASCENDING" ? "↑" : "↓"}</span></p>}
            {isHost && !lobby && !gameOver && <button type="button" className="room-nav-button" disabled={!isConnected || hostBusy || pausePending} onClick={pauseGame}>{pausePending ? "Confirming…" : roomState.paused ? "Resume game" : "Pause game"}</button>}
          </section>}
        </div>
      </nav>
      {startNotice && <p className="room-navbar__notice" role="status">{startNotice}</p>}
    </header>
  );
}
