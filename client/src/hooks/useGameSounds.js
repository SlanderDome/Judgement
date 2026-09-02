import { useEffect, useRef } from "react";
import { playSfx } from "../lib/sfx.js";
import { currentTurnPlayer, seatedPlayers } from "../lib/seats.js";

const TIMER_WARN_LEAD_MS = 5000;

// Fires the synthesised palette in response to game-state transitions. Interaction
// sounds (card hover / select) live in the components that own those gestures.
export function useGameSounds(roomState, clientPlayerId, errorMessage) {
  const prevRef = useRef(null);

  useEffect(() => {
    if (!roomState) {
      prevRef.current = null;
      return;
    }

    const snapshot = {
      status: roomState.status,
      bids: Object.keys(roomState.currentRound?.bids ?? {}).length,
      played: roomState.currentRound?.currentTrick?.cardsPlayed?.length ?? 0,
      seated: seatedPlayers(roomState).length,
      paused: roomState.paused === true
    };

    const prev = prevRef.current;
    if (prev) {
      if (snapshot.status !== prev.status) {
        if (snapshot.status === "PRE_BIDDING") playSfx("deal");
        else if (snapshot.status === "BIDDING") playSfx("start");
        else if (snapshot.status === "TRICK_COMPLETE") playSfx("trick");
        else if (snapshot.status === "ROUND_SUMMARY") playSfx("round");
        else if (snapshot.status === "GAME_OVER") playSfx("game");
      }
      if (snapshot.paused !== prev.paused) playSfx("pause");
      if (snapshot.seated > prev.seated) playSfx("seat");
      if (snapshot.bids > prev.bids) playSfx("bid");
      if (snapshot.played > prev.played) playSfx("card");
    }

    prevRef.current = snapshot;
  }, [roomState]);

  // Invalid action — the server bounced something back.
  const prevErrorRef = useRef(errorMessage);
  useEffect(() => {
    if (errorMessage && errorMessage !== prevErrorRef.current) {
      playSfx("invalid");
    }
    prevErrorRef.current = errorMessage;
  }, [errorMessage]);

  // Timer warning — a restrained pulse ~5s before your own bid / play clock runs
  // out. Rescheduled whenever the turn or deadline changes; cleared when it moves
  // on so it never fires for a turn that already passed.
  const status = roomState?.status;
  const endsAt = roomState?.timer?.endsAt ?? null;
  const myTurn =
    !!roomState &&
    (status === "BIDDING" || status === "TRICK_PLAYING") &&
    currentTurnPlayer(roomState)?.playerId === clientPlayerId &&
    roomState.paused !== true;

  useEffect(() => {
    if (!myTurn || !endsAt) {
      return undefined;
    }
    const lead = endsAt - Date.now() - TIMER_WARN_LEAD_MS;
    if (lead <= 0) {
      return undefined;
    }
    const id = window.setTimeout(() => playSfx("timer"), lead);
    return () => window.clearTimeout(id);
  }, [myTurn, endsAt]);
}
