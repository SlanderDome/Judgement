import { useEffect, useRef, useState } from "react";
import { newRoomEvents, roomEventSnapshot } from "../lib/roomEvents.js";

export function useRoomEffects(roomState, connected, playerId) {
  const [ace, setAce] = useState(null);
  const [bid, setBid] = useState(null);
  const baseline = useRef(null);
  const active = useRef(null);
  const queue = useRef([]);
  const aceTimer = useRef(null);
  const bidTimer = useRef(null);

  useEffect(() => {
    const next = roomEventSnapshot(roomState, connected);
    const previous = baseline.current;
    const events = newRoomEvents(previous, next, playerId);
    baseline.current = next;
    if (!connected || next.paused || previous?.scope !== next.scope || !["TRICK_PLAYING", "TRICK_COMPLETE"].includes(next.status)) {
      window.clearTimeout(aceTimer.current); active.current = null; queue.current = []; setAce(null);
    }
    if (!connected || next.paused || previous?.round !== next.round) {
      window.clearTimeout(bidTimer.current); setBid(null);
    }
    function playNext() {
      const event = queue.current.shift();
      if (!event) { active.current = null; setAce(null); return; }
      active.current = event; setAce(event);
      aceTimer.current = window.setTimeout(playNext, event.kind === "trump" ? 1800 : 1000);
    }
    // Preserve each newly observed ace, including batched snapshots. A new trick,
    // pause, reconnect or room/round change cancels the remaining visual queue.
    queue.current.push(...events.aces);
    if (!active.current && queue.current.length) playNext();
    if (events.bid) {
      window.clearTimeout(bidTimer.current); setBid(events.bid);
      bidTimer.current = window.setTimeout(() => setBid(null), 800);
    }
  }, [roomState, connected, playerId]);

  useEffect(() => () => {
    window.clearTimeout(aceTimer.current); window.clearTimeout(bidTimer.current);
    baseline.current = null; active.current = null; queue.current = [];
  }, []);

  const snapshot = roomEventSnapshot(roomState, connected);
  return {
    ace: connected && !snapshot.paused && ace?.scope === snapshot.scope && ["TRICK_PLAYING", "TRICK_COMPLETE"].includes(snapshot.status) ? ace : null,
    bid: connected && !snapshot.paused && bid?.id.startsWith(`${snapshot.round}:bid:`) ? bid : null
  };
}
