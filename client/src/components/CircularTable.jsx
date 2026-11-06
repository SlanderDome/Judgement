import { PlayerSeat } from "./PlayerSeat.jsx";
import { SeatCardFan } from "./SeatCardFan.jsx";
import { TableDeck } from "./TableDeck.jsx";
import { TablePlayEffects } from "./TablePlayEffects.jsx";
import { SEAT_COUNT, isRoundActive, seatDisplaySlot, seatUnitVector } from "../lib/seats.js";

const SUIT_MARKS = { SPADES: "♠", HEARTS: "♥", CLUBS: "♣", DIAMONDS: "♦", NO_TRUMP: "NT" };

// CSS multiplies this unit vector by the table's --seat-radius-*, so the ring
// re-proportions per breakpoint without touching JS.
function seatVars(index, total) {
  const { x, y } = seatUnitVector(index, total);
  return { "--seat-x": x.toFixed(4), "--seat-y": y.toFixed(4) };
}

export function CircularTable({
  roomState,
  clientPlayerId,
  canSit,
  isSeated,
  dealerPlayerId,
  currentTurnPlayerId,
  recentlyActedPlayerId,
  timerEndsAt,
  timerDurationMs,
  dealPhase = "idle",
  onTakeSeat,
  centerSlot,
  dropZoneRef,
  aceEffect,
  bidEffect
}) {
  const total = roomState.seatCount ?? SEAT_COUNT;
  const occupied = roomState.players.filter((player) => Number.isInteger(player.seatIndex));
  const bySeat = new Map(occupied.map((player) => [player.seatIndex, player]));
  const seats = Array.from({ length: total }, (_value, index) => index);
  const roundActive = isRoundActive(roomState.status);
  const dealing = dealPhase === "dealing";
  // Spin the ring so the viewer's own seat sits bottom-centre. Spectators keep
  // the raw ring order.
  const viewerSeat = occupied.find((player) => player.playerId === clientPlayerId)?.seatIndex;
  const bidSeat = occupied.find(player => player.playerId === bidEffect?.playerId)?.seatIndex;
  const bidTarget = Number.isInteger(bidSeat) ? seatUnitVector(seatDisplaySlot(bidSeat, viewerSeat, total), total) : null;

  return (
    <div className="poker-table" ref={dropZoneRef} role="group" aria-label="Table seats" data-ace-effect={aceEffect?.kind}>
      <div className="poker-table__felt" aria-hidden="true">
        <div className="poker-table__inlay" />
        <div className="poker-table__emblem"><span>{roomState.status === "LOBBY" ? "♠" : SUIT_MARKS[roomState.gameConfig?.trumpSuit] ?? ""}</span></div>
        <div className="poker-table__wordmark">J U D G E M E N T</div>
        <TablePlayEffects ace={aceEffect} />
      </div>
      <div className="poker-table__center">{centerSlot}</div>
      {bidEffect && bidTarget && <div key={bidEffect.id} className="room-bid-flight" style={{ "--bid-x": bidTarget.x, "--bid-y": bidTarget.y }} aria-hidden="true"><span>{bidEffect.value}</span></div>}

      <TableDeck roomState={roomState} dealPhase={dealPhase} total={total} viewerSeat={viewerSeat} />

      {seats.map((seatIndex) => {
        const occupant = bySeat.get(seatIndex);
        const displaySlot = seatDisplaySlot(seatIndex, viewerSeat, total);
        const showFan =
          occupant &&
          roundActive &&
          !dealing &&
          occupant.playerId !== clientPlayerId &&
          (occupant.handCount ?? 0) > 0;
        // Top-half seats fan upward. Their "below" would land on the trick pile.
        const fanAbove = seatUnitVector(displaySlot, total).y < -0.15;

        return (
          <div
            className="table-seat"
            key={seatIndex}
            data-slot={displaySlot}
            data-side={Math.abs(seatUnitVector(displaySlot, total).x) > .99 ? (seatUnitVector(displaySlot, total).x < 0 ? "left" : "right") : undefined}
            data-pole={Math.abs(seatUnitVector(displaySlot, total).y) > .99 ? "true" : undefined}
            style={seatVars(displaySlot, total)}
          >
            {occupant ? (
              <>
                {showFan && <SeatCardFan count={occupant.handCount} above={fanAbove} />}
                <PlayerSeat
                  player={occupant}
                  isClient={occupant.playerId === clientPlayerId}
                  isTurn={occupant.playerId === currentTurnPlayerId}
                  isDealer={occupant.playerId === dealerPlayerId}
                  isHost={occupant.playerId === roomState.adminPlayerId}
                  isRecentlyActed={occupant.playerId === recentlyActedPlayerId}
                  isDimmed={!occupant.isOnline}
                  timerEndsAt={occupant.playerId === currentTurnPlayerId ? timerEndsAt : null}
                  timerDurationMs={timerDurationMs}
                />
              </>
            ) : canSit ? (
              <button
                type="button"
                className={`seat-sit ${isSeated ? "seat-sit--move" : ""}`}
                onClick={() => onTakeSeat(seatIndex)}
                aria-label={isSeated ? `Move to seat ${seatIndex + 1}` : `Take seat ${seatIndex + 1}`}
              >
                <span className="seat-sit__label">SIT</span>
                <span className="seat-sit__num">{seatIndex + 1}</span>
              </button>
            ) : (
              <div className="seat-empty" aria-label={`Seat ${seatIndex + 1} empty`}>Seat {seatIndex + 1}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
