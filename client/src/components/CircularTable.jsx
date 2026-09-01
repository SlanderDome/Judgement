import { PlayerSeat } from "./PlayerSeat.jsx";
import { SeatCardFan } from "./SeatCardFan.jsx";
import { TableDeck } from "./TableDeck.jsx";
import { SEAT_COUNT, isRoundActive, seatDisplaySlot, seatUnitVector, seatedPlayers } from "../lib/seats.js";

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
  centerSlot
}) {
  const total = roomState.seatCount ?? SEAT_COUNT;
  const ring = seatedPlayers(roomState);
  const bySeat = new Map(ring.map((player) => [player.seatIndex, player]));
  const seats = Array.from({ length: total }, (_value, index) => index);
  const roundActive = isRoundActive(roomState.status);
  const dealing = dealPhase === "dealing";
  // Spin the ring so the viewer's own seat sits bottom-centre. Spectators keep
  // the raw ring order.
  const viewerSeat = ring.find((player) => player.playerId === clientPlayerId)?.seatIndex;

  return (
    <div className="poker-table" role="group" aria-label="Table seats">
      <div className="poker-table__felt" aria-hidden="true" />
      <div className="poker-table__center">{centerSlot}</div>

      <TableDeck roomState={roomState} dealPhase={dealPhase} total={total} viewerSeat={viewerSeat} />

      {seats.map((seatIndex) => {
        const occupant = bySeat.get(seatIndex);
        const showFan =
          occupant &&
          roundActive &&
          !dealing &&
          occupant.playerId !== clientPlayerId &&
          (occupant.handCount ?? 0) > 0;

        return (
          <div
            className="table-seat"
            key={seatIndex}
            style={seatVars(seatDisplaySlot(seatIndex, viewerSeat, total), total)}
          >
            {occupant ? (
              <>
                {showFan && <SeatCardFan count={occupant.handCount} />}
                <PlayerSeat
                  player={occupant}
                  isClient={occupant.playerId === clientPlayerId}
                  isTurn={occupant.playerId === currentTurnPlayerId}
                  isDealer={occupant.playerId === dealerPlayerId}
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
              <div className="seat-empty" aria-hidden="true" />
            )}
          </div>
        );
      })}
    </div>
  );
}
